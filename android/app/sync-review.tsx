import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { getLocalUpdatedAtById, upsertLocalDocument } from "@/db/documents";
import { usePairing } from "@/hooks/usePairing";
import { downloadDocumentFile, localPathForDocument } from "@/storage/fileStorage";
import { setLastSyncAt } from "@/storage/syncMeta";
import { documentFileUrl, fetchManifest, SyncApiError } from "@/sync/api";
import { computeSyncDiff, type SyncDiffEntry } from "@/sync/diff";
import { useTheme } from "@/theme/ThemeProvider";
import { formatBytes } from "@/utils/format";

type LoadState = "loading" | "ready" | "error";

const ALL_CATEGORIES = "__all__";

export default function SyncReviewScreen() {
  const theme = useTheme();
  const { pairing, isLoading: isPairingLoading } = usePairing();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diffEntries, setDiffEntries] = useState<SyncDiffEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const loadManifest = useCallback(async () => {
    if (!pairing) return;
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const [manifest, localUpdatedAtById] = await Promise.all([fetchManifest(pairing), getLocalUpdatedAtById()]);
      const diff = computeSyncDiff(manifest, localUpdatedAtById);
      setDiffEntries(diff);
      setSelectedIds(new Set());
      setLoadState("ready");
    } catch (error) {
      const message =
        error instanceof SyncApiError ? error.message : "Erreur inattendue pendant la synchronisation.";
      setErrorMessage(message);
      setLoadState("error");
    }
  }, [pairing]);

  useEffect(() => {
    if (!isPairingLoading) {
      loadManifest();
    }
  }, [isPairingLoading, loadManifest]);

  const categories = useMemo(() => {
    const set = new Set(diffEntries.map((d) => d.entry.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [diffEntries]);

  const visibleEntries = useMemo(() => {
    if (categoryFilter === ALL_CATEGORIES) return diffEntries;
    return diffEntries.filter((d) => d.entry.category === categoryFilter);
  }, [diffEntries, categoryFilter]);

  const allVisibleSelected = visibleEntries.length > 0 && visibleEntries.every((d) => selectedIds.has(d.entry.id));

  function toggleEntry(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const d of visibleEntries) next.delete(d.entry.id);
      } else {
        for (const d of visibleEntries) next.add(d.entry.id);
      }
      return next;
    });
  }

  async function downloadSelected() {
    if (!pairing || selectedIds.size === 0) return;
    setIsDownloading(true);
    const toDownload = diffEntries.filter((d) => selectedIds.has(d.entry.id));
    setProgress({ done: 0, total: toDownload.length });

    const failures: string[] = [];
    for (const { entry } of toDownload) {
      try {
        const destinationPath = localPathForDocument(entry.id, entry.currentName, entry.mimeType);
        const url = documentFileUrl(pairing, entry.id);
        await downloadDocumentFile(url, pairing.token, destinationPath);
        await upsertLocalDocument({
          id: entry.id,
          currentName: entry.currentName,
          category: entry.category,
          summary: entry.summary,
          mimeType: entry.mimeType,
          sizeBytes: entry.sizeBytes,
          documentDate: entry.documentDate,
          updatedAt: entry.updatedAt,
          localFilePath: destinationPath,
          syncStatus: "synced",
        });
      } catch {
        failures.push(entry.currentName);
      }
      setProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
    }

    setIsDownloading(false);
    setProgress(null);

    if (toDownload.length - failures.length > 0) {
      // Au moins un document a été effectivement récupéré : c'est un index réel.
      await setLastSyncAt(new Date().toISOString());
    }

    if (failures.length > 0) {
      Alert.alert(
        "Synchronisation partielle",
        `${toDownload.length - failures.length} document(s) téléchargé(s). Échec pour : ${failures.join(", ")}.`,
      );
    } else {
      Alert.alert("Synchronisation terminée", `${toDownload.length} document(s) téléchargé(s).`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
    // Recharge le diff pour retirer ce qui vient d'être téléchargé de la liste.
    loadManifest();
  }

  if (isPairingLoading) {
    return <Screen />;
  }

  if (!pairing) {
    return (
      <Screen>
        <EmptyState
          icon="📱"
          title="Aucun appareil associé"
          message="Scanne d'abord le QR code de pairing depuis l'onglet Sync."
        />
      </Screen>
    );
  }

  if (loadState === "loading") {
    return (
      <Screen>
        <EmptyState icon="⏳" title="Connexion au PC…" message="Récupération de la liste des documents disponibles." />
      </Screen>
    );
  }

  if (loadState === "error") {
    return (
      <Screen>
        <EmptyState icon="⚠️" title="Synchronisation impossible" message={errorMessage ?? "Erreur inconnue."}>
          <Button label="Réessayer" onPress={loadManifest} />
        </EmptyState>
      </Screen>
    );
  }

  if (diffEntries.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="✅"
          title="Tout est à jour"
          message="Aucun document nouveau ou modifié à récupérer depuis le PC."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: theme.spacing.md }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm, marginBottom: theme.spacing.sm }}>
          {diffEntries.length} document(s) nouveau(x) ou modifié(s) proposé(s) par le PC.
        </Text>

        {categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: theme.spacing.sm }}>
            <Chip label="Toutes" selected={categoryFilter === ALL_CATEGORIES} onPress={() => setCategoryFilter(ALL_CATEGORIES)} />
            {categories.map((category) => (
              <Chip
                key={category}
                label={category}
                selected={categoryFilter === category}
                onPress={() => setCategoryFilter(category)}
              />
            ))}
          </ScrollView>
        )}

        <Button
          label={allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
          variant="secondary"
          onPress={toggleSelectAllVisible}
        />
      </View>

      <FlatList
        data={visibleEntries}
        keyExtractor={(item) => item.entry.id}
        style={{ marginTop: theme.spacing.md }}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        renderItem={({ item }) => (
          <Checkbox
            checked={selectedIds.has(item.entry.id)}
            onToggle={() => toggleEntry(item.entry.id)}
            label={item.entry.currentName}
            sublabel={`${item.entry.category} · ${formatBytes(item.entry.sizeBytes)} · ${item.kind === "new" ? "nouveau" : "modifié"}`}
          />
        )}
      />

      <View style={{ paddingVertical: theme.spacing.md }}>
        <Button
          label={
            progress
              ? `Téléchargement ${progress.done}/${progress.total}…`
              : `Télécharger la sélection (${selectedIds.size})`
          }
          onPress={downloadSelected}
          disabled={selectedIds.size === 0}
          loading={isDownloading}
        />
      </View>
    </Screen>
  );
}

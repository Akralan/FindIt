import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { DocumentRow } from "@/components/DocumentRow";
import { DocumentSheet } from "@/components/DocumentSheet";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SearchBar } from "@/components/SearchBar";
import { SectionLabel } from "@/components/SectionLabel";
import { useDocuments } from "@/hooks/useDocuments";
import { useOpenLocalFile } from "@/hooks/useOpenLocalFile";
import { usePairing } from "@/hooks/usePairing";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { searchDocuments } from "@/search/fuzzy";
import { useTheme } from "@/theme/ThemeProvider";
import type { LocalDocument, PairingInfo } from "@/types/document";
import { deviceLabel } from "@/utils/deviceLabel";

export default function SearchScreen() {
  const theme = useTheme();
  const { pairing, isLoading: isPairingLoading } = usePairing();
  const { documents, isLoading: isDocumentsLoading, refresh } = useDocuments();
  const { recentQueries, recordQuery } = useSearchHistory();
  const { isOpening, openDocument } = useOpenLocalFile();

  const [query, setQuery] = useState("");
  const [sheetDocument, setSheetDocument] = useState<LocalDocument | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const results = useMemo(() => {
    if (!isSearching) return documents;
    return searchDocuments(documents, query).map((result) => result.document);
  }, [documents, query, isSearching]);

  function submitQuery() {
    if (trimmedQuery.length > 0) {
      recordQuery(trimmedQuery);
    }
  }

  function selectRecentQuery(entry: string) {
    setQuery(entry);
    recordQuery(entry);
  }

  const isLoading = isPairingLoading || isDocumentsLoading;

  if (!isLoading && documents.length === 0) {
    return (
      <Screen>
        <View style={{ paddingTop: theme.spacing.md }}>
          <HeaderBar pairing={pairing} />
        </View>
        {!pairing ? (
          <EmptyState
            icon="📱"
            title="Aucun appareil associé"
            message="Scanne le QR code affiché dans l'onglet Sync de l'application PC pour associer ce téléphone, puis synchronise tes documents."
          >
            <Button label="Aller à Sync" onPress={() => router.push("/(tabs)/sync")} />
          </EmptyState>
        ) : (
          <EmptyState
            icon="🗂️"
            title="Aucun document local"
            message="Lance une synchronisation pour copier les documents confirmés du PC sur ce téléphone."
          >
            <Button label="Synchroniser" onPress={() => router.push("/sync-review")} />
          </EmptyState>
        )}
      </Screen>
    );
  }

  return (
    <Screen noPadding>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md, gap: theme.spacing.lg }}>
            <HeaderBar pairing={pairing} />

            <SearchBar value={query} onChangeText={setQuery} onSubmit={submitQuery} />

            {!isSearching && recentQueries.length > 0 && (
              <View style={{ gap: theme.spacing.sm }}>
                <SectionLabel text="Recherches récentes" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                  {recentQueries.map((entry) => (
                    <Chip key={entry} label={entry} onPress={() => selectRecentQuery(entry)} />
                  ))}
                </View>
              </View>
            )}

            {!isSearching && (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.typography.size.sm,
                  lineHeight: theme.typography.lineHeight.sm,
                }}
              >
                Décrivez le document en français — FindIt cherche dans les noms, les catégories et les résumés déjà
                copiés sur ce téléphone.
              </Text>
            )}

            {(!isSearching || results.length > 0) && (
              <SectionLabel
                text={isSearching ? `${results.length} résultat${results.length > 1 ? "s" : ""}` : "Tous les documents"}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <DocumentRow document={item} onPress={() => setSheetDocument(item)} />
        )}
        ListEmptyComponent={
          isSearching ? (
            <View
              style={{
                alignItems: "center",
                gap: theme.spacing.sm,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderStyle: "dashed",
                borderRadius: theme.radii.cardLg,
                padding: theme.spacing.xl,
              }}
            >
              <Text
                style={{ color: theme.colors.text, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}
              >
                Aucun résultat
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.typography.size.sm,
                  textAlign: "center",
                  lineHeight: theme.typography.lineHeight.sm,
                }}
              >
                Essayez une autre formulation, ou décrivez le document plutôt que son nom de fichier.
              </Text>
            </View>
          ) : null
        }
      />

      <DocumentSheet
        document={sheetDocument}
        onClose={() => setSheetDocument(null)}
        onOpenFile={openDocument}
        isOpening={isOpening}
      />
    </Screen>
  );
}

function HeaderBar({ pairing }: { pairing: PairingInfo | null }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: theme.colors.accent }} />
        <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.md, fontWeight: theme.typography.weight.semibold }}>
          FindIt
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: pairing ? theme.colors.accent : theme.colors.textFaint,
          }}
        />
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.xs }}>{deviceLabel(pairing)}</Text>
      </View>
    </View>
  );
}

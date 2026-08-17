import { useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { CheckIcon } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useDocuments } from "@/hooks/useDocuments";
import { usePairing } from "@/hooks/usePairing";
import { getLastSyncAt } from "@/storage/syncMeta";
import { useTheme } from "@/theme/ThemeProvider";
import { monoFontFamily } from "@/theme/tokens";
import { withAlpha } from "@/theme/withAlpha";
import type { PairingInfo } from "@/types/document";
import { deviceLabel } from "@/utils/deviceLabel";
import { formatRelativeTime } from "@/utils/format";

export default function SyncScreen() {
  const theme = useTheme();
  const { pairing, isLoading: isPairingLoading, forgetPairing } = usePairing();
  const { documents, refresh: refreshDocuments } = useDocuments();
  const [permission, requestPermission] = useCameraPermissions();

  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshDocuments();
      getLastSyncAt().then(setLastSyncAtState);
    }, [refreshDocuments]),
  );

  function confirmForget() {
    Alert.alert(
      "Déconnecter cet appareil ?",
      "Le téléphone ne pourra plus synchroniser avec ce PC tant qu'il n'aura pas re-scanné le QR code.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnecter", style: "destructive", onPress: () => forgetPairing() },
      ],
    );
  }

  async function handleScanPress() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    router.push("/scan");
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.xl }}
      >
        <View>
          <Text
            style={{ color: theme.colors.text, fontSize: theme.typography.size.xxl, fontWeight: theme.typography.weight.semibold }}
          >
            Synchronisation
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.size.base,
              lineHeight: theme.typography.lineHeight.base,
              marginTop: theme.spacing.xs,
            }}
          >
            Vos documents sont copiés sur ce téléphone — retrouvez-les même sans connexion au PC.
          </Text>
        </View>

        {isPairingLoading ? null : pairing ? (
          <PairedCard
            pairing={pairing}
            documentsCount={documents.length}
            lastSyncAt={lastSyncAt}
            onRefreshIndex={() => router.push("/sync-review")}
            onDisconnect={confirmForget}
          />
        ) : (
          <UnpairedPanel onScanPress={handleScanPress} hasPermission={permission?.granted ?? false} />
        )}

        <Text
          style={{
            color: theme.colors.textFaint,
            fontSize: theme.typography.size.xs,
            lineHeight: theme.typography.lineHeight.xs,
            textAlign: "center",
          }}
        >
          Import, classement et validation restent sur le PC.
        </Text>
      </ScrollView>
    </Screen>
  );
}

interface PairedCardProps {
  pairing: PairingInfo;
  documentsCount: number;
  lastSyncAt: string | null;
  onRefreshIndex: () => void;
  onDisconnect: () => void;
}

function PairedCard({ pairing, documentsCount, lastSyncAt, onRefreshIndex, onDisconnect }: PairedCardProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radii.cardLg,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            backgroundColor: withAlpha(theme.colors.accent, "24"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckIcon size={18} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ color: theme.colors.text, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}
          >
            {deviceLabel(pairing)}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm, marginTop: 2 }}>
            {lastSyncAt ? `Connecté · dernier index ${formatRelativeTime(lastSyncAt)}` : "Connecté"}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          borderTopColor: theme.colors.borderSubtle,
          borderTopWidth: 1,
          paddingTop: theme.spacing.md,
        }}
      >
        <Stat label="Documents" value={String(documentsCount)} />
        <Stat label="Dernier index" value={formatRelativeTime(lastSyncAt)} />
        <Stat label="Réseau" value="local" />
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Actualiser l'index" variant="secondary" onPress={onRefreshIndex} />
        </View>
        <Button label="Déconnecter" variant="danger" onPress={onDisconnect} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.colors.textFaint, fontSize: theme.typography.size.xs }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontSize: theme.typography.size.base, fontFamily: monoFontFamily, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

interface UnpairedPanelProps {
  onScanPress: () => void;
  hasPermission: boolean;
}

function UnpairedPanel({ onScanPress, hasPermission }: UnpairedPanelProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <ScanViewfinder />

      <View style={{ alignItems: "center" }}>
        <Text
          style={{ color: theme.colors.text, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}
        >
          Scannez le QR code de votre PC
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.size.sm,
            marginTop: theme.spacing.xs,
            textAlign: "center",
          }}
        >
          Sur l'ordinateur : FindIt → Réglages → Synchro mobile.
        </Text>
      </View>

      <Button label={hasPermission ? "Scanner le QR code" : "Autoriser l'appareil photo"} onPress={onScanPress} />
    </View>
  );
}

/** Viseur QR décoratif — pas de flux caméra réel ici (juste le bouton d'accès à `app/scan.tsx`). */
function ScanViewfinder() {
  const theme = useTheme();
  const bracketSize = 34;
  const inset = 38;

  const bracketBase = {
    position: "absolute" as const,
    width: bracketSize,
    height: bracketSize,
    borderColor: theme.colors.accent,
  };

  return (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: theme.radii.cardLg,
        overflow: "hidden",
        backgroundColor: theme.colors.bg,
        borderColor: theme.colors.border,
        borderWidth: 1,
      }}
    >
      <View style={[bracketBase, { top: inset, left: inset, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 }]} />
      <View
        style={[bracketBase, { top: inset, right: inset, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 }]}
      />
      <View
        style={[
          bracketBase,
          { bottom: inset, left: inset, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
        ]}
      />
      <View
        style={[
          bracketBase,
          { bottom: inset, right: inset, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
        ]}
      />
      <View
        style={{
          position: "absolute",
          left: inset,
          right: inset,
          top: "50%",
          height: 1,
          backgroundColor: withAlpha(theme.colors.accent, "55"),
        }}
      />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 14, alignItems: "center" }}>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.size.xs,
            backgroundColor: withAlpha(theme.colors.bg, "b3"),
            borderRadius: 999,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 5,
            overflow: "hidden",
          }}
        >
          Visez le code affiché sur l'écran du PC
        </Text>
      </View>
    </View>
  );
}

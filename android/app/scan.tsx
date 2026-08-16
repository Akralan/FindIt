import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { usePairing } from "@/hooks/usePairing";
import { useTheme } from "@/theme/ThemeProvider";
import type { PairingInfo } from "@/types/document";
import { parsePairingPayload } from "@/utils/qrPayload";

export default function ScanScreen() {
  const theme = useTheme();
  const { setPairing } = usePairing();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasHandledScan, setHasHandledScan] = useState(false);
  // Non-null uniquement le temps de l'écran intermédiaire "rejoins le wifi du
  // PC" (SYNC_CONTRACTS.md §1bis) — le pairing n'est PAS encore enregistré
  // tant que l'utilisateur n'a pas confirmé avoir rejoint le hotspot.
  const [pendingHotspotPairing, setPendingHotspotPairing] = useState<PairingInfo | null>(null);

  const completePairing = useCallback(
    (pairing: PairingInfo) => {
      setPairing(pairing)
        .then(() => {
          Alert.alert("Pairing réussi", `Téléphone associé à ${pairing.host}:${pairing.port}.`, [
            { text: "OK", onPress: () => router.back() },
          ]);
        })
        .catch(() => {
          setHasHandledScan(false);
          setPendingHotspotPairing(null);
          Alert.alert("Erreur", "Impossible d'enregistrer le pairing sur cet appareil.");
        });
    },
    [setPairing],
  );

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasHandledScan) return;
      const pairing = parsePairingPayload(result.data);
      if (!pairing) {
        // Ne jamais journaliser le contenu brut d'un QR code non reconnu (pourrait contenir un token).
        Alert.alert("Code non reconnu", "Ce QR code ne correspond pas au format de pairing FindIt.");
        return;
      }

      setHasHandledScan(true);

      if (pairing.hotspot) {
        // Mode hotspot (SYNC_CONTRACTS.md §1bis) : on n'enregistre rien tant
        // que l'utilisateur n'a pas rejoint le wifi du PC et confirmé.
        setPendingHotspotPairing(pairing);
        return;
      }

      completePairing(pairing);
    },
    [hasHandledScan, completePairing],
  );

  const cancelHotspotJoin = useCallback(() => {
    setPendingHotspotPairing(null);
    setHasHandledScan(false);
  }, []);

  if (!permission) {
    return <Screen />;
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.permissionContainer}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.size.base,
              textAlign: "center",
              marginBottom: theme.spacing.lg,
              lineHeight: theme.typography.lineHeight.base,
            }}
          >
            FindIt a besoin d'accéder à l'appareil photo pour scanner le QR code de pairing affiché sur
            l'application PC.
          </Text>
          <Button label="Autoriser l'appareil photo" onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  if (pendingHotspotPairing?.hotspot) {
    return (
      <HotspotJoinScreen
        hotspot={pendingHotspotPairing.hotspot}
        onConfirm={() => completePairing(pendingHotspotPairing)}
        onCancel={cancelHotspotJoin}
      />
    );
  }

  return (
    <Screen noPadding>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />
      <View style={[styles.overlay, { paddingBottom: theme.spacing.xxl }]} pointerEvents="box-none">
        <Text style={[styles.hint, { color: "#ffffff" }]}>Cadre le QR code affiché sur le PC</Text>
      </View>
    </Screen>
  );
}

interface HotspotJoinScreenProps {
  hotspot: { ssid: string; password: string };
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Écran intermédiaire du mode hotspot (SYNC_CONTRACTS.md §1bis) : affiché à
 * la place de la caméra une fois qu'un QR avec `hotspot` a été scanné, tant
 * que l'utilisateur n'a pas confirmé avoir rejoint le wifi du PC. Le pairing
 * n'est enregistré qu'au clic sur "J'ai rejoint le wifi, continuer".
 */
function HotspotJoinScreen({ hotspot, onConfirm, onCancel }: HotspotJoinScreenProps) {
  const theme = useTheme();
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    Clipboard.setStringAsync(hotspot.password)
      .then((succeeded) => setCopyFailed(!succeeded))
      .catch(() => setCopyFailed(true));
  }, [hotspot.password]);

  const openWifiSettings = useCallback(() => {
    IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.WIFI_SETTINGS).catch(() => {
      Alert.alert(
        "Impossible d'ouvrir les réglages",
        "Ouvre manuellement les réglages Wi-Fi de ton téléphone pour rejoindre le réseau.",
      );
    });
  }, []);

  return (
    <Screen>
      <View style={styles.hotspotContainer}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.size.xl,
            fontWeight: theme.typography.weight.bold,
            lineHeight: theme.typography.lineHeight.xl,
            textAlign: "center",
            marginBottom: theme.spacing.md,
          }}
        >
          Rejoins le wifi du PC pour continuer
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.size.base,
            lineHeight: theme.typography.lineHeight.base,
            textAlign: "center",
            marginBottom: theme.spacing.xl,
          }}
        >
          Ton routeur habituel ne laisse pas ce téléphone et cet ordinateur se voir. Le PC a démarré son propre
          point d'accès pour continuer.
        </Text>

        <View
          style={[
            styles.ssidCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.card },
          ]}
        >
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm, marginBottom: theme.spacing.xs }}>
            Réseau
          </Text>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              marginBottom: theme.spacing.md,
            }}
          >
            {hotspot.ssid}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm }}>
            {copyFailed
              ? "Mot de passe indisponible dans le presse-papier — saisis-le manuellement dans les réglages Wi-Fi."
              : "Mot de passe copié dans le presse-papier."}
          </Text>
        </View>

        <View style={{ height: theme.spacing.xl }} />

        <Button label="Ouvrir les réglages Wi-Fi" variant="secondary" onPress={openWifiSettings} />
        <View style={{ height: theme.spacing.md }} />
        <Button label="J'ai rejoint le wifi, continuer" onPress={onConfirm} />
        <View style={{ height: theme.spacing.md }} />
        <Button label="Annuler" variant="danger" onPress={onCancel} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hint: {
    fontSize: 15,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  hotspotContainer: {
    flex: 1,
    justifyContent: "center",
  },
  ssidCard: {
    borderWidth: 1,
    padding: 16,
  },
});

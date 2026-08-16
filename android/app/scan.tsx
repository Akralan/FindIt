import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { usePairing } from "@/hooks/usePairing";
import { useTheme } from "@/theme/ThemeProvider";
import { parsePairingPayload } from "@/utils/qrPayload";

export default function ScanScreen() {
  const theme = useTheme();
  const { setPairing } = usePairing();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasHandledScan, setHasHandledScan] = useState(false);

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
      setPairing(pairing)
        .then(() => {
          Alert.alert("Pairing réussi", `Téléphone associé à ${pairing.host}:${pairing.port}.`, [
            { text: "OK", onPress: () => router.back() },
          ]);
        })
        .catch(() => {
          setHasHandledScan(false);
          Alert.alert("Erreur", "Impossible d'enregistrer le pairing sur cet appareil.");
        });
    },
    [hasHandledScan, setPairing],
  );

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
});

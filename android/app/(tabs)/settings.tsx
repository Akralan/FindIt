import { router } from "expo-router";
import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { usePairing } from "@/hooks/usePairing";
import { useTheme } from "@/theme/ThemeProvider";

export default function SettingsScreen() {
  const theme = useTheme();
  const { pairing, isLoading, forgetPairing } = usePairing();

  function confirmForget() {
    Alert.alert(
      "Oublier le pairing ?",
      "Le téléphone ne pourra plus synchroniser avec ce PC tant qu'il n'aura pas re-scanné le QR code.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Oublier", style: "destructive", onPress: () => forgetPairing() },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.size.xl,
            fontWeight: theme.typography.weight.bold,
            marginBottom: theme.spacing.lg,
          }}
        >
          Synchro PC
        </Text>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderSubtle,
            borderWidth: 1,
            borderRadius: theme.radii.card,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.lg,
          }}
        >
          {isLoading ? (
            <Text style={{ color: theme.colors.textMuted }}>Chargement…</Text>
          ) : pairing ? (
            <>
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm }}>
                Appareil pairé
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.size.md,
                  fontWeight: theme.typography.weight.semibold,
                  marginTop: theme.spacing.xs,
                }}
              >
                {pairing.host}:{pairing.port}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm }}>
                Aucun appareil pairé
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.size.base,
                  marginTop: theme.spacing.xs,
                  lineHeight: theme.typography.lineHeight.base,
                }}
              >
                Ouvre la page Réglages de l'application PC (section « Synchro »), puis scanne le QR code affiché
                depuis ce téléphone.
              </Text>
            </>
          )}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={pairing ? "Re-scanner un code" : "Scanner un code"}
            onPress={() => router.push("/scan")}
          />
          {pairing && (
            <>
              <Button label="Synchroniser" variant="secondary" onPress={() => router.push("/sync")} />
              <Button label="Oublier le pairing" variant="danger" onPress={confirmForget} />
            </>
          )}
        </View>

        <Text
          style={{
            color: theme.colors.textFaint,
            fontSize: theme.typography.size.xs,
            marginTop: theme.spacing.xl,
            lineHeight: theme.typography.lineHeight.xs,
          }}
        >
          FindIt fonctionne uniquement sur le réseau local (même Wi-Fi que le PC). Aucune donnée n'est envoyée à un
          service tiers.
        </Text>
      </ScrollView>
    </Screen>
  );
}

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { initDatabase } from "@/db/database";
import { Screen } from "@/components/Screen";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

function RootNavigator() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="document/[id]" options={{ title: "Document" }} />
        <Stack.Screen name="sync-review" options={{ title: "Synchronisation" }} />
        <Stack.Screen name="scan" options={{ title: "Scanner un code", presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [dbState, setDbState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    initDatabase()
      .then(() => setDbState("ready"))
      .catch(() => setDbState("error"));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {dbState === "error" ? (
            <Screen>
              <EmptyState
                icon="alert-circle-outline"
                title="Erreur de démarrage"
                message="Impossible d'initialiser le stockage local. Redémarre l'application."
              />
            </Screen>
          ) : dbState === "loading" ? null : (
            <RootNavigator />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

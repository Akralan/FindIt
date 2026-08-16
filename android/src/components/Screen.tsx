import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

interface ScreenProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Désactive le padding horizontal par défaut (ex. pour un contenu plein cadre comme la caméra). */
  noPadding?: boolean;
}

export function Screen({ children, style, noPadding = false }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.bg }]} edges={["top", "left", "right"]}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.bg },
          !noPadding && { paddingHorizontal: theme.spacing.lg },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});

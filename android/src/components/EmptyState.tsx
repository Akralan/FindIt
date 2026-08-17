import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

interface EmptyStateProps {
  /** Nom d'icône Ionicons — voir https://icons.expo.fyi. Par défaut : icône de document. */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon = "document-text-outline", title, message, children }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { padding: theme.spacing.xl }]}>
      <Ionicons name={icon} size={48} color={theme.colors.textMuted} />
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.size.lg,
          fontWeight: theme.typography.weight.semibold,
          textAlign: "center",
          marginTop: theme.spacing.md,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.size.base,
          textAlign: "center",
          marginTop: theme.spacing.sm,
          lineHeight: theme.typography.lineHeight.base,
        }}
      >
        {message}
      </Text>
      {children && <View style={{ marginTop: theme.spacing.lg, width: "100%" }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

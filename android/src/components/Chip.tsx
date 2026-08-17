import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

interface ChipProps {
  label: string;
  /** Absent pour un chip sans état de sélection (ex. puce d'historique de recherche). */
  selected?: boolean;
  onPress: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radii.full,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.colors.onAccent : theme.colors.text,
          fontSize: theme.typography.size.sm,
          fontWeight: theme.typography.weight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    marginRight: 8,
  },
});

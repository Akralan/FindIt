import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sublabel?: string;
}

export function Checkbox({ checked, onToggle, label, sublabel }: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.row,
        {
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.card,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? theme.colors.accent : theme.colors.border,
            backgroundColor: checked ? theme.colors.accent : "transparent",
            borderRadius: 6,
          },
        ]}
      >
        {checked && <Text style={{ color: theme.colors.onAccent, fontSize: 12, fontWeight: "700" }}>✓</Text>}
      </View>
      <View style={styles.textContainer}>
        <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
          {label}
        </Text>
        {sublabel && (
          <Text numberOfLines={1} style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.xs, marginTop: 2 }}>
            {sublabel}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
});

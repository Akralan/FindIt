import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import type { LocalDocument } from "@/types/document";
import { formatBytes, truncate } from "@/utils/format";

interface DocumentRowProps {
  document: LocalDocument;
  onPress: () => void;
}

export function DocumentRow({ document, onPress }: DocumentRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.card,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          numberOfLines={1}
          style={{ color: theme.colors.text, fontSize: theme.typography.size.md, fontWeight: theme.typography.weight.semibold, flex: 1 }}
        >
          {document.currentName}
        </Text>
      </View>

      <View style={[styles.metaRow, { marginTop: theme.spacing.xs }]}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: theme.colors.surfaceHover, borderRadius: theme.radii.full, paddingHorizontal: theme.spacing.sm },
          ]}
        >
          <Text style={{ color: theme.colors.accent, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
            {document.category}
          </Text>
        </View>
        <Text style={{ color: theme.colors.textFaint, fontSize: theme.typography.size.xs, marginLeft: theme.spacing.sm }}>
          {formatBytes(document.sizeBytes)}
        </Text>
      </View>

      {document.summary.length > 0 && (
        <Text
          numberOfLines={2}
          style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm, marginTop: theme.spacing.xs }}
        >
          {truncate(document.summary, 140)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryBadge: {
    paddingVertical: 2,
  },
});

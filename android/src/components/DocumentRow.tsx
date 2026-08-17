import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { monoFontFamily } from "@/theme/tokens";
import { withAlpha } from "@/theme/withAlpha";
import type { LocalDocument } from "@/types/document";
import { formatDate } from "@/utils/format";

import { ChevronRightIcon } from "./icons";

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
          borderColor: theme.colors.border,
          borderRadius: theme.radii.cardLg,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.textColumn}>
        <Text
          numberOfLines={1}
          style={{ color: theme.colors.text, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}
        >
          {document.currentName}
        </Text>

        {document.summary.length > 0 && (
          <Text
            numberOfLines={1}
            style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.sm, marginTop: 3 }}
          >
            {document.summary}
          </Text>
        )}

        <View style={[styles.metaRow, { marginTop: 7 }]}>
          <View
            style={{
              backgroundColor: withAlpha(theme.colors.accent, "1f"),
              borderRadius: 6,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: theme.colors.accent, fontSize: theme.typography.size.xs }}>{document.category}</Text>
          </View>
          <Text
            style={{
              color: theme.colors.textFaint,
              fontSize: 11,
              marginLeft: theme.spacing.sm,
              fontFamily: monoFontFamily,
            }}
          >
            {formatDate(document.documentDate)}
          </Text>
        </View>
      </View>

      <ChevronRightIcon size={14} color={theme.colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});

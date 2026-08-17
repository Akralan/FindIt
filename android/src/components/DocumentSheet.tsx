/**
 * Bottom sheet de détail document — point d'entrée principal depuis l'écran
 * Rechercher (remplace la navigation plein écran vers `document/[id].tsx`
 * pour ce cas d'usage ; cet écran reste disponible comme route à part,
 * voir ARCHITECTURE.md). Action principale = ouvrir le fichier déjà copié en
 * local sur le téléphone (`useOpenLocalFile`), jamais "ouvrir sur le PC" —
 * on n'a pas besoin du PC pour consulter un document déjà synchronisé.
 */

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { monoFontFamily } from "@/theme/tokens";
import { withAlpha } from "@/theme/withAlpha";
import type { LocalDocument } from "@/types/document";
import { formatBytes, formatDate } from "@/utils/format";

import { Button } from "./Button";

interface DocumentSheetProps {
  document: LocalDocument | null;
  onClose: () => void;
  onOpenFile: (document: LocalDocument) => void;
  isOpening: boolean;
}

export function DocumentSheet({ document, onClose, onOpenFile, isOpening }: DocumentSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={document !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdropContainer}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,7,6,0.6)" }]}
          onPress={onClose}
          accessibilityLabel="Fermer"
        />

        {document && (
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderTopLeftRadius: theme.radii.cardLg + 6,
                borderTopRightRadius: theme.radii.cardLg + 6,
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.xxl,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

            <View style={{ marginTop: theme.spacing.md }}>
              <View style={styles.badgeRow}>
                <View
                  style={{
                    backgroundColor: withAlpha(theme.colors.accent, "1f"),
                    borderRadius: 6,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: theme.colors.accent, fontSize: theme.typography.size.xs }}>
                    {document.category}
                  </Text>
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

              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.size.lg,
                  fontWeight: theme.typography.weight.semibold,
                  marginTop: theme.spacing.sm,
                }}
              >
                {document.currentName}
              </Text>

              {document.summary.length > 0 && (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.size.base,
                    lineHeight: theme.typography.lineHeight.base,
                    marginTop: theme.spacing.sm,
                  }}
                >
                  {document.summary}
                </Text>
              )}
            </View>

            <View
              style={[
                styles.statsRow,
                { borderTopColor: theme.colors.borderSubtle, marginTop: theme.spacing.lg, paddingTop: theme.spacing.md },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textFaint, fontSize: theme.typography.size.xs }}>Mis à jour</Text>
                <Text
                  style={{ color: theme.colors.text, fontSize: theme.typography.size.sm, fontFamily: monoFontFamily, marginTop: 3 }}
                >
                  {formatDate(document.updatedAt)}
                </Text>
              </View>
              <View>
                <Text style={{ color: theme.colors.textFaint, fontSize: theme.typography.size.xs }}>Taille</Text>
                <Text
                  style={{ color: theme.colors.text, fontSize: theme.typography.size.sm, fontFamily: monoFontFamily, marginTop: 3 }}
                >
                  {formatBytes(document.sizeBytes)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
              <Button label="Ouvrir le document" onPress={() => onOpenFile(document)} loading={isOpening} />
              <Button label="Fermer" variant="secondary" onPress={onClose} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 999,
    alignSelf: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
});

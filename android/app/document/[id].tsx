import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Dimensions, Image, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { getLocalDocument } from "@/db/documents";
import { openFileExternally } from "@/storage/fileStorage";
import { useTheme } from "@/theme/ThemeProvider";
import type { LocalDocument } from "@/types/document";
import { formatBytes, formatDate } from "@/utils/format";

export default function DocumentDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<LocalDocument | null | undefined>(undefined);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    if (!id) return;
    getLocalDocument(id).then(setDoc);
  }, [id]);

  if (doc === undefined) {
    return <Screen />;
  }

  if (doc === null) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="Document introuvable" message="Ce document n'existe plus en local." />
      </Screen>
    );
  }

  const isImage = doc.mimeType.startsWith("image/");

  async function handleOpenFile() {
    if (!doc) return;
    setIsOpening(true);
    try {
      await openFileExternally(doc.localFilePath, doc.mimeType);
    } catch {
      Alert.alert("Impossible d'ouvrir le fichier", "Aucune application compatible n'a été trouvée sur cet appareil.");
    } finally {
      setIsOpening(false);
    }
  }

  const screenWidth = Dimensions.get("window").width;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.lg }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.size.xl,
            fontWeight: theme.typography.weight.bold,
          }}
        >
          {doc.currentName}
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: theme.spacing.sm,
            gap: theme.spacing.sm,
          }}
        >
          <MetaBadge label={doc.category} />
          <MetaBadge label={formatBytes(doc.sizeBytes)} />
          <MetaBadge label={formatDate(doc.documentDate)} />
        </View>

        {doc.summary.length > 0 && (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.size.base,
              lineHeight: theme.typography.lineHeight.base,
              marginTop: theme.spacing.lg,
            }}
          >
            {doc.summary}
          </Text>
        )}

        <View style={{ marginTop: theme.spacing.xl }}>
          {isImage ? (
            <ScrollView
              minimumZoomScale={1}
              maximumZoomScale={4}
              style={{
                width: "100%",
                height: screenWidth,
                borderRadius: theme.radii.card,
                backgroundColor: theme.colors.surfaceHover,
              }}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <Image
                source={{ uri: doc.localFilePath }}
                style={{ width: screenWidth - theme.spacing.lg * 2, height: screenWidth, borderRadius: theme.radii.card }}
                resizeMode="contain"
              />
            </ScrollView>
          ) : (
            <Button label="Ouvrir le document" onPress={handleOpenFile} loading={isOpening} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function MetaBadge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.borderSubtle,
        borderWidth: 1,
        borderRadius: theme.radii.full,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
        {label}
      </Text>
    </View>
  );
}

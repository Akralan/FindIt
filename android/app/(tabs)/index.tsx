import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { Button } from "@/components/Button";
import { DocumentRow } from "@/components/DocumentRow";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SearchBar } from "@/components/SearchBar";
import { useDocuments } from "@/hooks/useDocuments";
import { usePairing } from "@/hooks/usePairing";
import { searchDocuments } from "@/search/fuzzy";
import { useTheme } from "@/theme/ThemeProvider";

export default function DocumentsScreen() {
  const theme = useTheme();
  const { pairing, isLoading: isPairingLoading } = usePairing();
  const { documents, isLoading: isDocumentsLoading, refresh } = useDocuments();
  const [query, setQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filteredDocuments = useMemo(() => {
    if (query.trim().length === 0) return documents;
    return searchDocuments(documents, query).map((result) => result.document);
  }, [documents, query]);

  const isLoading = isPairingLoading || isDocumentsLoading;

  return (
    <Screen>
      <View style={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      {!isLoading && documents.length === 0 ? (
        !pairing ? (
          <EmptyState
            icon="📱"
            title="Aucun appareil pairé"
            message="Scanne le QR code affiché dans les Réglages de l'application PC pour associer ce téléphone, puis synchronise tes documents."
          >
            <Button label="Aller aux Réglages" onPress={() => router.push("/(tabs)/settings")} />
          </EmptyState>
        ) : (
          <EmptyState
            icon="🗂️"
            title="Aucun document local"
            message="Lance une synchronisation pour récupérer les documents confirmés sur le PC."
          >
            <Button label="Synchroniser" onPress={() => router.push("/sync")} />
          </EmptyState>
        )
      ) : filteredDocuments.length === 0 && query.trim().length > 0 ? (
        <EmptyState icon="🔍" title="Aucun résultat" message={`Aucun document ne correspond à « ${query} ».`} />
      ) : (
        <FlatList
          data={filteredDocuments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DocumentRow document={item} onPress={() => router.push(`/document/${item.id}`)} />
          )}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        />
      )}
    </Screen>
  );
}

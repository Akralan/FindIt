import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { SearchIcon } from "./icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Appelé quand l'utilisateur valide la recherche (touche "Rechercher" du clavier). */
  onSubmit?: () => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, onSubmit, placeholder = "Rechercher un document…" }: SearchBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.card,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <SearchIcon size={18} color={theme.colors.accent} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        style={[
          styles.input,
          { color: theme.colors.text, fontSize: theme.typography.size.base, paddingVertical: theme.spacing.md },
        ]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} hitSlop={8} accessibilityLabel="Effacer" style={styles.clearButton}>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.size.md }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  input: {
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
});

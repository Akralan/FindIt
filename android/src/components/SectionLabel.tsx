import React from "react";
import { Text } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** Petit intitulé de section en majuscules espacées ("RECHERCHES RÉCENTES", "24 RÉSULTATS"…). */
export function SectionLabel({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <Text
      style={{
        color: theme.colors.textFaint,
        fontSize: 11,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        fontWeight: theme.typography.weight.medium,
      }}
    >
      {text}
    </Text>
  );
}

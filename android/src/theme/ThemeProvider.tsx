import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors, type ColorTokens } from "./colors";
import { radii, spacing, typography } from "./tokens";

export interface Theme {
  colorScheme: "light" | "dark";
  colors: ColorTokens;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);

function buildTheme(colorScheme: "light" | "dark"): Theme {
  return {
    colorScheme,
    colors: colorScheme === "dark" ? darkColors : lightColors,
    radii,
    spacing,
    typography,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const theme = useMemo(() => buildTheme(systemScheme === "dark" ? "dark" : "light"), [systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme doit être utilisé à l'intérieur de <ThemeProvider>.");
  }
  return theme;
}

/**
 * Rayons de bordure et espacements — portés depuis `../../tailwind.config.ts`
 * (`borderRadius.card` / `borderRadius.card-lg`) et les usages courants du
 * webapp (échelle d'espacement Tailwind par défaut, base 4px).
 */

export const radii = {
  card: 12,
  cardLg: 16,
  full: 999,
};

/** Échelle d'espacement, base 4px (équivalent Tailwind par défaut). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/**
 * Échelle typographique. Pas de police custom embarquée pour cette v1 (voir
 * ARCHITECTURE.md) — on s'appuie sur la police système de chaque plateforme,
 * ce qui reste cohérent avec la pile de fallback `-apple-system,
 * BlinkMacSystemFont, "Segoe UI"` du webapp. Tailles/poids/interlignage
 * portés à l'identique.
 */
export const typography = {
  size: {
    xs: 12,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  lineHeight: {
    xs: 16,
    sm: 18,
    base: 22,
    md: 24,
    lg: 26,
    xl: 30,
    xxl: 36,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

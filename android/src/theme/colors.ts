/**
 * Palette portée depuis `../../src/app/globals.css` (source de vérité webapp).
 * Chaque token est redéfini indépendamment en mode sombre — jamais une simple
 * inversion — pour rester cohérent avec la doctrine du webapp.
 *
 * IMPORTANT : si le webapp fait évoluer `globals.css`, reporter les mêmes
 * valeurs ici à la main (pas de partage de fichier CSS entre les deux
 * plateformes).
 */

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderSubtle: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentHover: string;
  danger: string;
  success: string;
  warning: string;
  warningBg: string;
  warningDot: string;
  /** Toujours blanc, quel que soit le thème — texte sur fond accent plein. */
  onAccent: string;
}

export const lightColors: ColorTokens = {
  bg: "#f7f8f7",
  surface: "#ffffff",
  surfaceHover: "#f4f6f4",
  border: "#e5e8e5",
  borderSubtle: "#eff2ef",
  text: "#16181a",
  textMuted: "#6b7370",
  textFaint: "#9aa19d",
  accent: "#2f6b57",
  accentHover: "#245443",
  danger: "#a0392f",
  success: "#2f6b57",
  warning: "#8a6a20",
  warningBg: "#fbf3e3",
  warningDot: "#c8963e",
  onAccent: "#ffffff",
};

export const darkColors: ColorTokens = {
  bg: "#101211",
  surface: "#171918",
  surfaceHover: "#1f2321",
  border: "#2a2e2b",
  borderSubtle: "#232625",
  text: "#f2f4f2",
  textMuted: "#9aa6a0",
  textFaint: "#74807a",
  accent: "#4c9c81",
  accentHover: "#5fb394",
  danger: "#e2685a",
  success: "#4c9c81",
  warning: "#e4b65a",
  warningBg: "#3a2e12",
  warningDot: "#d9a544",
  onAccent: "#ffffff",
};

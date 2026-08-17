/**
 * Ajoute un canal alpha à une couleur hex `#RRGGBB` des tokens de thème
 * (`src/theme/colors.ts`), pour les fonds teintés semi-transparents (badges
 * de catégorie, icônes sur fond accent atténué…) sans jamais coder une
 * couleur en dur — la teinte de base reste un token de thème.
 */
export function withAlpha(hexColor: string, alphaHex: string): string {
  return `${hexColor}${alphaHex}`;
}

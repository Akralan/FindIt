/**
 * Icônes SVG portées telles quelles depuis les tracés du mockup (mêmes
 * `viewBox`/`d`/`stroke-width`) — `react-native-svg` plutôt que des glyphes
 * emoji/texte pour ces icônes de navigation et d'action, cohérent avec le
 * reste de l'identité visuelle du webapp portée dans `src/theme/`.
 */

import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
  color: string;
}

/** Loupe — onglet "Rechercher" et champ de recherche. */
export function SearchIcon({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx={7} cy={7} r={5.2} stroke={color} strokeWidth={1.6} />
      <Path d="M11 11L14.5 14.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Grille + flèches de synchro — onglet "Sync". */
export function SyncIcon({ size = 21, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Rect x={2.2} y={2.2} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.5} />
      <Rect x={10.6} y={2.2} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.5} />
      <Rect x={2.2} y={10.6} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.5} />
      <Path
        d="M10.6 11.4h2.2v2.2M15.8 15.8h-2.2v-2.2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Chevron simple — indique qu'une ligne de résultat ouvre le détail. */
export function ChevronRightIcon({ size = 14, color }: IconProps) {
  const width = (size * 8) / 14;
  return (
    <Svg width={width} height={size} viewBox="0 0 8 14" fill="none">
      <Path d="M1 1l6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Coche — statut "connecté" de la carte de pairing. */
export function CheckIcon({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3.5 9.5l3.5 3.5 7.5-8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

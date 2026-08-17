/** Formatage d'affichage — texte utilisateur en français. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/** Date ISO (YYYY-MM-DD ou date-heure complète) -> format lisible fr-FR. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "Date inconnue";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Horodatage ISO -> durée relative lisible ("il y a 2 min", "il y a 3 h"…).
 * `null`/`undefined`/invalide -> "Jamais" (jamais de valeur inventée quand
 * rien n'a encore été suivi — voir `src/storage/syncMeta.ts`).
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Jamais";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Jamais";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.round(diffH / 24);
  return `il y a ${diffJ} j`;
}

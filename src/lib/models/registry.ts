/**
 * Registre du (des) modèle(s) LLM local(aux) utilisable(s) par le provider
 * `local` (`src/lib/providers/local.ts`). Un seul modèle actif pour
 * l'instant, choisi pour la tâche d'extraction (nom + catégorie + résumé +
 * date à partir d'un texte déjà obtenu — pas de raisonnement complexe, pas
 * de vision) : petit, rapide sur CPU, licence permissive.
 *
 * Changer de modèle par défaut = changer `ACTIVE_LOCAL_MODEL` ci-dessous,
 * rien d'autre à toucher dans l'app (le téléchargement, le cache et le
 * provider travaillent sur `LocalModelInfo`, jamais sur un nom en dur).
 */

export interface LocalModelInfo {
  /** Identifiant stable, utilisé comme sous-dossier de cache. */
  id: string;
  /** Nom affichable dans les Réglages. */
  label: string;
  /**
   * URI au format node-llama-cpp : `hf:<user>/<repo>/<fichier>#<branche>`.
   * Pointer un fichier précis (plutôt que `hf:<user>/<repo>:<quant>`) pour
   * un téléchargement déterministe.
   */
  uri: string;
  /** Taille approximative du fichier, en octets — affichée avant téléchargement. */
  approxSizeBytes: number;
  license: string;
}

export const ACTIVE_LOCAL_MODEL: LocalModelInfo = {
  id: "qwen2.5-1.5b-instruct-q4_k_m",
  label: "Qwen2.5 1.5B Instruct (Q4_K_M)",
  uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF/qwen2.5-1.5b-instruct-q4_k_m.gguf",
  approxSizeBytes: 1_117_320_736,
  license: "Apache 2.0",
};

/**
 * Utilitaires partagés entre providers IA — prompt d'extraction, parsing et
 * validation du JSON renvoyé par le modèle. Un provider concret (openai.ts,
 * local.ts...) reste seul responsable de l'appel réseau/local et de la
 * traduction de ses erreurs spécifiques en messages clairs ; ce fichier ne
 * dépend d'aucun SDK.
 */

import type { ExtractionResult } from "@/lib/types";

/** Longueur minimale de textHint en dessous de laquelle on considère qu'il n'y a pas de texte exploitable. */
export const TEXT_HINT_MIN_LENGTH = 40;

export const EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant de classement documentaire. À partir du contenu d'un document (image ou texte), tu dois produire une extraction structurée.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, respectant exactement ce schéma :
{
  "suggestedName": string,      // nom de fichier suggéré avec extension, sans chemin, sans espaces (utilise des tirets), ex: "facture-edf-2026-03.pdf"
  "suggestedCategory": string,  // catégorie/dossier suggéré, ex: "Factures", "Contrats", "Identité", "Banque", "Santé", "Divers"
  "summary": string,            // résumé court du document, 1 à 2 phrases, en français
  "documentDate": string | null // date du document au format ISO YYYY-MM-DD si détectée, sinon null
}

Ne renvoie rien d'autre que ce JSON. Ne renvoie jamais le texte intégral du document : seulement ces champs de synthèse.`;

interface RawExtraction {
  suggestedName?: unknown;
  suggestedCategory?: unknown;
  summary?: unknown;
  documentDate?: unknown;
}

/**
 * Parse et valide la réponse JSON d'un provider. `providerLabel` ne sert
 * qu'au message d'erreur (ex: "OpenAI", "local").
 */
export function parseExtractionResult(content: string, providerLabel: string): ExtractionResult {
  let raw: RawExtraction;
  try {
    raw = JSON.parse(content) as RawExtraction;
  } catch {
    throw new Error(
      `La réponse du provider ${providerLabel} n'est pas un JSON valide. Réessayez ou changez de modèle dans les Réglages.`
    );
  }

  const suggestedName =
    typeof raw.suggestedName === "string" && raw.suggestedName.length > 0
      ? raw.suggestedName
      : "document-sans-nom";
  const suggestedCategory =
    typeof raw.suggestedCategory === "string" && raw.suggestedCategory.length > 0
      ? raw.suggestedCategory
      : "Divers";
  const summary = typeof raw.summary === "string" ? raw.summary : "";
  const documentDate =
    typeof raw.documentDate === "string" && raw.documentDate.length > 0
      ? raw.documentDate
      : undefined;

  return {
    suggestedName,
    suggestedCategory,
    summary,
    documentDate,
  };
}

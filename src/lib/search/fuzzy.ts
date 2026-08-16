/**
 * Recherche par correspondance floue (fuzzy matching) sur les métadonnées du
 * document : nom, catégorie, résumé. Pas d'appel IA, pas d'embedding — à
 * l'échelle d'une bibliothèque personnelle (des dizaines/centaines de
 * documents, pas des millions), un score textuel bien conçu sur des champs
 * déjà écrits par l'IA à l'extraction est plus simple, gratuit et plus
 * prévisible qu'une similarité vectorielle : il ne renvoie jamais un
 * document totalement hors-sujet avec un score non nul.
 */

import { listDocuments } from "@/lib/db/documents";
import type { DocumentSummary, SearchResult } from "@/lib/types";

/** Nombre maximal de résultats renvoyés. */
const MAX_RESULTS = 20;

/** Normalise pour la comparaison : minuscules, sans accents, espaces réduits. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

/**
 * Score de correspondance d'un token de requête contre un champ de texte :
 * - 3 points si le champ contient le token comme mot entier
 * - 1.5 point si le champ contient le token comme sous-chaîne
 * - jusqu'à 1 point si un mot du champ commence par le token (préfixe d'au
 *   moins 3 caractères), proportionnel à la longueur commune — tolère les
 *   fautes de frappe/formes fléchies ("factur" -> "facture", "factures")
 * - 0 sinon
 */
function matchTokenAgainstField(token: string, fieldNormalized: string, fieldTokens: string[]): number {
  if (fieldTokens.includes(token)) return 3;
  if (fieldNormalized.includes(token)) return 1.5;

  if (token.length >= 3) {
    for (const fieldToken of fieldTokens) {
      if (fieldToken.startsWith(token) || token.startsWith(fieldToken)) {
        const commonLength = Math.min(token.length, fieldToken.length);
        return Math.min(1, commonLength / Math.max(token.length, fieldToken.length));
      }
    }
  }

  return 0;
}

/** Poids relatif de chaque champ dans le score final. */
const FIELD_WEIGHTS: { field: keyof Pick<DocumentSummary, "currentName" | "category" | "summary">; weight: number }[] = [
  { field: "currentName", weight: 2 },
  { field: "category", weight: 1.5 },
  { field: "summary", weight: 1 },
];

function scoreDocument(document: DocumentSummary, queryTokens: string[]): number {
  let total = 0;

  for (const { field, weight } of FIELD_WEIGHTS) {
    const raw = document[field] ?? "";
    const fieldNormalized = normalize(raw);
    const fieldTokens = tokenize(raw);

    for (const token of queryTokens) {
      total += matchTokenAgainstField(token, fieldNormalized, fieldTokens) * weight;
    }
  }

  return total;
}

/**
 * Recherche des documents pertinents pour une requête en langage naturel.
 * Ne renvoie que des documents ayant au moins une correspondance réelle
 * (score > 0) sur le nom, la catégorie ou le résumé — jamais de résultat
 * hors-sujet juste pour remplir la liste. Le score n'a pas de sens en
 * pourcentage : il ne sert qu'au tri, pas à l'affichage.
 */
export async function searchDocuments(query: string): Promise<SearchResult[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return [];
  }

  const documents = await listDocuments();

  return documents
    .map((document) => ({ document, score: scoreDocument(document, queryTokens) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

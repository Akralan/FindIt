/**
 * Recherche sémantique sur les documents : similarité cosinus entre
 * l'embedding de la requête et celui de chaque document, avec repli sur une
 * recherche texte simple si aucun document n'a d'embedding.
 */

import { getProvider } from "@/lib/providers";
import { listDocuments, getDocument } from "@/lib/db/documents";
import type { DocumentSummary, SearchResult } from "@/lib/types";

/** Nombre maximal de résultats renvoyés. */
const MAX_RESULTS = 20;

/**
 * Similarité cosinus entre deux vecteurs. Retourne 0 si les vecteurs sont
 * vides, de longueurs différentes, ou de norme nulle (au lieu de NaN).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Recherche des documents pertinents pour une requête en langage naturel.
 *
 * Si au moins un document possède un embedding : embed la requête via le
 * provider IA actif, calcule la similarité cosinus contre chaque document
 * ayant un embedding, trie par score décroissant et retourne les 20
 * meilleurs résultats.
 *
 * Sinon (aucun document n'a d'embedding, ex: MockProvider ou base neuve) :
 * repli sur une recherche texte simple (sous-chaîne, insensible à la casse)
 * sur `currentName` et `summary`.
 */
export async function searchDocuments(query: string): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return [];
  }

  const summaries = await listDocuments();

  const embedded: { document: DocumentSummary; embedding: number[] }[] = [];
  for (const summary of summaries) {
    const full = await getDocument(summary.id);
    if (full?.embedding && full.embedding.length > 0) {
      embedded.push({ document: summary, embedding: full.embedding });
    }
  }

  if (embedded.length === 0) {
    return fallbackTextSearch(summaries, trimmedQuery);
  }

  const provider = await getProvider();
  const queryEmbedding = await provider.embed(trimmedQuery);

  return embedded
    .map(({ document, embedding }) => ({
      document,
      score: cosineSimilarity(queryEmbedding, embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

/** Recherche texte simple (sous-chaîne, insensible à la casse) en repli. */
function fallbackTextSearch(summaries: DocumentSummary[], query: string): SearchResult[] {
  const needle = query.toLowerCase();

  return summaries
    .filter((document) => {
      const haystack = `${document.currentName} ${document.summary}`.toLowerCase();
      return haystack.includes(needle);
    })
    .map((document) => ({ document, score: 1 }))
    .slice(0, MAX_RESULTS);
}

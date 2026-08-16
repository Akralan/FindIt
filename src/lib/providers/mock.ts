/**
 * Provider factice — aucun appel réseau. Utile pour développer/tester/faire
 * une démo sans clé API. Les valeurs retournées sont déterministes : elles
 * dépendent uniquement du nom de fichier et/ou du texte fourni, jamais du
 * hasard "vrai" (pas de Math.random pur).
 */

import type { AIProvider, ExtractInput, ExtractionResult } from "@/lib/types";

const MOCK_CATEGORIES = [
  "Factures",
  "Contrats",
  "Identité",
  "Banque",
  "Santé",
  "Divers",
];

/** Hash simple et stable (FNV-1a 32 bits) pour dériver un pseudo-aléatoire déterministe. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32), seedé par un hash de texte. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

function getExtension(fileName: string, mimeType: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx > 0) {
    return fileName.slice(idx);
  }
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType.startsWith("image/")) {
    const sub = mimeType.split("/")[1] ?? "png";
    return `.${sub}`;
  }
  return "";
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class MockProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly label = "Mock (aucun appel réseau, données de démonstration)";

  async extractDocument(input: ExtractInput): Promise<ExtractionResult> {
    const baseName = stripExtension(input.fileName);
    const seed = hashString(input.fileName + input.mimeType);
    const random = seededRandom(seed);

    const category = MOCK_CATEGORIES[Math.floor(random() * MOCK_CATEGORIES.length)];
    const slug = slugify(baseName) || "document";
    const extension = getExtension(input.fileName, input.mimeType);

    const year = 2020 + Math.floor(random() * 6);
    const month = String(1 + Math.floor(random() * 12)).padStart(2, "0");
    const day = String(1 + Math.floor(random() * 28)).padStart(2, "0");
    const documentDate = `${year}-${month}-${day}`;

    const tagPool = ["important", "à-classer", "personnel", "pro", "urgent", "archive"];
    const tagCount = 1 + Math.floor(random() * 3);
    const tags: string[] = [];
    for (let i = 0; i < tagCount; i++) {
      const tag = tagPool[Math.floor(random() * tagPool.length)];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    const text =
      input.textHint && input.textHint.length > 0
        ? input.textHint
        : `Texte simulé extrait de "${input.fileName}" (provider mock, aucun contenu réel n'a été lu).`;

    return {
      text,
      suggestedName: `${slug}-${documentDate}${extension}`,
      suggestedCategory: category,
      suggestedTags: tags,
      summary: `Document "${baseName}" classé automatiquement (données de démonstration, provider mock).`,
      documentDate,
    };
  }

  async embed(text: string): Promise<number[]> {
    const seed = hashString(text);
    const random = seededRandom(seed);
    const dimensions = 32;
    const vector: number[] = [];
    for (let i = 0; i < dimensions; i++) {
      // Composantes dans [-1, 1], déterministes à partir du texte.
      vector.push(random() * 2 - 1);
    }
    return vector;
  }
}

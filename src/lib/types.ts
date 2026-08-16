/**
 * Contrats partagés de l'application. Ce fichier est la source de vérité :
 * toute évolution de forme (DB, API, providers) part d'ici.
 */

// ---------------------------------------------------------------------------
// Provider IA — c'est le point d'extension central du projet. Ajouter un
// provider = créer une classe qui implémente AIProvider dans
// src/lib/providers/, puis l'enregistrer dans src/lib/providers/index.ts.
// Rien d'autre dans l'app ne dépend d'un provider en particulier.
// ---------------------------------------------------------------------------

export type ProviderId = "openai" | "mock";

export interface ExtractInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  /** Texte déjà extrait localement (ex: couche texte d'un PDF), si disponible. */
  textHint?: string;
}

export interface ExtractionResult {
  /** Texte intégral extrait du document (OCR ou texte natif). */
  text: string;
  /** Nom de fichier suggéré, avec extension, sans chemin. */
  suggestedName: string;
  /** Catégorie suggérée (nom de dossier), ex: "Factures", "Contrats". */
  suggestedCategory: string;
  suggestedTags: string[];
  /** Résumé court (1-2 phrases). */
  summary: string;
  /** Date du document si détectée, format ISO (YYYY-MM-DD). */
  documentDate?: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly label: string;
  extractDocument(input: ExtractInput): Promise<ExtractionResult>;
  embed(text: string): Promise<number[]>;
}

export interface ProviderConfig {
  provider: ProviderId;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiEmbeddingModel?: string;
}

/** Ce que l'API renvoie pour la config — jamais la clé API en clair. */
export interface ProviderConfigPublic {
  provider: ProviderId;
  openaiModel?: string;
  openaiEmbeddingModel?: string;
  hasApiKey: boolean;
  availableProviders: { id: ProviderId; label: string; requiresApiKey: boolean }[];
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentStatus = "pending_review" | "confirmed";

export interface DocumentRecord {
  id: string;
  originalName: string;
  currentName: string;
  category: string;
  tags: string[];
  summary: string;
  extractedText: string;
  /** Chemin relatif à DATA_DIR/files, ex: "Factures/edf-2026-03.pdf". */
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  documentDate?: string;
  status: DocumentStatus;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}

/** DocumentRecord sans le texte intégral ni l'embedding — pour les listes. */
export type DocumentSummary = Omit<DocumentRecord, "extractedText" | "embedding">;

export type DocumentEventType = "create" | "rename" | "move" | "edit" | "delete";

export interface DocumentEvent {
  id: string;
  documentId: string;
  type: DocumentEventType;
  before: Partial<DocumentRecord> | null;
  after: Partial<DocumentRecord> | null;
  createdAt: string;
}

export interface SearchResult {
  document: DocumentSummary;
  score: number;
}

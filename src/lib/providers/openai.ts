/**
 * Provider OpenAI — utilise le SDK officiel "openai". Toute erreur d'appel
 * API (clé invalide, quota dépassé, timeout réseau...) est catchée et
 * relancée comme une Error au message clair, actionnable et en français,
 * affichable tel quel côté UI. La clé API n'est jamais loguée.
 */

import OpenAI from "openai";
import type { AIProvider, ExtractInput, ExtractionResult } from "@/lib/types";

const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/** Longueur minimale de textHint en dessous de laquelle on considère qu'il n'y a pas de texte exploitable. */
const TEXT_HINT_MIN_LENGTH = 40;

const EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant de classement documentaire. À partir du contenu d'un document (image ou texte), tu dois produire une extraction structurée.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, respectant exactement ce schéma :
{
  "text": string,               // texte intégral du document tel que tu peux le lire (OCR si image) ; chaîne vide si vraiment illisible
  "suggestedName": string,      // nom de fichier suggéré avec extension, sans chemin, sans espaces (utilise des tirets), ex: "facture-edf-2026-03.pdf"
  "suggestedCategory": string,  // catégorie/dossier suggéré, ex: "Factures", "Contrats", "Identité", "Banque", "Santé", "Divers"
  "suggestedTags": string[],    // 1 à 5 mots-clés pertinents
  "summary": string,            // résumé court du document, 1 à 2 phrases, en français
  "documentDate": string | null // date du document au format ISO YYYY-MM-DD si détectée, sinon null
}

Ne renvoie rien d'autre que ce JSON.`;

interface RawExtraction {
  text?: unknown;
  suggestedName?: unknown;
  suggestedCategory?: unknown;
  suggestedTags?: unknown;
  summary?: unknown;
  documentDate?: unknown;
}

function toApiError(error: unknown, context: string): Error {
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status === 401) {
      return new Error(
        `Clé API OpenAI invalide ou manquante (${context}). Vérifiez la clé dans les Réglages.`
      );
    }
    if (status === 429) {
      return new Error(
        `Quota OpenAI dépassé ou trop de requêtes (${context}). Réessayez plus tard ou vérifiez votre facturation OpenAI.`
      );
    }
    if (status && status >= 500) {
      return new Error(
        `Le service OpenAI est indisponible pour le moment (${context}). Réessayez plus tard.`
      );
    }
    return new Error(
      `Erreur OpenAI (${context}) : ${error.message || "erreur inconnue"}.`
    );
  }
  if (error instanceof Error) {
    return new Error(`Erreur lors de l'appel OpenAI (${context}) : ${error.message}`);
  }
  return new Error(`Erreur inconnue lors de l'appel OpenAI (${context}).`);
}

function parseExtractionResult(content: string, fallbackText?: string): ExtractionResult {
  let raw: RawExtraction;
  try {
    raw = JSON.parse(content) as RawExtraction;
  } catch {
    throw new Error(
      "La réponse du provider OpenAI n'est pas un JSON valide. Réessayez ou changez de modèle dans les Réglages."
    );
  }

  const text =
    typeof raw.text === "string" && raw.text.length > 0
      ? raw.text
      : fallbackText ?? "";
  const suggestedName =
    typeof raw.suggestedName === "string" && raw.suggestedName.length > 0
      ? raw.suggestedName
      : "document-sans-nom";
  const suggestedCategory =
    typeof raw.suggestedCategory === "string" && raw.suggestedCategory.length > 0
      ? raw.suggestedCategory
      : "Divers";
  const suggestedTags = Array.isArray(raw.suggestedTags)
    ? raw.suggestedTags.filter((t): t is string => typeof t === "string")
    : [];
  const summary = typeof raw.summary === "string" ? raw.summary : "";
  const documentDate =
    typeof raw.documentDate === "string" && raw.documentDate.length > 0
      ? raw.documentDate
      : undefined;

  return {
    text,
    suggestedName,
    suggestedCategory,
    suggestedTags,
    summary,
    documentDate,
  };
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  readonly label = "OpenAI";

  private client: OpenAI;
  private chatModel: string;
  private embeddingModel: string;

  constructor(options: { apiKey: string; model?: string; embeddingModel?: string }) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.chatModel = options.model || DEFAULT_CHAT_MODEL;
    this.embeddingModel = options.embeddingModel || DEFAULT_EMBEDDING_MODEL;
  }

  async extractDocument(input: ExtractInput): Promise<ExtractionResult> {
    if (input.mimeType.startsWith("image/")) {
      return this.extractFromImage(input);
    }

    if (input.mimeType === "application/pdf") {
      if (input.textHint && input.textHint.trim().length >= TEXT_HINT_MIN_LENGTH) {
        return this.extractFromText(input.textHint, input.fileName);
      }
      // Pas de texte exploitable : l'appelant (src/lib/extraction) est
      // responsable de fournir une image (buffer/mimeType: "image/png") à
      // la place. Si on arrive ici sans image, on ne peut rien faire de bon.
      throw new Error(
        "Impossible d'extraire le texte de ce PDF : aucun texte natif exploitable et aucune image de la page n'a été fournie."
      );
    }

    // text/plain, text/markdown, etc. : utiliser le buffer comme texte brut.
    const text = input.buffer.toString("utf-8");
    return this.extractFromText(text, input.fileName);
  }

  private async extractFromImage(input: ExtractInput): Promise<ExtractionResult> {
    try {
      const dataUrl = `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;
      const response = await this.client.chat.completions.create({
        model: this.chatModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Nom de fichier d'origine : "${input.fileName}". Analyse ce document et renvoie le JSON demandé.`,
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Réponse vide du provider OpenAI.");
      }
      return parseExtractionResult(content);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw toApiError(error, "extraction image");
      }
      throw error;
    }
  }

  private async extractFromText(text: string, fileName: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.chatModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Nom de fichier d'origine : "${fileName}". Voici le texte du document :\n\n${text}\n\nAnalyse ce document et renvoie le JSON demandé.`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Réponse vide du provider OpenAI.");
      }
      return parseExtractionResult(content, text);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw toApiError(error, "extraction texte");
      }
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });
      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error("Réponse d'embedding vide du provider OpenAI.");
      }
      return embedding;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw toApiError(error, "embedding");
      }
      throw error;
    }
  }
}

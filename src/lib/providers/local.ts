/**
 * Provider local — llama.cpp embarqué dans le process (`node-llama-cpp`),
 * aucun serveur externe, aucun appel réseau après le tout premier
 * téléchargement du modèle (voir `src/lib/models/`). Utilise le petit
 * modèle instruct du registre (`src/lib/models/registry.ts`) pour
 * l'extraction texte, et l'OCR local (`src/lib/ocr/`) pour convertir une
 * image/scan en texte avant de la lui soumettre — pas de modèle vision,
 * cette app ne traite que des documents.
 *
 * Le modèle et le contexte llama.cpp sont chargés une seule fois (coûteux)
 * et réutilisés entre les appels ; chaque extraction obtient sa propre
 * séquence de contexte, jetée après usage, pour rester un échange à un
 * seul tour (pas d'historique de conversation qui s'accumule entre deux
 * documents).
 *
 * `node-llama-cpp` est un module ESM pur : importé dynamiquement (jamais en
 * haut de fichier) pour ne charger ses bindings natifs qu'à l'usage réel.
 */

import type { AIProvider, ExtractInput, ExtractionResult } from "@/lib/types";
import { EXTRACTION_SYSTEM_PROMPT, TEXT_HINT_MIN_LENGTH } from "@/lib/providers/shared";
import { getReadyLocalModelPath } from "@/lib/models/manager";
import { recognizeText, OCR_TEXT_MIN_LENGTH } from "@/lib/ocr";
import type { Llama, LlamaContext, LlamaModel } from "node-llama-cpp";

/**
 * Nombre maximal de tokens que le modèle est autorisé à générer — sortie
 * attendue courte (4 champs JSON), sert surtout de filet de sécurité.
 */
const MAX_OUTPUT_TOKENS = 700;

/**
 * Marge de sécurité (tokens) en plus du prompt système + gabarit du message
 * utilisateur + sortie max, avant de considérer le budget restant comme
 * disponible pour le texte du document. Absorbe l'imprécision du calcul
 * (tokens spéciaux de mise en forme du chat wrapper, etc.).
 */
const CONTEXT_SAFETY_MARGIN_TOKENS = 200;

/**
 * Schéma JSON imposé au modèle via grammaire GBNF (node-llama-cpp) — la
 * sortie est structurellement garantie conforme, indépendamment de la
 * qualité du suivi d'instructions du (petit) modèle.
 */
const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestedName: { type: "string" },
    suggestedCategory: { type: "string" },
    summary: { type: "string" },
    documentDate: { type: ["string", "null"] },
  },
  required: ["suggestedName", "suggestedCategory", "summary", "documentDate"],
} as const;

interface LoadedRuntime {
  llama: Llama;
  context: LlamaContext;
}

let runtimePromise: Promise<LoadedRuntime> | null = null;

/** Charge (une seule fois) le modèle et son contexte llama.cpp, réutilisés ensuite entre tous les appels. */
async function getRuntime(modelPath: string): Promise<LoadedRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const { getLlama } = await import("node-llama-cpp");
      const llama = await getLlama();
      const model: LlamaModel = await llama.loadModel({ modelPath });
      const context = await model.createContext();
      return { llama, context };
    })().catch((error: unknown) => {
      // Un échec de chargement ne doit pas bloquer les tentatives suivantes.
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

function toRuntimeError(error: unknown, context: string): Error {
  const detail = error instanceof Error ? error.message : "erreur inconnue";
  return new Error(`Erreur du modèle local (${context}) : ${detail}.`);
}

function buildUserPrompt(fileName: string, text: string): string {
  return `Nom de fichier d'origine : "${fileName}". Voici le texte du document :\n\n${text}\n\nAnalyse ce document et renvoie le JSON demandé.`;
}

/**
 * Tronque `text` (si besoin) pour que le prompt complet (système + gabarit
 * + texte + marge pour la sortie) tienne dans `contextSize` tokens. Calcul
 * fait sur le vrai tokenizer du modèle chargé — pas une estimation en
 * caractères — pour ne jamais dépasser la fenêtre de contexte réelle, y
 * compris sur un document volumineux (ex: un bail de 70 pages).
 *
 * Le texte est coupé par la fin : sur un contrat/bail/facture, les
 * informations qui comptent pour cette tâche (parties, objet, montant,
 * dates) sont presque toujours dans les premières pages.
 */
function fitTextToContext(
  model: LlamaModel,
  contextSize: number,
  fileName: string,
  text: string
): { text: string; wasTruncated: boolean } {
  const scaffoldTokens = model.tokenize(EXTRACTION_SYSTEM_PROMPT).length + model.tokenize(buildUserPrompt(fileName, "")).length;
  const budget = contextSize - scaffoldTokens - MAX_OUTPUT_TOKENS - CONTEXT_SAFETY_MARGIN_TOKENS;

  if (budget <= 0) {
    // Ne devrait pas arriver en pratique (contexte anormalement petit) —
    // mieux vaut un texte vide explicite qu'un crash de tokenisation.
    return { text: "", wasTruncated: text.length > 0 };
  }

  const textTokens = model.tokenize(text);
  if (textTokens.length <= budget) {
    return { text, wasTruncated: false };
  }

  const truncatedTokens = textTokens.slice(0, budget);
  return { text: model.detokenize(truncatedTokens), wasTruncated: true };
}

export class LocalProvider implements AIProvider {
  readonly id = "local" as const;
  readonly label = "Local";

  async extractDocument(input: ExtractInput): Promise<ExtractionResult> {
    if (input.mimeType.startsWith("image/")) {
      const text = await recognizeText(input.buffer);
      if (text.length < OCR_TEXT_MIN_LENGTH) {
        throw new Error(
          "L'OCR local n'a pas réussi à extraire de texte exploitable de cette image. Essayez une image plus nette, ou basculez sur le provider OpenAI (vision) pour ce document."
        );
      }
      return this.extractFromText(text, input.fileName);
    }

    if (input.mimeType === "application/pdf") {
      if (input.textHint && input.textHint.trim().length >= TEXT_HINT_MIN_LENGTH) {
        return this.extractFromText(input.textHint, input.fileName);
      }
      // Pas de texte exploitable : l'appelant (src/lib/extraction) est
      // responsable de fournir une image (buffer/mimeType: "image/png") à
      // la place — auquel cas on repasse par la branche OCR ci-dessus.
      throw new Error(
        "Impossible d'extraire le texte de ce PDF : aucun texte natif exploitable et aucune image de la page n'a été fournie."
      );
    }

    // text/plain, text/markdown, etc. : utiliser le buffer comme texte brut.
    const text = input.buffer.toString("utf-8");
    return this.extractFromText(text, input.fileName);
  }

  private async extractFromText(text: string, fileName: string): Promise<ExtractionResult> {
    const modelPath = await getReadyLocalModelPath();
    if (!modelPath) {
      throw new Error(
        "Aucun modèle local téléchargé. Allez dans Réglages pour lancer le téléchargement, ou choisissez OpenAI en attendant."
      );
    }

    let runtime: LoadedRuntime;
    try {
      runtime = await getRuntime(modelPath);
    } catch (error) {
      throw toRuntimeError(error, "chargement du modèle");
    }

    const { llama, context } = runtime;
    const sequence = context.getSequence();

    try {
      const { LlamaChatSession } = await import("node-llama-cpp");
      const session = new LlamaChatSession({
        contextSequence: sequence,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      });

      // Un document volumineux (ex: un bail de 70 pages) peut largement
      // dépasser la fenêtre de contexte du petit modèle local — on tronque
      // au budget réel plutôt que de laisser node-llama-cpp gérer un
      // dépassement (context shift, qui tronquerait de façon moins
      // prévisible et sans qu'on puisse prévenir l'utilisateur).
      const { text: fittedText, wasTruncated } = fitTextToContext(context.model, context.contextSize, fileName, text);

      const grammar = await llama.createGrammarForJsonSchema(EXTRACTION_JSON_SCHEMA);
      const response = await session.prompt(buildUserPrompt(fileName, fittedText), {
        grammar,
        temperature: 0,
        maxTokens: MAX_OUTPUT_TOKENS,
      });
      const parsed = grammar.parse(response);

      const summary = parsed.summary ?? "";
      return {
        suggestedName: parsed.suggestedName || "document-sans-nom",
        suggestedCategory: parsed.suggestedCategory || "Divers",
        summary: wasTruncated
          ? `${summary}\n\n[Document volumineux : seul le début a pu être analysé en local (limite de contexte du modèle). Pour une analyse complète, utilisez le provider OpenAI.]`
          : summary,
        documentDate: parsed.documentDate ?? undefined,
      };
    } catch (error) {
      throw toRuntimeError(error, "extraction texte");
    } finally {
      await sequence.dispose();
    }
  }
}

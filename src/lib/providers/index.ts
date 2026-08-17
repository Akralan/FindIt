/**
 * Point d'entrée du système de providers IA. Pour ajouter un provider
 * (Ollama, Anthropic, etc.) : créer un fichier dans ce dossier, implémenter
 * `AIProvider`, l'ajouter dans `PROVIDERS` ci-dessous. Rien d'autre dans
 * l'app ne dépend d'un provider en particulier.
 */

import type { AIProvider, ProviderId } from "@/lib/types";
import { getConfig } from "@/lib/config";
import { OpenAIProvider } from "@/lib/providers/openai";
import { LocalProvider } from "@/lib/providers/local";
import { MockProvider } from "@/lib/providers/mock";
import { getReadyLocalModelPath } from "@/lib/models/manager";
import { ACTIVE_LOCAL_MODEL } from "@/lib/models/registry";

interface ProviderMeta {
  id: ProviderId;
  label: string;
  requiresApiKey: boolean;
}

/**
 * Tous les providers connus par l'app, y compris `mock` (dev/tests/CI,
 * activable uniquement via `AI_PROVIDER=mock` — jamais proposé au client).
 */
const ALL_PROVIDERS: ProviderMeta[] = [
  { id: "openai", label: "OpenAI", requiresApiKey: true },
  { id: "local", label: `Local (${ACTIVE_LOCAL_MODEL.label})`, requiresApiKey: false },
  { id: "mock", label: "Mock (aucun appel réseau, données de démonstration)", requiresApiKey: false },
];

/** Providers proposés dans l'UI (Réglages) : `mock` en est volontairement exclu. */
export function listProviders(): ProviderMeta[] {
  return ALL_PROVIDERS.filter((p) => p.id !== "mock");
}

export async function getProvider(): Promise<AIProvider> {
  const config = await getConfig();

  switch (config.provider) {
    case "openai": {
      if (!config.openaiApiKey) {
        throw new Error(
          "Aucune clé API OpenAI configurée. Ajoutez-en une dans les Réglages, ou choisissez le provider Local pour tester sans clé."
        );
      }
      return new OpenAIProvider({
        apiKey: config.openaiApiKey,
        model: config.openaiModel,
      });
    }
    case "local": {
      const modelPath = await getReadyLocalModelPath();
      if (!modelPath) {
        throw new Error(
          "Aucun modèle local téléchargé. Allez dans Réglages pour lancer le téléchargement, ou choisissez OpenAI en attendant."
        );
      }
      return new LocalProvider();
    }
    case "mock":
      return new MockProvider();
    default: {
      // Exhaustivité TypeScript : si un ProviderId est ajouté sans être géré
      // ici, ceci ne compile plus.
      const exhaustiveCheck: never = config.provider;
      throw new Error(`Provider inconnu : ${exhaustiveCheck as string}`);
    }
  }
}

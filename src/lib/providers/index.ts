/**
 * Point d'entrée du système de providers IA. Pour ajouter un provider
 * (Ollama, Anthropic, etc.) : créer un fichier dans ce dossier, implémenter
 * `AIProvider`, l'ajouter dans `PROVIDERS` ci-dessous. Rien d'autre dans
 * l'app ne dépend d'un provider en particulier.
 */

import type { AIProvider, ProviderId } from "@/lib/types";
import { getConfig } from "@/lib/config";
import { OpenAIProvider } from "@/lib/providers/openai";
import { MockProvider } from "@/lib/providers/mock";

interface ProviderMeta {
  id: ProviderId;
  label: string;
  requiresApiKey: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  { id: "openai", label: "OpenAI", requiresApiKey: true },
  { id: "mock", label: "Mock (aucun appel réseau, données de démonstration)", requiresApiKey: false },
];

export function listProviders(): ProviderMeta[] {
  return PROVIDERS;
}

export async function getProvider(): Promise<AIProvider> {
  const config = await getConfig();

  switch (config.provider) {
    case "openai": {
      if (!config.openaiApiKey) {
        throw new Error(
          "Aucune clé API OpenAI configurée. Ajoutez-en une dans les Réglages, ou choisissez le provider Mock pour tester sans clé."
        );
      }
      return new OpenAIProvider({
        apiKey: config.openaiApiKey,
        model: config.openaiModel,
        embeddingModel: config.openaiEmbeddingModel,
      });
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

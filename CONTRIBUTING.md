# Contribuer à FindIt

Merci de l'intérêt porté à FindIt. Ce document explique comment
contribuer dans de bonnes conditions.

Avant toute chose, lisez [CONTRACTS.md](./CONTRACTS.md) et
`src/lib/types.ts` en entier. Ce sont les contrats internes du projet :
noms de fonctions, formes des types, routes API, emplacements de
fichiers. Toute contribution doit les respecter au caractère près, ou les
faire évoluer explicitement (voir plus bas).

## Lancer le projet en développement

```bash
npm install
cp .env.example .env.local
npm run dev
```

Pour développer sans consommer d'appels API (pas de clé requise, aucun
appel réseau), mettez dans `.env.local` :

```
AI_PROVIDER=mock
```

Le `MockProvider` (`src/lib/providers/mock.ts`) retourne des valeurs
déterministes plausibles à partir du nom de fichier — nom suggéré,
catégorie, résumé. Il permet de développer et tester l'ensemble du
pipeline (upload, extraction, classement, recherche) sans clé API
OpenAI et sans coût.

Le choix du provider peut aussi se faire depuis la page Réglages de
l'application, sans redémarrage — mais pour du développement local,
`AI_PROVIDER=mock` dans `.env.local` reste le plus simple.

Commandes utiles :

```bash
npm run lint       # ESLint
npm run typecheck   # tsc --noEmit, TypeScript strict
npm run build       # build de production
```

## Ajouter un nouveau provider IA

C'est le point d'extension central du projet — voir la section « v2 » de
[ROADMAP.md](./ROADMAP.md) (Ollama, llama.cpp, OCR local...). La marche à
suivre est fixée par [CONTRACTS.md](./CONTRACTS.md), section
`src/lib/providers/` :

1. Créer un fichier dans `src/lib/providers/` (ex : `ollama.ts`).
2. Implémenter l'interface `AIProvider` définie dans `src/lib/types.ts` :
   - `readonly id: ProviderId`
   - `readonly label: string`
   - `extractDocument(input: ExtractInput): Promise<ExtractionResult>`
   - `embed(text: string): Promise<number[]>`
3. Ajouter le provider dans `PROVIDERS` et dans `listProviders()`, dans
   `src/lib/providers/index.ts`.
4. Étendre le type `ProviderId` dans `src/lib/types.ts` si nécessaire
   (c'est un des rares cas où modifier `types.ts` est légitime — le faire
   dans un commit séparé et clairement décrit).

Rien d'autre dans l'application ne doit changer : ni les routes API, ni
les composants, ni la logique d'extraction ou de recherche. Si votre
contribution touche à autre chose que le fichier du provider et son
enregistrement dans `index.ts`, c'est probablement le signe que
l'abstraction fuit quelque part — à signaler dans l'issue ou la pull
request plutôt qu'à contourner.

Points d'attention pour un nouveau provider :

- Toute erreur de l'API sous-jacente (quota, clé invalide, timeout,
  modèle indisponible...) doit être catchée et relancée comme `Error`
  avec un message clair et actionnable **en français**, car il est
  affiché tel quel côté interface.
- Ne jamais logger de secret (clé API, token) — voir aussi
  `src/lib/config.ts` qui applique déjà cette règle pour la configuration
  persistée.
- `AIProvider` n'a qu'une seule méthode, `extractDocument()`. La recherche
  (`src/lib/search/fuzzy.ts`) ne dépend d'aucun provider — un nouveau
  provider n'a donc rien à faire pour la recherche.

## Conventions de code

- **TypeScript strict** : tout est typé explicitement. `any` n'est
  acceptable que dans un cas réellement impossible à typer autrement, et
  doit rester isolé et commenté.
- **Noms de code en anglais** : variables, fonctions, fichiers, types.
- **Texte utilisateur en français** : tout ce qui s'affiche dans
  l'interface (libellés, messages d'erreur, textes d'aide) est rédigé en
  français, sobre et sans emoji — voir `src/app/globals.css` et
  `CONTRACTS.md` (section 3) pour l'esthétique visée.
- **Pas de base de données externe** : le stockage reste JSON + fichiers
  sur disque tant que `ROADMAP.md` (v1.1) n'a pas acté de réévaluation.
  Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour le détail.
- **Pas de lib de data-fetching côté client** : les appels aux routes API
  se font avec `fetch` classique, pas de React Query ou équivalent.
- Avant d'ajouter une fonctionnalité, vérifier qu'elle respecte les deux
  propriétés qui font l'identité du produit (voir la fin de
  `ROADMAP.md`) : **pas d'abonnement, pas de compte**, et tout ajout de
  provider IA reste isolé dans `src/lib/providers/`.

## Processus

- Une branche par changement, un scope clair par pull request.
- `npm run typecheck` et `npm run lint` doivent passer avant toute
  ouverture de pull request.
- Toute modification des contrats (`CONTRACTS.md`, `src/lib/types.ts`)
  doit être explicite, justifiée dans la description de la pull request,
  et idéalement discutée dans une issue au préalable — ce sont les
  interfaces dont dépend le reste du projet.
- Les rapports de bug et demandes de fonctionnalité passent par les
  issues du dépôt.

## Licence des contributions

En contribuant, vous acceptez que votre contribution soit distribuée sous
les mêmes termes que le reste du projet, la licence [PolyForm
Noncommercial 1.0.0](./LICENSE).

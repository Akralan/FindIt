# Contrats internes — à respecter scrupuleusement

Ce document fige les interfaces entre modules pour que chaque partie du code
puisse être écrite indépendamment. La source de vérité pour les types est
`src/lib/types.ts` — la lire avant d'écrire quoi que ce soit.

Stack : Next.js 14 (App Router), TypeScript strict, Tailwind CSS. Pas de
base de données externe : stockage JSON sur disque (`data/db.json`) + fichiers
sur disque (`data/files/<catégorie>/<nom>`). Pas de comptes, un seul
utilisateur, tout tourne en local/self-hosted.

## 1. Modules `src/lib/`

### `src/lib/providers/`
- `index.ts` exporte `getProvider(): Promise<AIProvider>` — lit la config
  active (via `src/lib/config.ts`) et instancie le bon provider.
  Exporte aussi `listProviders(): { id, label, requiresApiKey }[]`.
- `openai.ts` exporte `class OpenAIProvider implements AIProvider`. Utilise
  le SDK `openai` officiel. `extractDocument` :
  - si `mimeType` commence par `image/` → appel vision (chat.completions,
    message avec `image_url` en data URL base64) avec `response_format:
    { type: "json_schema", ... }` (ou `json_object` si json_schema pose
    souci) pour forcer une sortie JSON strictement conforme à
    `ExtractionResult` (sans `text`, généré séparément si besoin — en
    pratique le modèle peut renvoyer `text` = sa lecture OCR).
  - si `mimeType === "application/pdf"` → si `textHint` est fourni et fait
    plus de ~40 caractères, appel texte seul (moins cher) ; sinon, l'appelant
    (`src/lib/extraction`) est responsable de fournir une image de la
    première page en tant que `buffer`/`mimeType: "image/png"` à la place.
  - `embed(text)` → `embeddings.create` avec le modèle configuré
    (`text-embedding-3-small` par défaut), retourne `number[]`.
  - Toute erreur API (quota, clé invalide, timeout) doit être catchée et
    relancée comme `Error` avec un message clair et actionnable en français
    (affiché tel quel côté UI).
- `mock.ts` exporte `class MockProvider implements AIProvider` — ne fait
  aucun appel réseau, retourne des valeurs déterministes plausibles à partir
  du nom de fichier (utile pour dev/tests/démo sans clé API). `embed` retourne
  un vecteur pseudo-aléatoire mais déterministe (hash du texte → seed).
- Pour ajouter un provider (Ollama, Anthropic, etc. — voir ROADMAP v2) :
  créer un fichier ici, implémenter `AIProvider`, l'ajouter dans
  `PROVIDERS` (`index.ts`) et dans `listProviders()`. Rien d'autre à changer
  dans l'app.

### `src/lib/config.ts`
- `getConfig(): Promise<ProviderConfig>` — fusionne dans cet ordre de
  priorité : `data/config.local.json` (créé/édité par la page Réglages) >
  variables d'env (`.env.local`) > défauts.
- `updateConfig(patch: Partial<ProviderConfig>): Promise<void>` — merge et
  écrit `data/config.local.json` (créer `data/` si absent). Ne jamais logger
  la clé API.
- `getPublicConfig(): Promise<ProviderConfigPublic>` — même chose sans la clé
  API en clair, avec `hasApiKey: boolean`.

### `src/lib/db/`
- Stockage JSON simple, pas de dépendance native. Fichier `data/db.json` de
  forme `{ documents: DocumentRecord[], events: DocumentEvent[] }`.
- `store.ts` : `readDb()` / `writeDb(db)` internes (créent le fichier avec
  structure vide si absent), pas de lock — usage mono-utilisateur.
- `documents.ts` exporte :
  - `listDocuments(opts?: { category?: string }): Promise<DocumentSummary[]>`
  - `getDocument(id: string): Promise<DocumentRecord | null>`
  - `createDocument(rec: DocumentRecord): Promise<DocumentRecord>`
  - `updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord>`
  - `deleteDocument(id: string): Promise<void>`
  - `listCategories(): Promise<{ category: string; count: number }[]>`
- `events.ts` exporte :
  - `logEvent(e: Omit<DocumentEvent, "id" | "createdAt">): Promise<DocumentEvent>`
  - `getLastEvent(documentId: string): Promise<DocumentEvent | null>`
  - `deleteEvent(id: string): Promise<void>` (utilisé après un undo consommé)

### `src/lib/storage/files.ts`
- `saveFile(buffer: Buffer, category: string, fileName: string): Promise<string>`
  écrit sous `DATA_DIR/files/<category>/<fileName>` (crée les dossiers,
  dé-duplique le nom si collision en ajoutant `-2`, `-3`...), retourne le
  chemin relatif stocké dans `DocumentRecord.filePath`.
- `moveFile(oldRelPath: string, newCategory: string, newFileName: string): Promise<string>`
- `deleteFileToTrash(relPath: string): Promise<void>` — déplace vers
  `DATA_DIR/trash/` plutôt que suppression définitive.
- `readFile(relPath: string): Promise<Buffer>`
- `resolveDataDir()` lit `process.env.DATA_DIR` (défaut `./data`).

### `src/lib/extraction/index.ts`
- `extractDocument(file: { buffer: Buffer; mimeType: string; fileName: string }): Promise<ExtractionResult>`
  orchestration :
  1. image/* → direct au provider (vision).
  2. application/pdf → tenter `pdf-parse` pour le texte natif ; si le texte
     fait moins de ~40 caractères utiles (PDF scanné), rendre la première
     page en PNG via `pdfjs-dist` + `@napi-rs/canvas` et passer cette image
     au provider (vision) ; sinon passer le texte extrait en `textHint`.
  3. text/plain, text/markdown → lire le texte directement, appel provider
     texte seul.
  4. autre type → lever une erreur claire ("Type de fichier non supporté").
  - Doit être résilient : si le rendu PDF→image échoue, retomber sur le
    texte partiel plutôt que de planter toute la requête.

### `src/lib/search/semantic.ts`
- `cosineSimilarity(a: number[], b: number[]): number`
- `searchDocuments(query: string): Promise<SearchResult[]>` — embed la
  requête via `getProvider()`, calcule la similarité contre tous les
  documents ayant un `embedding`, trie décroissant, retourne top 20 avec
  `score`. Fallback si aucun document n'a d'embedding : recherche texte
  simple (substring, insensible à la casse) sur `currentName` + `summary`.

## 2. Routes API (`src/app/api/`)

Toutes les routes renvoient du JSON. En cas d'erreur : `{ error: string }`
avec un status HTTP approprié (400/404/500), jamais de stack trace brute.

- `POST /api/upload` — `multipart/form-data`, champ répété `files`. Pour
  chaque fichier : extraction IA, `status: "pending_review"`, le fichier
  physique est écrit tout de suite sous la catégorie suggérée (pas de zone
  d'attente séparée — la prévisualisation se fait en mémoire côté client
  avant l'appel, OU le renommage/déplacement définitif se fait seulement à
  la confirmation via PATCH ; **choix retenu : upload = extraction + sauvegarde
  immédiate en `pending_review`, la prévisualisation permet ensuite
  d'éditer/valider via PATCH qui passe `status` à `confirmed`**). Réponse :
  `{ documents: DocumentRecord[] }`.
- `GET /api/documents?category=&status=` — `{ documents: DocumentSummary[] }`
- `GET /api/documents/categories` — `{ categories: { category, count }[] }`
- `GET /api/documents/:id` — `{ document: DocumentRecord }` ou 404
- `PATCH /api/documents/:id` — body `Partial<Pick<DocumentRecord,
  "currentName"|"category"|"tags"|"status">>` — applique le changement,
  déplace le fichier physique si `currentName`/`category` changent, logue un
  `DocumentEvent`, retourne `{ document: DocumentRecord }`.
- `DELETE /api/documents/:id` — déplace le fichier vers la corbeille, logue
  l'event, retourne `{ ok: true }`.
- `POST /api/documents/:id/undo` — annule le dernier event de ce document
  (restaure `before`, déplace le fichier si besoin), retourne
  `{ document: DocumentRecord }`.
- `GET /api/search?q=...` — `{ results: SearchResult[] }`
- `GET /api/settings` — `{ config: ProviderConfigPublic }`
- `POST /api/settings` — body `Partial<ProviderConfig>` — `{ config: ProviderConfigPublic }`

## 3. Frontend (`src/app/`, `src/components/`)

Design : voir `src/app/globals.css` pour les tokens (`--bg`, `--surface`,
`--border`, `--text`, `--text-muted`, `--accent`, `--danger`, `--success`).
Esthétique visée : sobre, professionnelle, type outil SaaS (pensez Linear /
Notion) — pas de dégradés criards, pas d'emoji dans l'UI, typographie Inter,
coins arrondis modérés (`rounded-card` = 12px), beaucoup d'espace blanc,
état vide et état de chargement soignés partout.

- `src/app/layout.tsx` — shell global (police, `<html>`, header avec logo
  "FindIt" texte + nav vers Réglages).
- `src/app/page.tsx` — Dashboard : `SearchBar` en haut, filtre par catégorie
  sur le côté, `DocumentGrid` (ou liste) des documents `confirmed`, section
  distincte "À valider" si des documents sont `pending_review`
  (`DocumentCard` avec bouton Valider/Modifier/Rejeter), `UploadDropzone`
  accessible en permanence (zone de drop + bouton parcourir).
- `src/app/settings/page.tsx` — formulaire : sélection du provider (liste
  venant de `GET /api/settings`), champ clé API (masqué), modèle. Explique
  en une phrase que changer de provider ne nécessite ni redémarrage ni code.
- Composants dans `src/components/` : `UploadDropzone`, `DocumentCard`,
  `DocumentGrid`, `DocumentModal` (détail + édition + undo + suppression),
  `SearchBar`, `CategoryFilter`, `SettingsForm`, primitives `ui/Button.tsx`,
  `ui/Badge.tsx`, `ui/Modal.tsx`, `ui/Input.tsx`, `ui/Toast.tsx` (retours
  succès/erreur après upload, save, delete...).
- Tout composant qui appelle une route API le fait via `fetch` classique
  (pas de lib de data-fetching externe, on reste minimal).

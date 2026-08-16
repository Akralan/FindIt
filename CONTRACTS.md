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
  - Toute erreur API (quota, clé invalide, timeout) doit être catchée et
    relancée comme `Error` avec un message clair et actionnable en français
    (affiché tel quel côté UI).
- `mock.ts` exporte `class MockProvider implements AIProvider` — ne fait
  aucun appel réseau, retourne des valeurs déterministes plausibles à partir
  du nom de fichier (utile pour dev/tests/démo sans clé API).
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

### `src/lib/search/fuzzy.ts`
- `searchDocuments(query: string): Promise<SearchResult[]>` — pas d'IA, pas
  d'embedding. Score de correspondance floue (mot entier > sous-chaîne >
  préfixe partagé, tolérant aux formes fléchies/fautes de frappe) sur
  `currentName`, `category`, `summary`, pondéré par champ. Ne renvoie que les
  documents avec un score strictement positif (jamais de résultat hors-sujet
  juste pour remplir la liste), trié décroissant, top 20. `score` ne sert
  qu'au tri côté serveur — il n'a pas de sens en pourcentage et n'est jamais
  affiché côté UI.

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
  "currentName"|"category"|"status">>` — applique le changement,
  déplace le fichier physique si `currentName`/`category` changent, logue un
  `DocumentEvent`, retourne `{ document: DocumentRecord }`.
- `DELETE /api/documents/:id` — déplace le fichier vers la corbeille, logue
  l'event, retourne `{ ok: true }`.
- `POST /api/documents/:id/undo` — annule le dernier event de ce document
  (restaure `before`, déplace le fichier si besoin), retourne
  `{ document: DocumentRecord }`.
- `POST /api/documents/:id/reveal` — ouvre le gestionnaire de fichiers du
  système (Explorateur sur Windows, Finder sur macOS) avec le fichier du
  document sélectionné, via `child_process`. N'a de sens que si le serveur
  tourne sur la machine de l'utilisateur (cas d'usage auto-hébergé
  mono-utilisateur du projet) ; renvoie une erreur explicite sur les
  plateformes non supportées. Retourne `{ ok: true }`.
- `GET /api/search?q=...` — `{ results: SearchResult[] }`
- `GET /api/settings` — `{ config: ProviderConfigPublic }`
- `POST /api/settings` — body `Partial<ProviderConfig>` — `{ config: ProviderConfigPublic }`
- `GET /api/settings/sync` — route interne à la page Réglages (hors contrat
  mobile, voir `SYNC_CONTRACTS.md`). Retourne `{ host, port, token,
  qrDataUrl }` (`SyncPairingInfo`), génère le `syncToken` s'il n'existe pas
  encore. `qrDataUrl` est `null` si aucune IP locale non-interne n'est
  détectée.
- `POST /api/settings/sync/regenerate` — régénère le `syncToken` (invalide
  l'ancien), retourne le même format que `GET /api/settings/sync`.
- `GET /api/settings/sync/firewall` — lecture seule, pas d'élévation.
  Retourne `{ exists: boolean, platform: string }` : `exists` indique si la
  règle de pare-feu `FindIt webapp (LAN, synchro mobile)` existe déjà.
- `POST /api/settings/sync/firewall` — déclenche l'invite d'élévation
  Windows (UAC) pour créer/recréer cette règle sur tous les profils réseau
  (Domain/Private/Public — voir `src/lib/sync/firewall.ts` et
  SYNC_CONTRACTS.md §1bis pour la justification). Retourne `{ ok: true,
  port }`, ou `{ error }` (400 hors Windows, 500 si la règle n'existe
  toujours pas après l'invite — refus probable de l'utilisateur).
- `GET /api/settings/sync/hotspot` — lecture seule, pas d'élévation.
  Retourne `{ isActive: boolean | null, ssid: string | null, platform:
  string }` (statut du point d'accès mobile Windows, voir
  `src/lib/sync/hotspot.ts`). `isActive`/`ssid` valent `null` si le statut
  n'a pas pu être lu (hors Windows, API indisponible...).
- `POST /api/settings/sync/hotspot` — body `{ action: "start" | "stop" }`,
  déclenche l'invite d'élévation Windows (UAC). `"start"` démarre le point
  d'accès avec des identifiants générés pour la session et retourne `{ ok:
  true, pairingInfo }` où `pairingInfo` (`SyncPairingInfo`) contient le QR
  complet — payload incluant `hotspot: { ssid, password }` et `host` =
  IP du PC sur l'interface du point d'accès (voir SYNC_CONTRACTS.md §1bis).
  `"stop"` arrête le point d'accès et retourne `{ ok: true }`. `{ error }`
  (400 action invalide ou hors Windows, 500 échec/refus de l'invite).

### Routes de synchro PC ↔ Mobile (`src/app/api/sync/`)

Contrat détaillé, formats exacts et pairing : voir `SYNC_CONTRACTS.md` —
c'est la source de vérité partagée avec l'app mobile (`android/`), ne pas
diverger des noms de champs/routes sans mettre à jour ce fichier des deux
côtés. Toutes exigent `Authorization: Bearer <syncToken>`, `401` sinon
(vérification factorisée dans `src/lib/sync/auth.ts`, appelée par chaque
route — pas dupliquée).

- `GET /api/sync/manifest` — `{ documents: SyncManifestEntry[] }`, uniquement
  les documents `status: "confirmed"` (sous-ensemble de `DocumentRecord`,
  type dans `src/lib/types.ts`).
- `GET /api/sync/documents/:id/file` — sert les octets bruts du fichier
  (`Content-Type` = `mimeType` du document, `Content-Disposition:
  attachment`). 404 si le document n'existe pas. Distinct de `POST
  /api/documents/:id/reveal` (Explorateur côté PC).
- `POST /api/sync/receive` — `multipart/form-data`, champ unique `file` (un
  seul fichier, contrairement à `/api/upload`). Réutilise le pipeline commun
  `src/lib/upload-pipeline.ts` (`ingestUploadedFile`), partagé avec
  `/api/upload` : extraction IA, sauvegarde, `status: "pending_review"`.
  Réponse : `{ document: DocumentRecord }`. Livrée en v1 côté PC mais pas
  encore appelée par le mobile (v1 = pull seul, voir `android/ROADMAP.md`).

## 3. Frontend (`src/app/`, `src/components/`)

Design : voir `src/app/globals.css` pour les tokens (`--bg`, `--surface`,
`--surface-hover`, `--border`, `--border-subtle`, `--text`, `--text-muted`,
`--text-faint`, `--accent`, `--accent-hover`, `--danger`, `--success`,
`--warning`, `--warning-bg`, `--warning-dot`). Palette chaude (vert sauge
`#2F6B57` en accent, fond quasi-blanc `#F7F8F7`), déclinée en dark mode
(`prefers-color-scheme`) dans la même identité (pas de retour à l'indigo).
Esthétique visée : sobre, chaleureuse, typographie Helvetica/Inter, coins
arrondis modérés (`rounded-card` = 12px pour boutons/champs, `rounded-card-lg`
= 16px pour cartes/sections/modale), pastilles (`rounded-full`) pour nav et
filtres, beaucoup d'espace blanc, état vide et état de chargement soignés
partout, colonnes de métadonnées (taille, dates) en police mono
(`font-mono`).

- `src/app/layout.tsx` — shell global (police, `<html>`, header avec logo
  "FindIt" + `NavPills` (pastille active sombre `bg-text`/`text-bg`, inactive
  transparente) vers `/` (Documents) et `/settings` (Réglages). Pas d'onglets
  "Recherche" / "Premier lancement" — ce sont des états de `/`, pas des
  routes (voir `src/app/page.tsx`).
- `src/app/page.tsx` — Dashboard mono-page à 3 rendus conditionnels selon
  l'état réel (pas 3 routes) :
  - bibliothèque totalement vide (`hasNoDocumentsAtAll`) : écran d'accueil
    dédié ("Vos papiers, rangés sans y penser" + `UploadDropzone
    variant="full"` + stepper 1·2·3) ;
  - recherche active (`searchResults !== null`) : `SearchBar` en haut +
    "Résultats" + `DocumentList variant="search"` (ou état "Aucun
    résultat") ;
  - sinon (dashboard normal) : hero "Que cherchez-vous ?" + `SearchBar`,
    `UploadDropzone variant="compact"` (ligne, drag-and-drop sur toute la
    zone), section "À valider" en lignes (`DocumentList variant="pending"`)
    avec bouton groupé "Tout valider" si plus d'un document en attente
    (**pas de nouvelle route** : boucle client sur les PATCH existants
    `PATCH /api/documents/:id` avec `{ status: "confirmed" }`, séquentiels,
    un rafraîchissement global à la fin — plus simple qu'une route batch
    pour ce volume et cohérent avec le modèle "un document = un PATCH"
    déjà en place), `CategoryFilter` en pastilles horizontales, puis
    `DocumentList variant="library"` pour les documents `confirmed`.
- `src/app/settings/page.tsx` — formulaire : sélection du provider (liste
  venant de `GET /api/settings`), champ clé API (masqué), modèle, bandeau de
  confidentialité mentionnant `data/files/<catégorie>/`. Explique en une
  phrase que changer de provider ne nécessite ni redémarrage ni code. Contient
  aussi la section « Synchro mobile » (`SyncSettings`, voir ci-dessous et
  `SYNC_CONTRACTS.md`).
- Composants dans `src/components/` : `UploadDropzone` (variants
  `compact`/`full`, drag-and-drop actif sur toute la zone dans les deux cas),
  `DocumentRow` + `DocumentList` (lignes, remplacent l'ancien
  `DocumentCard`/`DocumentGrid` en grille de cartes), `DocumentModal`
  (détail + édition + undo + suppression + bouton Explorateur),
  `SearchBar`, `CategoryFilter` (pastilles horizontales), `NavPills`,
  `SettingsForm`, `SyncSettings` (QR code de pairing généré côté serveur via
  la lib `qrcode`, bouton « Régénérer le jeton » avec confirmation inline,
  même style que `SettingsForm`), primitives `ui/Button.tsx` (variants `primary`,
  `secondary`, `ghost`, `danger`, `danger-solid`, `dark`), `ui/Badge.tsx`
  (variants incluant `warning` pour le statut "À valider"), `ui/Modal.tsx`
  (accepte un `title` React, pas seulement une chaîne, pour composer badge +
  nom d'origine + titre dans l'en-tête), `ui/Input.tsx`, `ui/Toast.tsx`
  (retours succès/erreur après upload, save, delete...).
- Tout composant qui appelle une route API le fait via `fetch` classique
  (pas de lib de data-fetching externe, on reste minimal).

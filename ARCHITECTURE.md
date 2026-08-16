# Architecture — FindIt

Ce document décrit l'architecture technique de FindIt v1 : le flux de
traitement d'un document, les choix de stockage, et l'abstraction
provider IA. Pour les contrats précis (signatures de fonctions, formes de
types, routes API), voir [CONTRACTS.md](./CONTRACTS.md) et
`src/lib/types.ts`, qui font foi.

## Vue d'ensemble : upload -> extraction -> stockage -> recherche

```
                    ┌──────────────────────────────────────────────┐
                    │                  Navigateur                  │
                    │   UploadDropzone   SearchBar   DocumentModal  │
                    └───────────────┬────────────────────┬─────────┘
                                    │ fetch                │ fetch
                                    ▼                      ▼
┌───────────────────────────────────────────────┐  ┌─────────────────────┐
│  POST /api/upload                              │  │ GET /api/search?q=  │
│  1. reçoit les fichiers (multipart/form-data)  │  └──────────┬──────────┘
│  2. pour chaque fichier :                      │             │
│     src/lib/extraction/index.ts                │             ▼
│       -> extractDocument({buffer, mimeType,…}) │  src/lib/search/semantic.ts
│          image/*      -> vision (provider)     │    1. embed(query) via
│          pdf (texte)  -> texte (provider)      │       getProvider()
│          pdf (scanné) -> rendu 1e page en PNG   │    2. cosineSimilarity
│                          -> vision (provider)   │       contre chaque
│          text/*       -> texte (provider)       │       document.embedding
│  3. src/lib/storage/files.ts                   │    3. tri décroissant,
│       saveFile(buffer, category, fileName)      │       top 20
│       -> data/files/<catégorie>/<nom>          │    4. repli texte simple
│  4. src/lib/db/documents.ts                     │       (substring) si
│       createDocument({ status:"pending_review"  │       aucun embedding
│         , … })  -> data/db.json                 │       n'existe encore
│  5. réponse { documents: DocumentRecord[] }     │             │
└───────────────────────────────────────────────┘             ▼
                                                      { results: SearchResult[] }

Validation / édition :
  PATCH /api/documents/:id  -> met à jour le DocumentRecord, déplace le
                                fichier physique si nom/catégorie changent
                                (moveFile), passe status à "confirmed",
                                logue un DocumentEvent (src/lib/db/events.ts)
  POST  /api/documents/:id/undo
                             -> restaure le DocumentEvent précédent
                                (before), déplace le fichier si besoin
```

Le fil directeur : **un document traverse toujours les mêmes quatre
étapes** — il est déposé (upload), son contenu est lu par l'IA
(extraction), il est écrit sur disque avec ses métadonnées (stockage),
puis il devient retrouvable (recherche). Chaque étape est un module
`src/lib/` indépendant, orchestré par les routes API de
`src/app/api/`, jamais l'inverse : l'UI n'appelle jamais directement un
module `src/lib/`, seulement les routes API.

Point de choix retenu (voir `CONTRACTS.md`) : l'extraction et
l'écriture du fichier physique se font **immédiatement** à l'upload, avec
`status: "pending_review"`. Il n'y a pas de zone d'attente séparée hors
disque. La prévisualisation et l'édition (nom, catégorie, tags) se font
ensuite sur ce document déjà écrit, et la confirmation (`PATCH` ->
`status: "confirmed"`) matérialise le déplacement final si nécessaire.
Ce choix simplifie le modèle (un document existe toujours quelque part
sur disque dès sa création) au prix d'un déplacement de fichier
possible lors de la validation.

## Pas de base de données externe : JSON + fichiers sur disque

FindIt v1 n'utilise aucune base de données externe (pas de PostgreSQL,
SQLite, etc.). Le stockage repose sur deux briques simples :

- **`data/db.json`** : un unique fichier JSON de forme
  `{ documents: DocumentRecord[], events: DocumentEvent[] }`, lu et
  réécrit en entier à chaque opération (`src/lib/db/store.ts`).
- **`data/files/<catégorie>/<nom>`** : les fichiers physiques, rangés
  par catégorie suggérée ou validée. Une suppression déplace vers
  `data/trash/` plutôt que d'effacer définitivement.

### Pourquoi ce choix

- FindIt est un outil **mono-utilisateur, auto-hébergé** — pas de
  comptes, pas de concurrence d'écriture entre utilisateurs à gérer.
- Zéro dépendance d'infrastructure : cloner, `npm install`, une clé API,
  et l'application tourne. Pas de serveur de base de données à
  provisionner, pas de migration à exécuter avant de démarrer.
- Le format est directement lisible, versionnable dans une sauvegarde
  simple (copier `data/`), et inspectable sans outil dédié.

### Limites connues

- Le fichier `db.json` entier est relu et réécrit à chaque opération
  d'écriture : le coût croît avec la taille de la bibliothèque.
- Pas de verrouillage (lock) : le modèle suppose un seul processus
  écrivain à la fois, cohérent avec l'usage mono-utilisateur mais qui ne
  tiendrait pas en environnement multi-instance.
- La recherche sémantique (`searchDocuments`) parcourt et compare tous
  les documents ayant un embedding en mémoire à chaque requête — sans
  index vectoriel, cela ne passe pas à l'échelle indéfiniment.
- Pas de transactions : une écriture interrompue en cours de route peut
  laisser `db.json` incohérent avec l'état réel des fichiers sur disque
  (risque limité en pratique par l'usage mono-utilisateur, mais réel).

Ces limites sont connues et acceptées pour la v1, dimensionnée pour une
bibliothèque personnelle ou une petite équipe. La [ROADMAP.md](./ROADMAP.md)
(section v1.1) prévoit explicitement une **réévaluation** de ce choix de
stockage si la taille réelle des bibliothèques utilisées en pratique le
justifie — migration vers SQLite ou une base vectorielle dédiée étant les
pistes les plus probables à ce moment-là, sans que ce soit acté
aujourd'hui.

## L'abstraction provider IA

Toute la logique dépendant d'un fournisseur d'IA passe par une seule
interface, `AIProvider` (`src/lib/types.ts`) :

```
interface AIProvider {
  readonly id: ProviderId;
  readonly label: string;
  extractDocument(input: ExtractInput): Promise<ExtractionResult>;
  embed(text: string): Promise<number[]>;
}
```

- `src/lib/providers/index.ts` expose `getProvider()`, qui lit la
  configuration active (`src/lib/config.ts` — fusion `data/config.local.json`
  > variables d'environnement > défauts) et instancie le bon provider. Le
  reste de l'application n'appelle jamais un provider concret directement.
- `src/lib/providers/openai.ts` implémente `AIProvider` avec le SDK
  officiel `openai` : extraction par vision pour les images et PDF
  scannés, extraction texte pour le texte natif, embeddings via
  `text-embedding-3-small` par défaut.
- `src/lib/providers/mock.ts` implémente `AIProvider` sans aucun appel
  réseau, avec des valeurs déterministes dérivées du nom de fichier —
  utilisé en développement (`AI_PROVIDER=mock`) et pour les démonstrations
  sans clé API.

Ce découplage a deux effets structurants :

1. **Aucun module d'orchestration** (`src/lib/extraction`,
   `src/lib/search`) ni aucune route API ne connaît le provider actif. Ils
   appellent `getProvider()` et travaillent uniquement sur l'interface
   `AIProvider`.
2. **Ajouter un provider n'exige de toucher qu'un seul fichier** dans
   `src/lib/providers/`, plus son enregistrement dans `index.ts` — voir
   [CONTRIBUTING.md](./CONTRIBUTING.md). C'est le mécanisme par lequel la
   [ROADMAP.md](./ROADMAP.md) (v2) prévoit d'introduire un provider
   **100 % local** (Ollama, llama.cpp, OCR local) sans réécrire le reste
   de l'application — tenant ainsi, en différé, la promesse de traitement
   local du document de cadrage initial.

Le changement de provider actif se fait depuis la page Réglages de
l'application (`GET`/`POST /api/settings`), sans redémarrage ni
modification de code.

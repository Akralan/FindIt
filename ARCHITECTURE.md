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
│       -> extractDocument({buffer, mimeType,…}) │  src/lib/search/fuzzy.ts
│          image/*      -> vision (provider)     │    1. tokenise la requête
│          pdf (texte)  -> texte (provider)      │    2. score chaque
│          pdf (scanné) -> rendu 1e page en PNG   │       document sur
│                          -> vision (provider)   │       currentName /
│          text/*       -> texte (provider)       │       category / summary
│  3. src/lib/storage/files.ts                   │       (mot entier >
│       saveFile(buffer, category, fileName)      │       sous-chaîne >
│       -> data/files/<catégorie>/<nom>          │       préfixe partagé)
│  4. src/lib/db/documents.ts                     │    3. ne garde que
│       createDocument({ status:"pending_review"  │       score > 0, trie
│         , … })  -> data/db.json                 │       décroissant,
│  5. réponse { documents: DocumentRecord[] }     │       top 20
└───────────────────────────────────────────────┘             │
                                                                ▼
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
disque. La prévisualisation et l'édition (nom, catégorie) se font
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
- La recherche (`searchDocuments`, `src/lib/search/fuzzy.ts`) parcourt et
  score tous les documents en mémoire à chaque requête — sans index, cela
  ne passe pas à l'échelle indéfiniment (reste large pour une bibliothèque
  personnelle).
- Pas de transactions : une écriture interrompue en cours de route peut
  laisser `db.json` incohérent avec l'état réel des fichiers sur disque
  (risque limité en pratique par l'usage mono-utilisateur, mais réel).

Ces limites sont connues et acceptées pour la v1, dimensionnée pour une
bibliothèque personnelle ou une petite équipe. La [ROADMAP.md](./ROADMAP.md)
(section v1.1) prévoit explicitement une **réévaluation** de ce choix de
stockage si la taille réelle des bibliothèques utilisées en pratique le
justifie — migration vers SQLite étant la piste la plus probable à ce
moment-là, sans que ce soit acté aujourd'hui.

## L'abstraction provider IA

Toute la logique dépendant d'un fournisseur d'IA passe par une seule
interface, `AIProvider` (`src/lib/types.ts`) :

```
interface AIProvider {
  readonly id: ProviderId;
  readonly label: string;
  extractDocument(input: ExtractInput): Promise<ExtractionResult>;
}
```

- `src/lib/providers/index.ts` expose `getProvider()`, qui lit la
  configuration active (`src/lib/config.ts` — fusion `data/config.local.json`
  > variables d'environnement > défauts) et instancie le bon provider. Le
  reste de l'application n'appelle jamais un provider concret directement.
- `src/lib/providers/openai.ts` implémente `AIProvider` avec le SDK
  officiel `openai` : extraction par vision pour les images et PDF
  scannés, extraction texte pour le texte natif.
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

## Synchro avec l'appli mobile (`src/lib/sync/`)

Ajouté pour permettre à l'appli mobile (`android/`, voir son propre
`ARCHITECTURE.md`) de récupérer une copie locale des documents. Le contrat
complet (formats, routes, pairing) est dans
[SYNC_CONTRACTS.md](./SYNC_CONTRACTS.md) — cette section résume comment
c'est branché côté PC.

- **`src/lib/sync/token.ts`** — génère et persiste un jeton d'appairage
  (`data/config.local.json`, champ `syncToken`), régénérable depuis les
  Réglages (invalide tout appareil déjà pairé).
- **`src/lib/sync/network.ts`** — détecte l'IP locale et le port du
  serveur, utilisés pour construire le QR code de pairing.
- **`src/lib/sync/auth.ts`** — vérifie le header `Authorization: Bearer
  <token>` sur les routes `/api/sync/*` uniquement ; le reste de l'API
  (usage PC seul) reste sans authentification.
- **`src/lib/sync/pairing.ts`** — construit le payload JSON encodé dans le
  QR (`buildPairingInfo`), avec ou sans les identifiants du point d'accès
  mobile (mode hotspot, voir plus bas).
- **Routes** `GET /api/sync/manifest`, `GET
  /api/sync/documents/:id/file`, `POST /api/sync/receive` (voir
  CONTRACTS.md pour le détail) — réutilisent `src/lib/db/documents.ts` et
  `src/lib/storage/files.ts` existants, aucune duplication de la logique de
  documents.

### Pare-feu Windows en un clic (`src/lib/sync/firewall.ts`)

Le processus Next.js tourne sans droits admin. Ouvrir un port dans le
pare-feu Windows en demande. Plutôt que d'exiger que l'utilisateur ouvre
PowerShell lui-même (inenvisageable pour un client final), le bouton
« Autoriser dans le pare-feu Windows » des Réglages déclenche le popup UAC
natif de Windows (`Start-Process -Verb RunAs`) — l'utilisateur voit
exactement ce qui va se passer et clique lui-même Oui/Non. Jamais de
modification silencieuse. La règle couvre tous les profils réseau
(Domain/Private/Public), pas seulement Privé, car l'interface créée par le
point d'accès mobile (ci-dessous) n'est pas garantie d'être classée Privé
par Windows.

**Piège rencontré en pratique** : Windows peut avoir sa propre règle
générique de blocage pour un exécutable (ex. « Node.js JavaScript
Runtime », Bloquer, tout port) qui prend le pas sur nos règles spécifiques
au port 3000, quelle que soit leur configuration — à vérifier
(`Get-NetFirewallRule -Direction Inbound -Action Block`) si la synchro
échoue malgré une règle FindIt correctement créée.

### Mode point d'accès mobile (`src/lib/sync/hotspot.ts`)

Repli quand le wifi partagé isole les appareils entre eux (« AP/client
isolation », fréquent sur certains routeurs — un appareil peut alors
joindre la passerelle mais pas les autres appareils du même wifi, sans
qu'aucune configuration côté PC ou téléphone ne puisse le contourner). Le
PC démarre son propre point d'accès Wi-Fi (Point d'accès mobile Windows) :
il n'y a alors plus de routeur tiers dans l'équation, donc plus
d'isolation possible. Le protocole de synchro ne change pas — seule
l'adresse à laquelle on le joint change (`192.168.137.1`, adresse fixe de
l'Internet Connection Sharing de Windows).

Mécanisme technique : l'API nécessaire (`Windows.Networking.NetworkOperators.
NetworkOperatorTetheringManager`) n'existe qu'en WinRT, pas en Node —
`hotspot.ts` génère des scripts PowerShell écrits sur disque puis exécutés
(jamais de commande inline), avec le même principe d'élévation UAC
explicite que le pare-feu pour démarrer/arrêter le point d'accès. Lire son
statut ne modifie rien et ne demande pas d'élévation.

**Piège rencontré en pratique** : le script PowerShell élevé communique son
résultat à Node via un fichier (`Set-Content -Encoding UTF8`), qui préfixe
toujours un BOM (U+FEFF) — `JSON.parse` côté Node plante dessus si on ne le
retire pas explicitement avant de parser.

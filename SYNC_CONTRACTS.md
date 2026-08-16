# Contrats de synchro PC ↔ Mobile

Ce document fige le protocole entre le webapp PC (`src/`) et l'appli
mobile Expo (`android/`) pour qu'ils puissent être construits
indépendamment, potentiellement par deux agents en parallèle. Voir aussi
`android/ROADMAP.md` pour le séquencement (v1 = pull seul, v1.1 = push).

Principes : synchro manuelle, réseau local uniquement, PC = seule source de
classification IA, sélection des deux côtés. Détails dans
`android/ROADMAP.md` — ne pas les redécider ici.

## 1. Pairing

- Le PC génère un jeton persistant, stocké dans `data/config.local.json`
  (nouveau champ `syncToken`, généré à la première visite de la section
  Synchro des Réglages si absent, régénérable manuellement).
- Le PC affiche un QR code encodant ce JSON :
  ```json
  { "host": "192.168.1.x", "port": 3000, "token": "<syncToken>" }
  ```
  `host` = IP locale du PC sur l'interface réseau active (à détecter côté
  serveur, ex. via le module `os` de Node — prendre la première IPv4 non
  interne). Génération du QR : lib `qrcode` (npm), rendu en `<img>`
  data URL, pas de dépendance externe au runtime.
- Le téléphone scanne une fois (`expo-camera`), stocke `host`/`port`/
  `token` en local (`expo-secure-store`), les réutilise pour toutes les
  synchros suivantes sans re-scan.
- Toute requête vers les routes `/api/sync/*` doit porter
  `Authorization: Bearer <token>` ; réponse `401` si absent ou invalide.
  Les routes `/api/sync/*` sont les SEULES à exiger ce header — le reste
  de l'API continue de fonctionner sans auth (usage local mono-utilisateur
  inchangé pour l'usage PC seul).

## 2. Endpoints PC (nouveaux, sous `src/app/api/sync/`)

- `GET /api/sync/manifest` — auth requise. Retourne
  `{ documents: SyncManifestEntry[] }` où
  ```ts
  interface SyncManifestEntry {
    id: string;
    currentName: string;
    category: string;
    summary: string;
    mimeType: string;
    sizeBytes: number;
    documentDate?: string;
    updatedAt: string;
  }
  ```
  (sous-ensemble de `DocumentRecord`, uniquement les documents
  `status: "confirmed"`). Le mobile compare avec son cache local par
  `id` + `updatedAt` pour savoir quoi proposer au téléchargement
  (nouveau, ou modifié depuis la dernière synchro).
- `GET /api/sync/documents/:id/file` — auth requise. Sert les octets bruts
  du fichier (`Content-Type` = `mimeType` du document, `Content-Disposition:
  attachment`). Distinct de `/api/documents/:id/reveal` (qui ouvre
  l'Explorateur côté PC) — celui-ci sert vraiment le contenu par HTTP.
- `POST /api/sync/receive` — auth requise, `multipart/form-data`, champ
  `file` (un seul fichier par appel, contrairement à `/api/upload` qui en
  accepte plusieurs). Réutilise exactement le même pipeline que
  `/api/upload` (extraction IA, sauvegarde, `status: "pending_review"`) —
  implémentation recommandée : factoriser la logique commune plutôt que
  dupliquer, par exemple `src/lib/upload-pipeline.ts` appelé par les deux
  routes. **Non nécessaire pour la v1 mobile (pull seul)** — seulement à
  partir de v1.1 (push). Peut être livré dans un second temps.

## 3. Réglages PC — nouvelle section « Synchro »

Sur `/settings` : affiche le QR code de pairing, un bouton « Régénérer le
jeton » (invalide l'ancien — toute appli mobile déjà pairée devra
re-scanner), et un texte expliquant que seul un appareil ayant scanné ce
code peut lire/écrire via `/api/sync/*`.

## 4. Modèle local mobile (SQLite, via `expo-sqlite`)

```ts
interface LocalDocument {
  id: string; // = id PC une fois synchronisé, uuid local sinon
  currentName: string;
  category: string;
  summary: string;
  mimeType: string;
  sizeBytes: number;
  documentDate?: string;
  updatedAt: string;
  localFilePath: string; // chemin expo-file-system
  syncStatus: "synced" | "local_only" | "pending_push";
}
```

Fichiers stockés via `expo-file-system` (répertoire dédié de l'appli),
référencés par `localFilePath`. Aucune donnée n'est envoyée à un tiers —
uniquement PC ↔ téléphone sur le réseau local.

## 5. Recherche mobile

Port direct de `src/lib/search/fuzzy.ts` en TypeScript pur (le fichier
actuel n'a aucune dépendance Node — copier/adapter tel quel), exécuté
contre le contenu de la table `documents` locale plutôt que via un appel
réseau. Comportement identique au webapp : correspondance floue sur
`currentName`/`category`/`summary`, aucun résultat hors-sujet, pas de score
affiché en pourcentage.

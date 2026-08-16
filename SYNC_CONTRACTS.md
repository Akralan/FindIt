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

### 1bis. Mode hotspot (repli quand le wifi partagé isole les appareils)

Décision du 17 août 2026 : certains routeurs isolent les appareils entre eux
sur le même wifi (« AP/client isolation »), rendant le mode normal
inutilisable sans toucher aux réglages du routeur — chose qu'on ne peut pas
demander à un client. Repli : le PC devient son propre point d'accès wifi
(Point d'accès mobile Windows), qui n'a pas ce problème puisqu'il n'y a plus
de routeur tiers dans l'équation. Le protocole `/api/sync/*` ne change
strictement rien — seule l'adresse à laquelle on le joint change.

- Le payload du QR s'étend avec un champ optionnel :
  ```json
  {
    "host": "192.168.137.1",
    "port": 3000,
    "token": "<syncToken>",
    "hotspot": { "ssid": "FindIt-PC-1234", "password": "..." }
  }
  ```
  Présent uniquement quand l'utilisateur a démarré le point d'accès depuis
  les Réglages (bouton dédié, section Synchro) — `host` est alors l'IP du
  PC sur l'interface du point d'accès (`192.168.137.x`, adresse fixe de
  l'Internet Connection Sharing de Windows), pas celle du wifi habituel.
- Quand `hotspot` est présent dans le QR scanné, le mobile affiche un écran
  intermédiaire **avant** d'enregistrer le pairing : « Rejoins le wifi
  <ssid> » (mot de passe copié dans le presse-papier, bouton qui ouvre les
  réglages wifi Android via un intent système — pas de module natif custom,
  pas de connexion silencieuse). Une fois l'utilisateur revenu dans l'app
  (bouton « J'ai rejoint, continuer »), le pairing `host`/`port`/`token`
  s'enregistre exactement comme en mode normal — le reste du protocole est
  identique.
- Démarrer/arrêter le point d'accès (`src/lib/sync/hotspot.ts`) passe par
  une élévation Windows (UAC), jamais silencieusement — même logique que
  `src/lib/sync/firewall.ts`. Lire son statut ne modifie rien et ne demande
  pas d'élévation.
- La règle de pare-feu existante (`src/lib/sync/firewall.ts`) est scopée au
  profil réseau **Privé** ; l'interface créée par le point d'accès n'est pas
  garantie d'être classée ainsi par Windows. Pour rester simple et fiable
  plutôt que de traquer précisément la catégorie de chaque interface,
  élargir cette règle à *tous* les profils (Domain/Private/Public) — accep-
  table car elle ne couvre qu'un seul port dédié à la synchro.
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

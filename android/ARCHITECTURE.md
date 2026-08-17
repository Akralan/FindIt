# FindIt Mobile — Architecture

Décisions d'implémentation pour v0.1 (fondations) + v1 (synchro pull, lecture
seule), conformément à `ROADMAP.md` et au protocole défini dans
`../SYNC_CONTRACTS.md`. Ce document vit sous `android/` et ne modifie rien à
la racine du repo (voir consigne d'isolation — un autre agent travaille en
parallèle sur `src/`).

## Stack et bibliothèques

- **Expo SDK 57** (React Native 0.86, React 19), scaffoldé via
  `create-expo-app --template blank-typescript` puis converti à Expo Router
  (plutôt que le template `tabs` par défaut, pour garder une structure
  minimale et ajouter les onglets à la main).
- **Expo Router** (navigation par fichiers) — approche recommandée par Expo,
  moins de boilerplate qu'un `NavigationContainer` manuel. `app/_layout.tsx`
  (Stack racine) > `app/(tabs)/` (Documents, Réglages) + écrans poussés
  (`scan`, `sync`, `document/[id]`).
- **expo-sqlite** (API `SQLiteDatabase` moderne, `getAllAsync`/`runAsync`/
  `execAsync`) pour le cache local des métadonnées. Pas d'ORM (Drizzle,
  etc.) : une seule table, quelques requêtes — la dépendance ne se
  justifierait pas à cette échelle.
- **expo-file-system/legacy** plutôt que la nouvelle API `File`/`Directory`
  (SDK 54+) : l'API promesses classique (`documentDirectory`,
  `downloadAsync`, `getContentUriAsync`, `deleteAsync`) correspond
  directement aux besoins (télécharger un fichier avec un header d'auth,
  obtenir une URI de contenu Android pour un intent) sans réécrire ces flux
  dans l'idiome objet de la nouvelle API. `expo-file-system` maintient les
  deux en parallèle dans SDK 57 précisément pour ce cas d'usage.
- **expo-secure-store** pour `host`/`port`/`token` de pairing (Keystore
  Android / Keychain iOS) — jamais en AsyncStorage en clair.
- **expo-camera** (`CameraView` + `useCameraPermissions`) pour le scan QR
  (`barcodeScannerSettings={{ barcodeTypes: ["qr"] }}`).
- **expo-clipboard** (`Clipboard.setStringAsync`) pour copier le mot de passe
  du hotspot dans le presse-papier lors du pairing en mode hotspot (voir
  section dédiée ci-dessous) — aucune entrée `plugins` requise dans
  `app.json` (pas de permission native additionnelle, confirmé par
  `expo-doctor`, 21/21 vérifications toujours au vert après ajout).
- **expo-intent-launcher** + **expo-sharing** pour l'ouverture des fichiers
  non-image (PDF) : intent `ACTION_VIEW` Android avec une URI de contenu
  FileProvider (`FileSystem.getContentUriAsync`, obligatoire depuis Android 7
  — une URI `file://` brute lève `FileUriExposedException`), avec repli sur
  la feuille de partage système (`expo-sharing`) si aucune app ne gère
  l'intent. Choix assumé en v1 : pas de rendu PDF custom embarqué (pas de
  dépendance native lourde du type `react-native-pdf`), conformément à la
  consigne de la tâche.
- **react-native-safe-area-context**, **react-native-screens**,
  **react-native-gesture-handler** : dépendances requises par Expo Router
  lui-même (pas un choix indépendant).

### Écarté délibérément

- **Police Inter embarquée** (`@expo-google-fonts/inter` + `expo-font`) :
  tentée puis retirée. L'installer entrait en conflit de peer-dependencies
  avec l'arbre de dépendances propre à `expo-router` (des paquets
  `@radix-ui/*`/`vaul` utilisés par son support Web/`@expo/ui`), au point de
  forcer un `--legacy-peer-deps` qui a fait chuter 22 paquets de l'arbre de
  résolution normal. Le risque (casser une dépendance dont Expo Router a
  réellement besoin, pour un gain purement visuel) n'en valait pas la
  peine pour cette v1. L'app utilise donc la police système de chaque
  plateforme (San Francisco / Roboto), qui correspond déjà à la pile de
  fallback du webapp (`-apple-system, BlinkMacSystemFont, "Segoe UI"`).
  Tailles, poids et interlignage sont en revanche portés à l'identique
  (`src/theme/tokens.ts`). Revisiter si l'identité visuelle exacte (Inter)
  devient un impératif produit.
- **Alias `@/*`** : fonctionne sans `metro.config.js` ni
  `babel-plugin-module-resolver`. Depuis SDK 50+, le CLI Expo lit
  `compilerOptions.paths` de `tsconfig.json` et configure lui-même le
  resolver Metro (`@expo/cli/.../metro/createTypescriptResolver.js`) — un
  fichier custom aurait été redondant.
- **ORM SQLite / migrations versionnées formelles** : `src/db/schema.ts`
  exécute un simple `CREATE TABLE IF NOT EXISTS`. Un vrai système de
  migration (numéro de version, scripts incrémentaux) sera nécessaire dès
  que le schéma évoluera une première fois — pas encore le cas ici (une
  seule table, un seul champ ajouté depuis SYNC_CONTRACTS.md).

## Structure de dossiers

```
android/
  app/                      # Routes Expo Router (fichier = écran)
    _layout.tsx             # Stack racine, ThemeProvider, init SQLite
    (tabs)/
      _layout.tsx            # Tabs Rechercher / Sync
      index.tsx               # Recherche en avant + parcours de la bibliothèque locale
      sync.tsx                  # Statut de pairing (carte connectée ou viseur QR + fallback manuel)
    document/[id].tsx        # Détail plein écran (métadonnées + image zoomable ou bouton "ouvrir")
                              # — route conservée mais plus le point d'entrée principal (voir ci-dessous)
    scan.tsx                  # Scanner QR (modal, inchangé)
    sync-review.tsx             # Revue du manifeste + sélection + téléchargement
                                 # (ex-`app/sync.tsx`, renommé — voir "Navigation" ci-dessous)
  src/
    theme/                   # Tokens de design (palette, radii, spacing, typo) + withAlpha.ts
    types/document.ts        # Types partagés, portés du webapp + SYNC_CONTRACTS.md
    search/fuzzy.ts           # Port direct de src/lib/search/fuzzy.ts (webapp)
    db/                       # SQLite : schéma + CRUD documents + historique de recherche
    storage/                  # SecureStore (pairing, dernier index) + FileSystem (fichiers)
    sync/                     # Client HTTP /api/sync/* + calcul de diff
    hooks/                    # usePairing, useDocuments, useSearchHistory, useOpenLocalFile
    components/                # Screen, Button, SearchBar, DocumentRow, DocumentSheet, EmptyState,
                                # Chip, Checkbox, SectionLabel, icons.tsx (SVG)
    utils/                     # format.ts (dates/tailles/durées fr-FR), qrPayload.ts, deviceLabel.ts
```

Tout le code applicatif hors routes vit sous `src/` (convention Expo Router :
seul `app/` doit contenir des fichiers de route, tout le reste y serait
interprété comme un écran).

## Navigation à 2 onglets, bottom sheet, historique de recherche (passe du 17/08/2026)

Refonte de l'UI suivant un mockup fourni par l'utilisateur (2 onglets,
recherche en avant, bottom sheet de détail, écran Sync repensé). Le mockup
décrivait un modèle "recherche en direct sur le PC, aucun fichier copié" —
**explicitement écarté** : ce n'est pas notre architecture (voir
SYNC_CONTRACTS.md et la section "Synchro" plus haut — les documents et leurs
fichiers sont bien copiés en local, la recherche fonctionne hors connexion
PC). Tous les textes du mockup qui décrivaient ce mauvais modèle ont été
réécrits ; toutes les données d'exemple du mockup (nom d'appareil inventé,
puces de recherche pré-remplies, documents de démo) ont été ignorées au
profit des vraies données (`usePairing`, `useDocuments`, historique réel).

- **Onglets** : `(tabs)/index.tsx` (Rechercher, loupe) et `(tabs)/sync.tsx`
  (Sync, icône grille) remplacent Documents/Réglages. `(tabs)/settings.tsx`
  est supprimé.
- **Collision de route évitée** : le fichier tab `(tabs)/sync.tsx` se
  résout à l'URL `/sync` une fois le groupe `(tabs)` retiré par Expo Router
  — strictement le même chemin que l'ancien `app/sync.tsx` (écran de revue
  du manifeste). Pour éviter une ambiguïté de routing entre les deux, l'écran
  de revue/téléchargement (logique inchangée, voir SYNC_CONTRACTS.md) a été
  renommé `app/sync-review.tsx` (`/sync-review`), poussé depuis le bouton
  "Actualiser l'index" du nouvel onglet Sync. Toute la logique de
  téléchargement/diff de cet écran n'a **pas** été touchée, seul le nom de
  fichier et les références `router.push` ont changé.
- **Recherche** (`(tabs)/index.tsx`) : barre de recherche en avant (icône
  loupe SVG, bouton effacer), `FlatList` unique dont les données basculent
  entre "tous les documents locaux" (état inactif) et les résultats
  `searchDocuments` (dès qu'une requête est tapée) — pas de liste imbriquée
  dans un `ScrollView` (anti-pattern RN de listes virtualisées imbriquées).
  L'état inactif affiche les puces d'historique réel *et*, en dessous, la
  liste complète de la bibliothèque locale (`SectionLabel` "Tous les
  documents") : la capacité de parcourir tous les documents sans taper de
  requête est préservée, intégrée à la même liste plutôt qu'un lien séparé.
- **Bottom sheet** (`src/components/DocumentSheet.tsx`) : `Modal` natif
  (`transparent`, `animationType="slide"`) plutôt qu'une lib de bottom sheet
  tierce (`@gorhom/bottom-sheet` non installée, pas nécessaire pour un sheet
  statique sans drag-to-dismiss). Remplace la navigation vers
  `document/[id].tsx` comme point d'entrée principal depuis la recherche.
  Action principale = "Ouvrir le document" → `openFileExternally` (déjà
  existant, `src/storage/fileStorage.ts`, réutilisé via le nouveau hook
  `src/hooks/useOpenLocalFile.ts`), jamais "ouvrir sur le PC". La route
  `document/[id].tsx` (détail plein écran avec zoom image) reste dans le
  code, inchangée, mais n'est plus liée depuis l'UI — conservée par prudence
  (zoom d'image natif que le sheet ne réplique pas) plutôt que supprimée.
- **Historique de recherche réel** (`src/db/searchHistory.ts` +
  `src/hooks/useSearchHistory.ts`) : nouvelle table SQLite
  `search_history` (`CREATE TABLE IF NOT EXISTS`, même doctrine que
  `documents` — pas de migration formelle pour une table aussi simple).
  Enregistre uniquement les requêtes réellement tapées et validées
  (soumission clavier, ou tap sur une puce déjà affichée qui la remonte en
  tête) ; dédoublonnée insensible à la casse, plafonnée à 8 entrées. Vide au
  premier lancement — **aucune** suggestion pré-remplie.
- **Écran Sync** (`(tabs)/sync.tsx`) : état pairé = carte statut (libellé =
  `pairing.host` réel, jamais un nom d'appareil inventé — voir
  `src/utils/deviceLabel.ts`), stats réelles (nombre de documents locaux via
  `useDocuments`, dernier index réel — voir ci-dessous), boutons "Actualiser
  l'index" (`router.push("/sync-review")`) et "Déconnecter"
  (`forgetPairing`, avec confirmation). État non pairé = viseur QR décoratif
  (`View`s superposées, pas de lib de dégradé — `expo-linear-gradient` non
  installé, simplifié en aplat + fine ligne semi-transparente, voir
  limitations ci-dessous) + bouton qui demande la permission caméra puis
  pousse `/scan`, + repli "Saisir le code" : petit formulaire host/port/token
  local à l'écran (pas de nouvelle route), validé avec les mêmes règles que
  `parsePairingPayload` avant d'appeler `usePairing().setPairing`.
- **Dernier index réel** (`src/storage/syncMeta.ts`, `expo-secure-store`,
  une seule valeur ISO) : écrit par `app/sync-review.tsx` après un
  téléchargement ayant récupéré au moins un document, lu par l'onglet Sync
  (`formatRelativeTime`, `src/utils/format.ts`). Si jamais synchronisé,
  affiche "Jamais" plutôt qu'une valeur inventée.
- **Icônes SVG** (`src/components/icons.tsx`) : `react-native-svg` n'était
  **pas** déjà présent dans `node_modules` malgré l'hypothèse de départ
  (dépendance transitive d'`expo-router`/`react-native-screens`) — ajouté
  explicitement via `npx expo install react-native-svg` (version alignée
  SDK 57). Icônes portées telles quelles depuis les tracés SVG du mockup
  (loupe, grille+flèches de synchro, chevron, coche).
- **Couleurs** : aucune valeur hex codée en dur dans le nouveau code — tout
  passe par `src/theme/colors.ts` (déjà identique aux hex du mockup, vérifié
  token par token) ou par `withAlpha()` (`src/theme/withAlpha.ts`, nouveau)
  pour les fonds teintés semi-transparents (badges de catégorie, icône de
  statut connecté), qui prend toujours un token de couleur en entrée.

### Simplifications assumées par rapport au mockup

- Le viseur QR de l'onglet Sync (non pairé) reproduit la structure (coins
  en accolade, ligne de scan, légende) mais pas la texture de fond en
  hachures diagonales du mockup (dégradé + `repeating-linear-gradient`,
  purement décoratif, `expo-linear-gradient` non installé) — remplacée par
  un aplat `theme.colors.bg`.
- Les résultats de recherche sont des cartes arrondies individuelles
  (`DocumentRow`, bordure + radius par ligne) plutôt qu'un unique conteneur
  bordé avec séparateurs internes 1px comme dans le mockup — plus simple et
  plus robuste à implémenter avec `FlatList` à l'échelle "centaines de
  documents" (pas de logique de radius conditionnelle premier/dernier
  élément), sans changer l'information affichée par ligne (nom, résumé,
  catégorie, date, chevron).

## Design — portage des tokens webapp

`src/theme/colors.ts` recopie terme à terme les variables CSS de
`../src/app/globals.css` au moment de l'écriture (lues sur le disque le
16/08/2026 — voir avertissement ci-dessous si le webapp les a fait évoluer
depuis) : `--bg`, `--surface`, `--surface-hover`, `--border`,
`--border-subtle`, `--text`, `--text-muted`, `--text-faint`, `--accent`,
`--accent-hover`, `--danger`, `--success`, `--warning`, `--warning-bg`,
`--warning-dot`, pour les deux thèmes clair/sombre. Le mode sombre redéfinit
chaque token indépendamment (pas d'inversion mécanique), exactement comme le
fait `globals.css` avec `@media (prefers-color-scheme: dark)`.
`useColorScheme()` (React Native) pilote le choix, pas de bascule manuelle
dans les Réglages (le webapp non plus n'en propose pas).

`src/theme/tokens.ts` porte `borderRadius.card` / `card-lg` de
`../tailwind.config.ts` (12px / 16px) et une échelle d'espacement base 4px
équivalente à celle de Tailwind par défaut.

**⚠️ Ces valeurs sont un instantané.** Si `globals.css` ou
`tailwind.config.ts` changent côté webapp après cette tâche, il faut
reporter les nouvelles valeurs à la main dans `src/theme/` — aucun mécanisme
de partage automatique entre les deux plateformes (choix assumé : pas de
dépendance croisée entre `android/` et `src/`).

## Recherche floue

`src/search/fuzzy.ts` est un port direct de
`../src/lib/search/fuzzy.ts` : mêmes règles de score (mot entier > 3,
sous-chaîne > 1.5, préfixe partagé ≤ 1, pondération nom ×2 / catégorie ×1.5
/ résumé ×1), même normalisation (accents retirés, casse ignorée), même
plafond de résultats (20), même garantie de ne jamais renvoyer un document à
score nul. Seule différence : la fonction reçoit la liste de documents en
paramètre (`LocalDocument[]`, déjà chargée depuis SQLite via `useDocuments`)
au lieu d'aller la chercher elle-même en base — le fichier original du
webapp est `async` et interroge la DB SQLite serveur directement, ici la
liste tient en mémoire (échelle : dizaines/centaines de documents).

## Synchro (v1, pull uniquement)

1. **Pairing** (`app/scan.tsx`) : scan QR → parse strict du JSON
   `{ host, port, token }` (`src/utils/qrPayload.ts`, rejette tout payload
   mal formé sans jamais logger son contenu) → `expo-secure-store`
   (`src/storage/secureStore.ts`).
2. **Synchro** (`app/sync.tsx`) : `GET /api/sync/manifest` avec
   `Authorization: Bearer <token>` (`src/sync/api.ts`) → diff par `id` +
   `updatedAt` contre la table locale (`src/sync/diff.ts`, ne propose que
   `new`/`modified`, jamais les documents déjà identiques) → liste
   sélectionnable (filtre par catégorie, tout sélectionner/désélectionner)
   → téléchargement séquentiel des fichiers sélectionnés
   (`GET /api/sync/documents/:id/file`, header d'auth, écriture via
   `expo-file-system`) → `upsertLocalDocument(..., syncStatus: "synced")`.
   Échecs partiels tolérés : un document en échec ne bloque pas les
   suivants, un résumé est affiché à la fin (Alert avec noms des échecs).
3. **Détail** (`app/document/[id].tsx`) : image → `Image` dans un
   `ScrollView` avec `minimumZoomScale`/`maximumZoomScale` (zoom natif RN,
   pas de lib tierce) ; tout autre type (PDF, etc.) → bouton "Ouvrir le
   document" qui délègue à l'app système (voir choix expo-intent-launcher
   ci-dessus).

### Mode hotspot (repli, SYNC_CONTRACTS.md §1bis)

Certains routeurs isolent les appareils entre eux sur le même wifi (« AP/
client isolation »), rendant le pairing normal inutilisable. Repli côté PC :
démarrer son propre point d'accès wifi et encoder un champ optionnel
`hotspot: { ssid, password }` dans le QR, en plus de `host`/`port`/`token`
habituels. **Le protocole de synchro ne change pas du tout une fois pairé —
seul le chemin pour y arriver change** : une fois le pairing enregistré,
`app/sync.tsx` et le reste du code n'ont strictement aucune conscience que
le pairing vient d'un hotspot ou du wifi partagé habituel (même `host`/
`port`/`token`, mêmes routes `/api/sync/*`).

- **Rétro-compatibilité** : `hotspot` est un champ optionnel du payload
  existant, pas un nouveau format de QR. `parsePairingPayload`
  (`src/utils/qrPayload.ts`) reste capable de parser un QR sans ce champ
  exactement comme avant (retourne `PairingInfo` sans `hotspot`) ; un
  `hotspot` malformé (présent mais avec `ssid`/`password` invalides) fait
  rejeter tout le payload plutôt que de l'ignorer silencieusement — mieux
  vaut un "code non reconnu" explicite qu'un pairing à moitié abouti.
- **Écran intermédiaire** (`app/scan.tsx`) : quand le QR scanné contient
  `hotspot`, le pairing n'est **pas** enregistré immédiatement. Le scan
  bascule sur un écran dédié (« Rejoins le wifi du PC pour continuer ») qui :
  1. copie le mot de passe dans le presse-papier (`expo-clipboard`) dès
     l'affichage de l'écran, avec un message de repli si la copie échoue
     (rare, mais `setStringAsync` peut renvoyer `false`) ;
  2. propose un bouton "Ouvrir les réglages Wi-Fi" →
     `IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.WIFI_SETTINGS)`
     (même patron que l'usage existant d'`expo-intent-launcher` dans
     `src/storage/fileStorage.ts` : pas de connexion silencieuse au réseau,
     pas de module natif custom — on délègue entièrement à l'UI système
     Android, avec une alerte de repli si l'intent échoue) ;
  3. n'enregistre le pairing (`usePairing().setPairing`, exactement le même
     appel que le flux normal) qu'au clic sur "J'ai rejoint le wifi,
     continuer" ;
  4. propose "Annuler" pour revenir en arrière sans rien enregistrer et
     permettre un nouveau scan.
- **Aucune régression sur le flux normal** : quand `hotspot` est absent du
  payload scanné, `app/scan.tsx` suit exactement le même chemin qu'avant
  (pairing enregistré dès le scan, alerte de confirmation, retour en
  arrière) — la branche hotspot est un embranchement supplémentaire, pas une
  réécriture du chemin existant.

## Ce qui est fonctionnel vs. ce qui dépend du serveur PC

**Fonctionnel dès maintenant, sans le serveur** :
- Scaffold complet, thème clair/sombre, navigation à 2 onglets.
- Onglet Rechercher : recherche floue locale sur données déjà en base
  SQLite (une fois qu'il y en a), parcours de toute la bibliothèque locale
  en état inactif, historique de recherche réel persistant (SQLite),
  bottom sheet de détail, ouverture de fichier local.
- Onglet Sync : affichage de l'état de pairing (host réel, stats locales
  réelles), "déconnecter", formulaire de pairing manuel (fallback sans
  caméra) qui enregistre directement via `usePairing().setPairing` (pas
  besoin du serveur pour *enregistrer* le pairing, seulement pour la
  synchro elle-même ensuite).
- Écran de scan QR : fonctionne dès qu'un QR code valide au format
  `{ host, port, token }` lui est présenté (pas besoin que ce soit le PC —
  n'importe quel QR encodant ce JSON fonctionne pour tester le flux).
- Écran détail document (`document/[id].tsx`, plus lié depuis l'UI
  principale mais toujours fonctionnel) : fonctionne pour tout document
  déjà présent en local (mais aucun ne l'est tant qu'aucune synchro n'a
  réussi — pas de jeu de données de démo).

**Dépend des routes serveur `/api/sync/*` (pas encore livrées par l'autre
agent au moment de cette tâche)** :
- Le bouton "Actualiser l'index" (`app/sync-review.tsx`, ex-`app/sync.tsx`) : l'appel `fetchManifest`
  échouera (erreur réseau ou 404) tant que
  `GET /api/sync/manifest` n'existe pas côté PC. Le code gère cette erreur
  proprement (message "impossible de joindre l'ordinateur…", bouton
  Réessayer) mais n'a pas pu être testé contre un vrai serveur.
- Le téléchargement de fichiers (`GET /api/sync/documents/:id/file`) :
  même limitation.
- Le format exact de `SyncManifestEntry` a été respecté à la lettre depuis
  `SYNC_CONTRACTS.md`, mais n'a pas pu être validé contre une réponse HTTP
  réelle.

## Limites de vérification — à valider manuellement

Cet environnement ne dispose ni d'émulateur Android ni d'appareil physique.
N'ont **pas** été vérifiés et nécessitent un test manuel sur device/émulateur
une fois les deux côtés (PC + mobile) assemblés :

- Lancement réel de l'app (`expo start` + Expo Go ou build dev), rendu
  visuel effectif des écrans, absence de crash au démarrage.
- Permission caméra (dialogue système, comportement si refusée
  définitivement — le code gère le cas `!permission.granted` mais pas le
  cas "refusé de façon permanente" qui nécessiterait de rediriger vers les
  réglages système Android).
- Scan QR réel avec le QR code généré par le webapp PC (`lib qrcode`, format
  exact du payload) une fois cette fonctionnalité livrée côté PC.
- Synchro bout-en-bout contre un vrai serveur PC en `AI_PROVIDER=mock` une
  fois les routes `/api/sync/*` livrées : `GET /api/sync/manifest`,
  téléchargement de fichiers, gestion du `401` (token régénéré),
  et re-synchro incrémentale (deuxième passage ne re-propose que ce qui a
  changé).
- Ouverture réelle d'un PDF via l'intent système (`getContentUriAsync` +
  `ACTION_VIEW`) — l'API est correcte sur le papier (vérifiée contre les
  types TypeScript du module) mais le comportement runtime Android
  (FileProvider, choix de l'app cible) n'a pas pu être exercé.
- Zoom d'image (`ScrollView` avec `minimumZoomScale`/`maximumZoomScale`) —
  connu pour avoir un comportement moins fluide sur Android que sur iOS
  avec cette approche native basique ; à réévaluer si l'expérience s'avère
  insuffisante (auquel cas une lib dédiée type
  `react-native-image-zoom-viewer` serait le premier candidat).
- Aucun test automatisé (unitaire/e2e) n'a été écrit pour cette v1 — hors
  périmètre de la tâche telle que cadrée, mais à considérer avant la
  v1.1/v1.2.
- **Mode hotspot** (`app/scan.tsx`, écran intermédiaire) : non exercé sur
  device réel. À valider manuellement une fois le PC capable de démarrer un
  hotspot et d'encoder `hotspot` dans son QR : copie effective du mot de
  passe dans le presse-papier sur un vrai clavier Android (vérifier que le
  presse-papier le propose bien au moment de saisir le mot de passe dans les
  réglages Wi-Fi système), ouverture réelle de l'écran `WIFI_SETTINGS` via
  l'intent (comportement peut varier selon la surcouche constructeur —
  Samsung/Xiaomi/etc. redirigent parfois vers un écran différent des AOSP
  stock), et le parcours complet : scan → écran hotspot → bascule manuelle
  du wifi par l'utilisateur → retour dans l'app → "J'ai rejoint, continuer"
  → pairing enregistré → synchro fonctionnelle sur l'IP `192.168.137.x` du
  hotspot Windows.
- **Refonte 2 onglets / bottom sheet / historique (passe du 17/08/2026)** —
  entièrement non exercée sur device réel, à valider manuellement :
  rendu visuel effectif (couleurs claires/sombres, espacement, la palette a
  été vérifiée token par token contre le mockup mais jamais rendue), le
  `Modal` `animationType="slide"` du bottom sheet (fluidité, comportement du
  bouton retour Android — `onRequestClose` est câblé sur `Fermer` mais pas
  testé), le viseur QR décoratif de l'onglet Sync (aspect-ratio, tailles),
  la `FlatList` de recherche à l'échelle réelle de la bibliothèque
  (performance, `keyboardShouldPersistTaps`), le clavier et son bouton
  "Rechercher" déclenchant bien `onSubmitEditing`, le formulaire de
  pairing manuel (clavier numérique pour le port, retour visuel d'erreur),
  et les icônes `react-native-svg` nouvellement ajoutées (premier usage de
  cette lib dans le projet — à confirmer qu'elle s'autolink correctement au
  prochain build natif, `expo run:android` ou build EAS).

## Validation effectuée

- `npm install` réussit dans `android/` (590 paquets avec `expo-clipboard`).
  **Note (17/08/2026)** : au moment d'ajouter `expo-clipboard` pour le mode
  hotspot, `npm install`/`npm ci` échouaient déjà avant tout changement de ce
  paquet — conflit de peer-dependencies (`ERESOLVE`) entre `react@19.2.3`
  (pinné en dépendance directe) et `react-dom@19.2.8` que npm tentait de
  résoudre pour satisfaire les peers optionnels de `@radix-ui/*`/`vaul`
  utilisés par le support Web d'`expo-router`/`@expo/ui` — le même sous-
  arbre déjà identifié comme fragile dans la section « Écarté délibérément »
  ci-dessus (tentative Inter). Confirmé reproductible indépendamment de
  cette tâche (même échec avec `expo-clipboard` retiré de `package.json`) :
  drift du registre npm entre l'écriture initiale de ce document et cette
  tâche, `react-dom` n'apparaissant dans aucune résolution figée du
  `package-lock.json` existant (peer optionnel jamais réellement installé).
  Corrigé en ajoutant `"overrides": { "react-dom": "19.2.3" }` à
  `package.json` — force une version de `react-dom` cohérente avec `react`
  pour satisfaire les peers sans `--legacy-peer-deps` (qu'on continue
  d'éviter, cf. section Inter). `react-dom` n'est de toute façon jamais
  exécuté sur Android (seulement pertinent pour `expo start --web`,
  non utilisé par cette app).
- `npx tsc --noEmit` (strict, `noUncheckedIndexedAccess` activé) passe sans
  erreur ni avertissement sur l'ensemble du projet, y compris après l'ajout
  du mode hotspot.
- `npx expo-doctor` : 21/21 vérifications passées, y compris après l'ajout
  d'`expo-clipboard` (pas d'entrée `plugins` requise dans `app.json` pour
  cette lib).

**Passe du 17/08/2026 (refonte 2 onglets/bottom sheet/historique)** :
- `npx expo install react-native-svg` : pas déjà présent dans
  `node_modules` malgré l'hypothèse initiale (dépendance transitive
  d'`expo-router`/`react-native-screens`) — installé explicitement,
  13 paquets ajoutés, version alignée SDK 57 par le CLI Expo.
- `npx tsc --noEmit` (strict, `noUncheckedIndexedAccess` activé) : passe
  sans erreur après la refonte complète. Un seul point d'attention rencontré
  et corrigé : `tabBarIcon` d'Expo Router fournit un `color` typé
  `ColorValue` (`string | OpaqueColorValue`), pas `string` — converti
  explicitement (`String(color)`) au point d'appel dans
  `app/(tabs)/_layout.tsx` plutôt que d'élargir le type des props des
  icônes (nos couleurs de thème sont toujours des chaînes hex simples, la
  conversion est sans risque).
- `npx expo-doctor` : 21/21 vérifications passées après l'ajout de
  `react-native-svg`.
- Pas d'émulateur/device dans cet environnement pour vérifier le rendu réel
  — voir la liste détaillée dans "Limites de vérification" ci-dessus.

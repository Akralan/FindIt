# FindIt Mobile — Roadmap

Décisions actées le 16 août 2026, en discussion avec l'utilisateur (voir aussi
`../ROADMAP.md` pour la roadmap du webapp PC, et `../SYNC_CONTRACTS.md` pour
le protocole de synchro qui relie les deux).

**Stack retenue : Expo (React Native + TypeScript).** Choisie plutôt que
Capacitor pour un rendu vraiment natif (pas une WebView) et un accès propre
à la caméra, au système de fichiers et à une base locale (SQLite) — au prix
de réécrire l'UI dans l'idiome React Native plutôt que de réutiliser
directement les composants du webapp. Les types (`DocumentRecord` etc.) et
l'algorithme de recherche floue (`src/lib/search/fuzzy.ts`, TypeScript pur
sans dépendance Node) sont en revanche directement portables.

**Ce document annule et remplace** la ligne « Mobile — hors périmètre v1 et
v2 » de `../ROADMAP.md`, qui reflétait un choix antérieur devenu caduc.

---

## Principes directeurs

- **Synchro manuelle uniquement** — jamais de tâche de fond, jamais de
  démon. Cohérent avec l'esprit du produit (pas de compte, pas
  d'infrastructure à maintenir).
- **Le PC reste la seule source de classification IA.** Un document ajouté
  depuis le téléphone reste « brut » (pas de nom/catégorie suggérés) tant
  qu'il n'a pas été poussé vers le PC, où le pipeline d'extraction existant
  s'en charge normalement. L'appli mobile n'intègre aucun provider IA —
  elle reste un client (stockage local + capture + transfert), jamais un
  deuxième backend à maintenir.
- **Réseau local uniquement**, même wifi que le PC, pairing par QR code.
  Pas de relai cloud, pas de compte utilisateur.
- **Sélective des deux côtés** : chaque synchro affiche ce que l'autre
  appareil propose, l'utilisateur coche ce qu'il veut transférer — jamais
  un miroir automatique complet.

---

## v0.1 — Fondations (ce sprint)

- [ ] Scaffold du projet Expo (TypeScript, navigation, structure de dossiers)
- [ ] Portage des tokens de design (`../src/app/globals.css`) en thème
      React Native — même palette, même typo, même identité que le webapp
- [ ] Portage des types partagés (`DocumentRecord`, `DocumentSummary`)
- [ ] Écran liste + recherche floue locale, sur données de démonstration
      (pas encore de réseau)

## v1 — Pull seul (objectif initial : retrouver ses documents hors ligne)

- [ ] Pairing par QR code (scan du code affiché sur `/settings` côté PC)
- [ ] Récupération sélective des documents depuis le PC (tout, ou par
      catégorie) via `GET /api/sync/manifest`
- [ ] Téléchargement des fichiers (`GET /api/sync/documents/:id/file`) et
      stockage local (SQLite pour les métadonnées, système de fichiers pour
      les fichiers eux-mêmes)
- [ ] Recherche floue 100 % locale, fonctionne sans réseau
- [ ] Visualisation des fichiers (PDF/images) en local
- [ ] Synchro incrémentale (ne re-télécharge que ce qui a changé depuis la
      dernière fois, via `updatedAt`)

## v1.1 — Push (ajout depuis le téléphone)

- [ ] Capture caméra / sélection galerie sur le téléphone
- [ ] Les documents ajoutés côté mobile restent « bruts » jusqu'à l'envoi
- [ ] Écran de synchro à double sélection : « à récupérer du PC » /
      « à envoyer vers le PC », chacun avec ses propres cases à cocher
- [ ] Envoi vers `POST /api/sync/receive` — classification par le pipeline
      IA du PC à réception, comme un upload normal

## v1.2 — Publication Play Store

- [ ] Compte développeur Google Play (frais unique)
- [ ] Politique de confidentialité — nécessaire même pour une appli
      100 % locale/LAN, dès lors qu'elle traite des documents personnels
- [ ] Fiche store (description, captures d'écran), signature de l'app
- [ ] Publication et mise à jour

---

## Hors périmètre pour l'instant

- Classification IA embarquée dans l'appli mobile (dupliquerait
  `src/lib/providers/` — voir principe directeur ci-dessus)
- Synchro automatique / tâche de fond
- iOS — Expo permettrait de le viser plus tard sans réécriture, mais ce
  n'est pas demandé aujourd'hui

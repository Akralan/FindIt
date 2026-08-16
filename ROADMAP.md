# Roadmap — FindIt

Ce document remplace, pour la partie exécution, le séquencement indicatif du
document de cadrage (`cadrage-gestionnaire-documents-local.md`, section 11).
Il en garde l'esprit mais l'adapte au choix fait le 16 août 2026 : partir
d'une **webapp auto-hébergée**, utilisant un provider IA cloud (OpenAI)
plutôt que le pipeline OCR + modèle local prévu initialement, pour arriver
plus vite à quelque chose d'utilisable et publiable en open source. La
promesse « traitement 100 % local » du document original devient un jalon
v2 plutôt qu'une contrainte de départ — voir plus bas.

## v1.0 — MVP fonctionnel (ce build)

Objectif : une webapp qu'un utilisateur technique peut cloner, configurer
avec sa clé OpenAI, lancer, et utiliser pour de vrai sur ses documents.

- [x] Cadrage produit et arbitrages (déploiement, licence, roadmap)
- [x] Architecture : contrats d'API et de types (`CONTRACTS.md`,
      `src/lib/types.ts`), abstraction provider IA
- [x] Provider OpenAI (extraction) + provider `mock` pour développer sans clé
- [x] Pipeline d'extraction : images, PDF texte, PDF scanné (fallback image)
- [x] Stockage documents (JSON + fichiers sur disque) et historique
      d'événements (undo)
- [x] Upload avec prévisualisation, validation manuelle, renommage/
      classement automatique
- [x] Recherche en langage naturel : correspondance floue sur nom/catégorie/
      résumé (pas d'IA, pas d'embedding — voir note ci-dessous)
- [x] Interface : dashboard, fiche document, réglages (choix du provider
      depuis l'UI, sans toucher au code)
- [x] Build qui passe, app qui tourne en local de bout en bout
- [x] Packaging open source : README, LICENSE, CONTRIBUTING, `.env.example`

**Note sur la recherche** : la v1 utilisait initialement des embeddings
OpenAI + similarité cosinus, mais sans seuil de coupure — un document
totalement hors-sujet ressortait quand même avec un score non nul (ex :
un CV remonté à 20% sur une recherche « facture »), affiché en pourcentage
sans que ce chiffre soit interprétable pour l'utilisateur. Décision du
16 août 2026 : remplacé par une correspondance floue sur les champs déjà
écrits par l'IA à l'extraction (nom, catégorie, résumé), qui ne renvoie
que des résultats ayant une correspondance réelle. Plus simple, gratuit,
et le comportement attendu à l'échelle d'une bibliothèque personnelle.
Une vraie recherche sémantique reste une option v2 si le besoin apparaît
avec l'usage réel (voir section v2).

## v1.1 — Qualité et robustesse

- [ ] Vrais tests sur un corpus de documents français variés (reprendre le
      protocole de la section 10 du document de cadrage : ~50 documents,
      vérité terrain, mesure du taux de classement correct) — sert de
      baseline qualité avant toute promotion du produit
- [ ] Gestion des gros PDF multi-pages (au-delà de la première page)
- [ ] Traitement par lots avec file d'attente et limitation de débit
      (éviter de saturer l'API du provider sur un import massif)
- [ ] Détection de doublons
- [ ] Export / sauvegarde de la base (`db.json` + fichiers) en une archive

## v2 — Provider local (tenir la promesse du document de cadrage)

L'abstraction `AIProvider` (`src/lib/providers/`) a été conçue pour
accueillir ceci sans rien changer ailleurs dans l'app :

- [ ] Provider Ollama (modèles locaux type Llama/Qwen/Mistral quantifiés)
- [ ] Provider llama.cpp direct (serveur local, sans dépendance à Ollama)
- [ ] OCR local (Tesseract/PaddleOCR) pour les cas où un modèle vision
      local n'est pas dispo, réutilisant le chemin PDF scanné déjà en place
- [ ] Mode « 100 % local » explicite dans les Réglages : bascule qui
      masque/désactive tout provider cloud, avec avertissement clair si
      l'utilisateur en choisit un quand même
- [ ] Comparatif qualité local vs cloud sur le même corpus de test que v1.1
- [ ] Recherche sémantique (embeddings) en option, seulement si la
      correspondance floue de la v1 montre ses limites en usage réel — avec
      seuil de pertinence dès le départ, pas de score affiché à l'utilisateur

## v2.x — Distribution et ce que le document de cadrage visait à l'origine

- [ ] Application desktop (Tauri) packageant la webapp + un provider local
      par défaut — rapproche l'app de la vision initiale « zéro
      configuration, rien ne sort de la machine »
- [ ] Synchro entre appareils (reportée depuis le document de cadrage,
      section 7 — non prioritaire tant que la v1 n'a pas prouvé sa valeur)
- [ ] Piste licence commerciale : si un usage commercial est demandé, la
      licence actuelle (PolyForm Noncommercial) l'interdit délibérément —
      décision à revisiter si une demande réelle apparaît

## v-mobile — Appli Android (Expo), en parallèle de v2

Décision du 16 août 2026 : revient sur le choix initial « mobile hors
périmètre ». Motivation : les documents rangés sur le PC doivent être
retrouvables même sans accès au PC (ex. en déplacement, sans wifi partagé).
Roadmap détaillée, stack et séquencement dans
[android/ROADMAP.md](./android/ROADMAP.md) ; protocole de synchro PC ↔
mobile dans [SYNC_CONTRACTS.md](./SYNC_CONTRACTS.md). Résumé : appli Expo
(React Native + TypeScript) installable via Play Store, synchro manuelle et
sélective sur réseau local (pairing QR), v1 en lecture seule (pull), v1.1
ajoute la capture/l'envoi depuis le téléphone — le PC reste la seule source
de classification IA.

## Ce qui n'est volontairement pas dans le plan

- Comptes utilisateurs / multi-tenant — hors périmètre par choix du 16 août
  2026 (déploiement auto-hébergé mono-utilisateur)
- Édition de PDF, signature, fusion — hors périmètre, cf. document de
  cadrage section 6
- Classification IA embarquée côté mobile — voir android/ROADMAP.md
- Synchro automatique en tâche de fond — la synchro reste toujours
  déclenchée manuellement, des deux côtés

## Principe directeur pour toute contribution

Avant d'ajouter une fonctionnalité, vérifier qu'elle respecte les deux
propriétés qui font l'identité du produit selon le document de cadrage :
**pas d'abonnement, pas de compte** ; et que l'ajout d'un provider IA reste
un fichier isolé dans `src/lib/providers/`, jamais une dépendance dispersée
dans le reste du code.

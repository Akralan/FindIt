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
- [ ] Provider OpenAI (extraction + embeddings) + provider `mock` pour
      développer sans clé
- [ ] Pipeline d'extraction : images, PDF texte, PDF scanné (fallback image)
- [ ] Stockage documents (JSON + fichiers sur disque) et historique
      d'événements (undo)
- [ ] Upload avec prévisualisation, validation manuelle, renommage/
      classement automatique
- [ ] Recherche en langage naturel (embeddings + similarité cosinus)
- [ ] Interface : dashboard, fiche document, réglages (choix du provider
      depuis l'UI, sans toucher au code)
- [ ] Build qui passe, app qui tourne en local de bout en bout
- [ ] Packaging open source : README, LICENSE, CONTRIBUTING, `.env.example`

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

## v2.x — Distribution et ce que le document de cadrage visait à l'origine

- [ ] Application desktop (Tauri) packageant la webapp + un provider local
      par défaut — rapproche l'app de la vision initiale « zéro
      configuration, rien ne sort de la machine »
- [ ] Synchro entre appareils (reportée depuis le document de cadrage,
      section 7 — non prioritaire tant que la v1 n'a pas prouvé sa valeur)
- [ ] Piste licence commerciale : si un usage commercial est demandé, la
      licence actuelle (PolyForm Noncommercial) l'interdit délibérément —
      décision à revisiter si une demande réelle apparaît

## Ce qui n'est volontairement pas dans le plan

- Comptes utilisateurs / multi-tenant — hors périmètre par choix du 16 août
  2026 (déploiement auto-hébergé mono-utilisateur)
- Édition de PDF, signature, fusion — hors périmètre, cf. document de
  cadrage section 6
- Mobile — hors périmètre v1 et v2

## Principe directeur pour toute contribution

Avant d'ajouter une fonctionnalité, vérifier qu'elle respecte les deux
propriétés qui font l'identité du produit selon le document de cadrage :
**pas d'abonnement, pas de compte** ; et que l'ajout d'un provider IA reste
un fichier isolé dans `src/lib/providers/`, jamais une dépendance dispersée
dans le reste du code.

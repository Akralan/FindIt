# Document de cadrage — Gestionnaire de documents local

**Statut :** exploration / pré-décision
**Date :** 16 août 2026
**Nature du document :** cadrage initial. Les éléments marqués *(hypothèse)* restent à valider ; ceux marqués *(décidé)* sont arbitrés.

---

## 1. Résumé exécutif

Application desktop qui range automatiquement les documents : on dépose des fichiers, l'app les lit, les renomme, les classe, et permet de les retrouver par recherche en langage naturel. Tout le traitement se fait en local, sans envoi de données vers un serveur. Vente en achat unique, sans abonnement.

Le pari : la valeur ne vient pas de la technologie, qui est devenue une commodité, mais de la combinaison **traitement 100 % local + paiement unique**, qui est structurellement inaccessible aux acteurs SaaS du marché.

**Le projet est conditionné à un test de faisabilité** (section 10) qui doit être conduit avant tout développement.

---

## 2. Problème

Le classement manuel des documents ne tient pas dans la durée. Les systèmes de dossiers demandent une discipline que personne ne maintient, et la recherche par nom de fichier échoue dès que le nom ne correspond pas au vocabulaire de l'utilisateur — chercher « assurance voiture » ne trouve pas `Contrat_2026_final_v2.pdf`.

Le lieu réel de l'accumulation est l'ordinateur : dossier Téléchargements, pièces jointes de mails, scans, exports. Le téléphone sert à capturer, le PC à accumuler. La valeur du produit est sur l'accumulation.

---

## 3. État du marché

Trois familles existent déjà :

| Famille | Exemples | Limite exploitable |
|---|---|---|
| Auto-hébergé | Paperless-ngx, Docspell, Mayan EDMS | Docker obligatoire, réservé aux techniciens |
| SaaS IA | Filex AI, Renamer.ai, The Drive AI, Dropbox Dash | Cloud, abonnement, données envoyées à un tiers |
| Natif OS | Google Drive, Dropbox, Finder/Explorer | Recherche sémantique en cours d'intégration, sans classement actif |

**Constat :** le marché est encombré au milieu (SaaS généralistes anglophones sur abonnement). Les bords — local strict, achat unique, spécificités françaises — sont peu occupés.

**Risque structurel :** catégorie candidate au statut de « fonctionnalité, pas produit ». Les grands acteurs intègrent progressivement la recherche sémantique dans leur stockage. La défense est le traitement local, qu'ils ne proposeront pas.

---

## 4. Positionnement *(décidé)*

- **Traitement 100 % on-device.** Aucune donnée ne quitte la machine.
- **Achat unique.** Pas d'abonnement, pas de compte utilisateur.
- **Desktop d'abord.** Le mobile n'est pas au périmètre v1.
- **Synchro wifi vers un second appareil** — reportée en v2 (voir section 7).

### Correction apportée au positionnement initial

L'intention de départ visait le grand public. Cette cible est incohérente avec le reste : le grand public utilise déjà Google Drive gratuitement et ne paie pas à l'avance pour de la confidentialité.

Le public réellement adressé est **prosumer / indépendant / utilisateur averti hostile au cloud**. Cible plus étroite, mais disposée à payer 30-40 € en une fois là où le grand public résiste à 5 €. Cela déplace l'acquisition de l'ASO vers les communautés (Reddit, Hacker News, forums privacy et self-hosting).

---

## 5. Proposition de valeur

> Vos documents rangés automatiquement, et retrouvables en langage naturel — sans qu'aucun fichier ne quitte votre machine. Payé une fois.

Trois arguments, dans cet ordre :

1. **Confidentialité vérifiable.** Pas une promesse contractuelle : une propriété technique. Argument décisif pour les documents fiscaux, médicaux, contractuels.
2. **Pas d'abonnement.** Différenciation immédiate face à toute l'offre SaaS.
3. **Zéro configuration.** Pas de Docker, pas de règles à écrire, pas de serveur. C'est ce qui sépare le produit de Paperless-ngx.

---

## 6. Périmètre v1

### Inclus

- Surveillance d'un ou plusieurs dossiers (Téléchargements en priorité)
- OCR des PDF et images, y compris scans dégradés
- Renommage automatique selon un format lisible et cohérent
- Classement automatique en dossiers, sans règles à définir par l'utilisateur
- Recherche en langage naturel sur le contenu
- **Correction manuelle et historique d'annulation** — non négociable : l'IA se trompera, l'utilisateur doit pouvoir reprendre la main immédiatement
- Mode prévisualisation avant application des changements

### Exclu explicitement de la v1

- Synchro entre appareils *(v2)*
- Application mobile
- Édition de PDF, signature, fusion
- Collaboration, partage, multi-utilisateur
- Second système d'exploitation

---

## 7. Architecture technique *(hypothèse à confirmer par le test)*

| Couche | Choix pressenti | Justification |
|---|---|---|
| Application | Tauri | Binaire léger, contrairement à Electron |
| OCR | Tesseract ou PaddleOCR | Éprouvé, multilingue, local |
| Inférence | llama.cpp | Standard de l'inférence locale |
| Modèle | Modèle texte ~3B quantifié | ~2 Go, tourne partout |
| Recherche | Embeddings légers + SQLite | Aucune infrastructure, aucun serveur |

**Décision structurante :** OCR d'abord, puis modèle **texte** sur le résultat — pas de modèle vision. Les documents visés sont majoritairement textuels ; un VLM serait plus lourd et plus lent pour un gain marginal.

**Modèle téléchargé au premier lancement**, non embarqué dans l'installeur : installeur léger, et possibilité de changer de modèle sans republier l'application.

### Sur la synchro wifi

Reportée délibérément. Découverte des appareils sur le réseau, résolution de conflits, reprise après interruption, chiffrement du transfert : plusieurs mois de travail, pour une fiabilité que les utilisateurs compareront au cloud. Si la v1 ne se vend pas, ce temps est économisé ; si elle se vend, c'est l'argument de la v2.

---

## 8. Modèle économique et distribution

- **Prix cible :** 30-40 € en achat unique *(hypothèse)*
- **Essai gratuit limité** en nombre de documents traités, puis déblocage par licence
- **Vente en direct** via Lemon Squeezy ou Paddle : « merchant of record », donc TVA européenne gérée par le prestataire — point important pour une vente à des particuliers dans plusieurs pays
- **Licence validable hors-ligne** : aucun serveur à maintenir, cohérent avec la contrainte de coût nul
- **Coût marginal par utilisateur : nul.** C'est la propriété la plus précieuse de l'architecture retenue

**Point à traiter avant le premier euro :** la vente régulière de logiciel suppose une structure juridique (micro-entreprise en première approche). À vérifier auprès d'une source compétente — ce document n'est pas un avis juridique.

---

## 9. Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Qualité de classement insuffisante en local | **Critique** | Test préalable (section 10). Condition d'existence du produit. |
| Aucun avantage défendable — la techno est une commodité | Élevée | Défense = positionnement local + achat unique, pas la technologie |
| Acquisition sans budget | Élevée | Communautés ciblées plutôt qu'ASO ; construire l'audience avant le lancement |
| Absorption par les acteurs OS | Moyenne | Le traitement local reste hors de leur modèle |
| Achat unique = revenus non récurrents | Moyenne | Acquisition permanente nécessaire ; versions majeures payantes envisageables |
| Confiance envers un éditeur inconnu | Moyenne | Le local répond en grande partie à l'objection ; envisager l'ouverture du code du moteur |

---

## 10. Critère de décision Go / No-Go

**À réaliser avant toute écriture d'interface. Deux jours de travail maximum.**

Protocole :

1. Réunir 50 documents français réalistes et dégradés : scan de travers, facture EDF, avis d'imposition, devis d'artisan, ordonnance, photo de ticket froissé, relevé bancaire, contrat.
2. Écrire à la main la vérité terrain : nom attendu, catégorie attendue.
3. Faire passer le lot dans la chaîne OCR + modèle local envisagé, sur une machine représentative de la cible.
4. Mesurer le taux de classement correct et lister les échecs par catégorie.

**Seuil : 85 %.**

- **En dessous :** le produit n'existe pas, quelle que soit la qualité du reste. Soit on change de modèle ou de chaîne d'extraction et on retente, soit on abandonne la piste.
- **Au-dessus :** passage au développement.

Ce test est un script, pas une application. Il ne nécessite aucune décision d'interface ni de plateforme.

---

## 11. Séquencement indicatif

| Étape | Contenu | Condition de passage |
|---|---|---|
| 0 | Test des 50 documents | ≥ 85 % de classement correct |
| 1 | Prototype en ligne de commande : surveillance de dossier, OCR, renommage | Fonctionne sur un vrai dossier Téléchargements |
| 2 | Interface minimale + prévisualisation + annulation | Utilisable par quelqu'un d'autre que soi |
| 3 | Recherche sémantique | Retrouve un document par description approximative |
| 4 | Licence, essai gratuit, page de vente | Premier euro |
| 5 | Synchro wifi | Demande confirmée par les acheteurs |

---

## 12. Décisions en suspens

1. **Windows ou macOS pour la v1 ?** Mac : public plus enclin à payer, marché plus petit, Hazel et Renamer.ai déjà installés. Windows : volume supérieur, dossiers plus chaotiques, concurrence plus faible sur le payant one-shot. *Critère de départage recommandé : la machine utilisée quotidiennement, pour la vitesse d'itération.*
2. **Prix exact** — à confronter à des acheteurs potentiels avant fixation.
3. **Ouverture du code du moteur** — renforcerait la crédibilité de la promesse « rien ne sort de votre machine », au prix de la reproductibilité par des tiers.
4. **Taxonomie de classement par défaut** : à quel point l'app impose-t-elle sa structure, et à quel point s'adapte-t-elle à celle déjà en place chez l'utilisateur ?

# Packaging Windows (Electron) — reste à faire

Le packaging (`npm run electron:pack`) produit un installeur NSIS
fonctionnel et testé de bout en bout (serveur standalone + runtime Node
portable), voir `electron/main.cjs` et `electron-builder.yml`. Il reste
cependant plusieurs points avant une distribution sérieuse :

## Assets
- [ ] Remplacer `electron/icon.png` (généré par
      `scripts/generate-placeholder-icon.mjs`, un simple carré de
      couleur) par une vraie icône FindIt — PNG carré, 512×512 minimum.
      Même chemin, même commande de génération de l'.ico par
      electron-builder, rien d'autre à changer.

## Métadonnées
- [ ] Ajouter le champ `"author"` dans `package.json` (electron-builder
      le réclame en warning à chaque build).

## Fonctionnement offline
- [ ] `tesseract.js` télécharge par défaut ses fichiers worker/lang
      depuis un CDN au premier OCR — à vendorer localement (voir la doc
      tesseract.js sur `workerPath`/`corePath`/`langPath`) pour un vrai
      fonctionnement 100 % offline, cohérent avec le positionnement
      « local d'abord » du projet (voir README.md).

## Validation manuelle restante
- [ ] Lancer `npm run electron:dev` sur une machine avec écran pour
      valider l'affichage réel de la fenêtre, le tray, et le
      comportement à la fermeture (minimise plutôt que quitte) — non
      testable dans l'environnement où ce packaging a été construit
      (pas d'affichage).
- [ ] Installer l'installeur généré (`release/FindIt-Setup-*.exe`) sur
      une machine Windows propre (sans Node.js installé) pour confirmer
      qu'aucune dépendance externe n'est requise.
- [ ] Vérifier le comportement de mise à jour des données existantes :
      un utilisateur qui migre du mode Docker/self-hosted vers l'app
      desktop devra copier manuellement son dossier `data/` vers
      `%APPDATA%/FindIt/data` (aucun script de migration pour l'instant).

## Optimisation (non bloquant)
- [ ] La taille de l'installeur (~150 Mo) et de l'app installée
      (~500 Mo) est dominée par le runtime Chromium d'Electron
      (incompressible) et le runtime Node portable (~80 Mo, nécessaire
      pour faire tourner les modules natifs sans rebuild ABI). Si la
      taille devient un problème, évaluer Tauri (shell plus léger,
      même architecture de sidecar Node) — mais ça n'apporterait rien
      tant que le runtime Node + les binaires natifs restent la partie
      dominante.
- [ ] Envisager `electron-updater` pour l'auto-update, une fois qu'il y
      a un canal de distribution (release GitHub, serveur de mise à
      jour...).

## Repères techniques (pour la suite)
- Le serveur tourne dans un process Node **séparé** du Node interne
  d'Electron (voir `electron/main.cjs` → `resolveNodeBinary`) : aucun
  rebuild ABI nécessaire pour les modules natifs.
- `DATA_DIR` pointe vers `%APPDATA%/FindIt/data` (voir
  `app.getPath("userData")` dans `main.cjs`), jamais dans le dossier
  d'installation.
- Voir `scripts/assemble-standalone.mjs` pour la liste des élagages
  appliqués au bundle standalone (plateformes node-llama-cpp inutiles,
  fuite accidentelle d'`electron` dans le traçage Next).

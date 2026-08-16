# FindIt

Rangez et retrouvez vos documents automatiquement, en langage naturel.

FindIt est une webapp auto-hébergée : vous déposez vos fichiers (factures,
contrats, scans, exports divers), une IA les lit, leur donne un nom clair,
les classe dans un dossier pertinent, et vous permet ensuite de les
retrouver en tapant une phrase plutôt qu'en devinant un nom de fichier
(« assurance voiture 2026 » plutôt que `Contrat_2026_final_v2.pdf`).

## Positionnement

FindIt part d'une conviction : le classement manuel de documents ne tient
pas dans la durée, et la recherche par nom de fichier échoue dès que le nom
ne correspond pas au vocabulaire de celui qui cherche. L'esprit du projet
est **local d'abord** — pas d'abonnement, pas de compte utilisateur, vos
documents restent sous votre contrôle sur votre propre infrastructure.

Ce build (v1) est une **webapp auto-hébergée** : vous la faites tourner
vous-même (poste personnel, NAS, serveur), et elle utilise par défaut un
provider IA cloud, **OpenAI**, pour l'extraction de contenu et la recherche
sémantique. Ce choix a été fait pour arriver plus vite à un produit
utilisable et publiable, plutôt que de bâtir d'abord un pipeline OCR et un
modèle local — voir la discussion complète dans [ROADMAP.md](./ROADMAP.md).

L'architecture a cependant été pensée dès le départ pour ne pas dépendre
d'un provider en particulier : toute la logique IA passe par une
abstraction (`AIProvider`, voir [CONTRACTS.md](./CONTRACTS.md) et
[ARCHITECTURE.md](./ARCHITECTURE.md)). La v2 de la roadmap prévoit
l'ajout d'un provider **100 % local** (Ollama, llama.cpp, OCR local) sans
rien changer ailleurs dans l'application — c'est la promesse initiale du
projet, différée mais pas abandonnée.

Aucune donnée n'est envoyée à FindIt lui-même : ce que vous hébergez ne
communique qu'avec le provider IA que vous configurez (OpenAI par défaut,
ou aucun réseau du tout avec le provider `mock` de développement).

## Fonctionnalités v1

- **Upload** de documents (images, PDF, texte) par glisser-déposer ou
  sélection de fichiers.
- **Extraction et OCR via IA** : lecture du contenu, y compris pour les
  PDF scannés (rendu de la première page en image en cas d'absence de
  couche texte).
- **Renommage et classement automatiques** : nom de fichier et catégorie
  suggérés par l'IA à partir du contenu réel du document.
- **Prévisualisation et validation manuelle** : chaque document importé
  passe par un état « à valider » avant d'être confirmé, avec possibilité
  de corriger le nom et la catégorie.
- **Annulation (undo)** : chaque renommage, déplacement ou modification est
  historisé et peut être annulé.
- **Recherche en langage naturel** : correspondance floue sur le nom, la
  catégorie et le résumé de chaque document — pas d'IA ni d'embedding pour
  chercher, aucun résultat hors-sujet affiché juste pour remplir la liste.

## Stack technique

- [Next.js 14](https://nextjs.org/) (App Router), TypeScript strict
- [Tailwind CSS](https://tailwindcss.com/)
- Provider IA par défaut : [OpenAI](https://platform.openai.com/) (SDK
  officiel `openai`), via une abstraction remplaçable
- Stockage : JSON sur disque (`data/db.json`) + fichiers sur disque
  (`data/files/<catégorie>/<nom>`), pas de base de données externe — voir
  [ARCHITECTURE.md](./ARCHITECTURE.md) pour la justification et les limites
- Extraction PDF : `pdf-parse` (texte natif), `pdfjs-dist` + `@napi-rs/canvas`
  (rendu en image pour les PDF scannés)

## Installation

Prérequis : Node.js 18.18 ou supérieur.

```bash
git clone <url-du-dépôt>
cd FindIt
npm install
cp .env.example .env.local
```

Renseignez ensuite `OPENAI_API_KEY` dans `.env.local` (obtenue depuis votre
compte [OpenAI](https://platform.openai.com/api-keys)). Les autres valeurs
de `.env.example` ont des défauts raisonnables et peuvent être laissées
telles quelles.

```bash
npm run dev
```

L'application est accessible sur `http://localhost:3000`.

Pour développer ou faire une démo sans consommer d'appels API, mettez
`AI_PROVIDER=mock` dans `.env.local` — voir
[CONTRIBUTING.md](./CONTRIBUTING.md).

Le choix du provider et la clé API peuvent aussi être modifiés depuis la
page Réglages de l'application, sans redémarrage.

## Documentation

- [ROADMAP.md](./ROADMAP.md) — état d'avancement et plan pour les versions
  suivantes (provider local, tests qualité, application desktop...)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — schéma d'architecture, choix de
  stockage, abstraction provider
- [CONTRIBUTING.md](./CONTRIBUTING.md) — comment contribuer, notamment
  ajouter un nouveau provider IA
- [CONTRACTS.md](./CONTRACTS.md) — contrats internes (types, routes API,
  interfaces de modules) à respecter par toute contribution
- [LICENSE](./LICENSE) — texte complet de la licence

## Licence

FindIt est distribué sous licence **[PolyForm Noncommercial
1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)**.

En clair : le code source est ouvert, vous pouvez le lire, le modifier et
le redistribuer librement (y compris vos propres versions modifiées),
**sauf pour un usage commercial**, qui reste réservé.

À préciser honnêtement : PolyForm Noncommercial n'est **pas** une licence
« open source » au sens strict défini par l'[Open Source
Initiative](https://opensource.org/osd) — cette définition exige
notamment l'absence de restriction sur le domaine d'usage, ce que cette
licence ne respecte pas. FindIt est donc du logiciel à **source
disponible** (source-available), pas de l'open source au sens OSI, même si
l'esprit (lecture, modification, redistribution libres) s'en rapproche. Ce
choix est documenté et pourra être revisité — voir la section « v2.x » de
[ROADMAP.md](./ROADMAP.md).

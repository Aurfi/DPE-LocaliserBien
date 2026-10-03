# 🏠 Localisateur de Biens Immobiliers par DPE

Application web pour localiser des biens immobiliers en France à partir des données DPE publiques.

## ✨ Fonctionnalités

- **Recherche précise** : Trouvez un bien par surface, consommation énergétique et localisation
- **Lien cartographique** : Ouverture volontaire de Google Maps, sans carte intégrée
- **Mode sombre** : Interface adaptative jour/nuit
- **100% gratuit** : Sans compte ni publicité ; historique local facultatif
- **Responsive** : Optimisé pour mobile, tablette et desktop

## 🚀 Installation

### Prérequis
- Node.js 20+
- npm ou yarn

### Installation locale
```bash
# Cloner le repository
git clone [votre-repo]
cd dpe-france-web-static

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Lancer en développement
npm run dev
```

### Build pour production
```bash
npm run build
```

Les fichiers de production seront dans le dossier `dist/`

## 🔧 Configuration

Créez un fichier `.env` à la racine du projet avec vos paramètres :

```env
# Configuration du site
VITE_SITE_URL=https://votre-domaine.fr
VITE_SITE_NAME=VotreNom
VITE_CONTACT_EMAIL=contact@votre-domaine.fr

# API Configuration
# Important: For address search, use api-adresse (BAN)
VITE_ADEME_API_URL=https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines
VITE_GEO_API_URL=https://data.geopf.fr/geocodage
```

## 📂 Structure du Projet

```
├── src/
│   ├── components/     # Composants Vue réutilisables
│   ├── views/          # Pages principales
│   ├── utils/          # Fonctions utilitaires
│   └── assets/         # Images et styles
├── public/             # Fichiers statiques
├── dist/              # Build de production
└── .env               # Variables d'environnement
```

## 🛠 Technologies Utilisées

- **Vue.js 3** - Framework JavaScript progressif
- **Vite** - Build tool rapide
- **Tailwind CSS** - Framework CSS utility-first
- **Lucide Icons** - Icônes modernes et légères

## 📊 Sources de Données

- **DPE** : [ADEME](https://data.ademe.fr) - Diagnostics de Performance Énergétique
- **Géocodage** : [API Géo](https://geo.api.gouv.fr) - Données géographiques françaises

## 📜 Licence

Licence Ouverte 2.0 (Etalab) - Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🔒 Vie Privée

- ✅ Historique local désactivé par défaut, activable et effaçable
- ✅ Pas de cookies de tracking
- ✅ Pas de compte utilisateur requis
- ✅ Code source transparent

Les recherches interrogent directement l’ADEME et, selon le mode, l’IGN : ces
services reçoivent les critères nécessaires et les informations techniques de
connexion. L’application ne charge pas Google Fonts ou une carte Google intégrée.
Les journaux de l’hébergement et la messagerie doivent être documentés séparément.
La notice du candidat reste un projet, à finaliser avant la mise en production.

## 📝 Commandes Disponibles

```bash
npm run dev        # Serveur de développement
npm run build      # Build pour production
npm run preview    # Prévisualiser le build
npm run lint       # Vérifier le code avec Biome
npm run test       # Lancer les tests
npm run test:e2e   # Construire puis tester le navigateur sur le build de production
```

Les tests Playwright utilisent des réponses API synthétiques et bloquent les
service workers. Ils vérifient l’interface et les requêtes, pas la disponibilité
des API, Apache/OVH, les mises à jour du service worker ou de vrais téléphones.
Les navigateurs Playwright doivent être disponibles. Un Chromium déjà installé
peut être sélectionné avec `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` et les projets
`--project=chromium --project='Mobile Chrome'`. Les validations sur appareils réels,
les transitions du service worker et les contrôles OVH restent distincts.
Voir `OVH_DEPLOYMENT.md` avant toute mise en production.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.

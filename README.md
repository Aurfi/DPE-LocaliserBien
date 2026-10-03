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
- Node.js 24 LTS (également utilisé en CI)
- npm ou yarn

### Installation locale
```bash
# Cloner le repository
git clone [votre-repo]
cd dpe-france-web-static

# Installer les dépendances
npm ci

# Copier le fichier d'environnement
cp .env.example .env

# Lancer en développement
npm run dev
```

Le serveur de développement écoute uniquement sur `127.0.0.1` par défaut.
Pour une prévisualisation distante explicitement souhaitée sur un réseau de
confiance, lancez `npm run dev -- --host 0.0.0.0`. N’exposez pas ce serveur
sur Internet ; ne lancez que des sources et des configurations de confiance.

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
- **Ordinary CSS** - Styles applicatifs et vocabulaire fini conservé (voir `STATIC_STYLES.md`)
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
npm run test:coverage # Tests et seuils de couverture (70 %)
npm run check:styles # Vérifier les classes finies et leurs styles CSS
npm run test:styles # Régressions du contrôle des classes
npm run test:html # Interpolation HTML native et données structurées
npm run test:security # Vérifier la politique de dépendances hors réseau
npm run security:audit # Audits npm complets sans exception
npm run test:e2e   # Construire puis tester le navigateur sur le build de production
```

Les tests Playwright d’interface utilisent des réponses API synthétiques et bloquent
les service workers. Une suite Chromium distincte (`npm run test:pwa`) vérifie le
cycle de vie réel du PWA depuis deux références figées (un candidat antérieur
conservé et les octets publics de production capturés le 3 octobre 2026) vers le candidat
courant, sur localhost. Aucun ancien compilateur n’est réinstallé. Voir
[PWA_LIFECYCLE_TESTS.md](PWA_LIFECYCLE_TESTS.md) pour les prérequis et les preuves
requises. Ces suites ne valident pas la disponibilité des API, Apache/OVH ou de
vrais téléphones, ni l’identité de la version effectivement déployée.
Les navigateurs Playwright doivent être disponibles. Un Chromium déjà installé
peut être sélectionné avec `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` et les projets
`--project=chromium --project='Mobile Chrome'`. Les validations sur appareils réels,
les transitions du service worker et les contrôles OVH restent distincts.
Voir `OVH_DEPLOYMENT.md` avant toute mise en production.

## Maintenance des dépendances

La CI utilise Node 24 LTS, vérifie la couverture et bloque toute vulnérabilité
signalée par les audits npm complets et de production. Aucune exception n’est
admise. Les anciens compilateurs Tailwind et HTML et leur sous-arbre retiré sont
interdits dans le verrou et l’arbre installé. Les preuves restent dans
`reports/security/`, hors du site publié. Le contrôle de build interdit les outils
de compilation dans le JavaScript livré au navigateur. Voir
`STATIC_STYLES.md` et les étapes de sécurité du workflow CI.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.

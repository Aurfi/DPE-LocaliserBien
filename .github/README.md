# 🚀 CI/CD Pipeline

Ce projet utilise GitHub Actions pour l'intégration et le déploiement continus.

## 📋 Workflow

### CI Pipeline (`ci.yml`)
Déclenché sur chaque push et pull request :
- ✅ Linting avec Biome
- ✅ Tests unitaires  
- ✅ Build de production (avec .env.example)
- ✅ Audit de sécurité npm
- ✅ Vérification des données sensibles
- 📦 Artifacts de build disponibles pour 7 jours

## 🔧 Configuration locale

### Pre-commit hooks avec Husky
Les hooks sont automatiquement installés avec `npm install`.

Avant chaque commit :
1. **Linting** - Vérifie le style du code
2. **Sécurité** - Recherche de clés API exposées
3. **Données** - Vérifie les valeurs hardcodées

### Exécuter manuellement les vérifications
```bash
# Linting
npm run lint

# Tests
npm test

# Build avec config exemple
cp .env.example .env && npm run build
```

## 🔒 Sécurité

Le pipeline vérifie automatiquement :
- Absence de clés API dans le code
- Absence de mots de passe hardcodés
- Absence d'informations personnelles
- Vulnérabilités npm (audit)

## 📝 Badge de statut

Ajoutez ce badge à votre README principal :

```markdown
![CI/CD](https://github.com/[votre-username]/DPE-LocaliserBien/workflows/CI%2FCD%20Pipeline/badge.svg)
```

## 🆘 Dépannage

### Le build échoue localement
```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
```

### Les hooks ne fonctionnent pas
```bash
# Réinitialiser Husky
npx husky init
```

### Erreur de permissions sur GitHub Actions
Vérifiez dans Settings > Actions > General :
- Workflow permissions : Read and write permissions
- Allow GitHub Actions to create and approve pull requests ✓
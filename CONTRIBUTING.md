# Guide de Contribution

Merci de votre intérêt pour contribuer à FeedPlug ! Ce document fournit des directives pour contribuer au projet.

## 🚀 Démarrage Rapide

1. **Fork le projet** sur GitHub
2. **Clone votre fork** localement
3. **Créez une branche** pour votre fonctionnalité
4. **Faites vos modifications**
5. **Testez vos changements**
6. **Soumettez une Pull Request**

## 📋 Processus de Contribution

### 1. Signaler un Bug

Si vous trouvez un bug, veuillez :

1. Vérifier qu'il n'existe pas déjà dans les [Issues](https://github.com/your-org/feedplug/issues)
2. Créer une nouvelle issue avec le template "Bug Report"
3. Inclure :
   - Description détaillée du bug
   - Étapes pour reproduire
   - Comportement attendu vs réel
   - Captures d'écran si applicable
   - Informations sur l'environnement

### 2. Proposer une Fonctionnalité

Pour proposer une nouvelle fonctionnalité :

1. Vérifier qu'elle n'existe pas déjà dans les [Issues](https://github.com/your-org/feedplug/issues)
2. Créer une nouvelle issue avec le template "Feature Request"
3. Inclure :
   - Description détaillée de la fonctionnalité
   - Cas d'usage et bénéfices
   - Exemples d'implémentation si possible
   - Impact sur l'API existante

### 3. Développement

#### Configuration de l'Environnement

```bash
# Cloner le projet
git clone https://github.com/your-username/feedplug.git
cd feedplug

# Installer les dépendances
npm install

# Configurer l'environnement
cp env.example .env.local
# Éditer .env.local avec vos configurations

# Démarrer les services
docker-compose up -d

# Exécuter les migrations
npm run prisma:migrate

# Seed la base de données
npm run prisma:seed
```

#### Standards de Code

- **TypeScript** : Utiliser TypeScript pour tout le code
- **ESLint** : Respecter les règles ESLint configurées
- **Prettier** : Formater le code avec Prettier
- **Tests** : Écrire des tests pour les nouvelles fonctionnalités
- **Documentation** : Documenter les nouvelles APIs

#### Structure des Commits

Utiliser le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
type(scope): description

[body optionnel]

[footer optionnel]
```

Types supportés :
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage, points-virgules manquants, etc.
- `refactor`: Refactoring du code
- `test`: Ajout ou modification de tests
- `chore`: Tâches de maintenance

Exemples :
```
feat(auth): add OAuth2 support for Google
fix(import): handle CSV parsing errors
docs(api): update authentication examples
```

#### Tests

```bash
# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Couverture de code
npm run test:cov
```

**Exigences de tests :**
- Couverture de code ≥ 80%
- Tests unitaires pour tous les services
- Tests e2e pour les endpoints critiques
- Tests d'intégration pour les connecteurs

### 4. Pull Request

#### Avant de Soumettre

- [ ] Code formaté avec Prettier
- [ ] Tests passent (`npm run test`)
- [ ] Tests e2e passent (`npm run test:e2e`)
- [ ] Documentation mise à jour
- [ ] Changelog mis à jour
- [ ] Pas de conflits avec la branche principale

#### Template de PR

```markdown
## Description
Brève description des changements

## Type de changement
- [ ] Bug fix
- [ ] Nouvelle fonctionnalité
- [ ] Breaking change
- [ ] Documentation

## Tests
- [ ] Tests unitaires ajoutés/mis à jour
- [ ] Tests e2e ajoutés/mis à jour
- [ ] Tests manuels effectués

## Checklist
- [ ] Code auto-formaté
- [ ] Documentation mise à jour
- [ ] Changelog mis à jour
- [ ] Pas de conflits
```

## 🏗️ Architecture

### Structure du Projet

```
src/
├── modules/           # Modules fonctionnels
│   ├── auth/         # Authentification
│   ├── accounts/     # Gestion des comptes
│   ├── import/       # Import de flux
│   ├── mapping/      # Mapping et IA
│   ├── export/       # Export vers plateformes
│   ├── billing/      # Facturation
│   └── monitoring/   # Monitoring
├── common/           # Services communs
│   ├── prisma/       # Base de données
│   ├── redis/        # Cache
│   ├── storage/      # Stockage fichiers
│   └── pubsub/       # File d'attente
└── prisma/           # Schéma de base de données
```

### Principes de Design

- **Modularité** : Chaque module est indépendant
- **Testabilité** : Code facilement testable
- **Scalabilité** : Architecture prête pour la montée en charge
- **Sécurité** : Sécurité par défaut
- **Performance** : Optimisations intégrées

## 🔧 Outils de Développement

### Recommandés

- **IDE** : VS Code avec extensions TypeScript
- **Base de données** : pgAdmin ou DBeaver
- **API** : Postman ou Insomnia
- **Git** : GitKraken ou SourceTree

### Extensions VS Code

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

## 📚 Ressources

- [Documentation NestJS](https://docs.nestjs.com/)
- [Documentation Prisma](https://www.prisma.io/docs/)
- [Documentation Google Cloud](https://cloud.google.com/docs)
- [Documentation Pennylane](https://developers.pennylane.com/)

## 🤝 Code de Conduite

### Nos Engagements

- Environnement accueillant et inclusif
- Respect mutuel
- Collaboration constructive
- Focus sur ce qui est le mieux pour la communauté

### Comportements Inacceptables

- Langage ou images offensants
- Trolling, commentaires insultants ou attaques personnelles
- Harcèlement public ou privé
- Divulgation d'informations privées sans permission

## 📞 Support

- **Issues** : [GitHub Issues](https://github.com/your-org/feedplug/issues)
- **Discussions** : [GitHub Discussions](https://github.com/your-org/feedplug/discussions)
- **Email** : dev@feedplug.com

## 🎉 Reconnaissance

Merci à tous les contributeurs qui rendent FeedPlug possible !

---

**Merci de contribuer à FeedPlug ! 🚀**

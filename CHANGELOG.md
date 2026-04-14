# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Catalogue** : pagination (50 produits par page, un flux à la fois), virtualisation de la liste (@tanstack/react-virtual), recherche serveur (paramètre `q`), filtres (avec image, avec prix, mis à jour 7 jours), tri (titre, date, prix), suggestions de recherche, URL partageable (`?q=`)
- **Fiche produit** : onglets (Résumé, Qualité & score, Tous les champs, Enrichissement), barre d’actions sticky, sélecteur « Valeur du flux » / « Autre valeur » pour chaque champ en édition (bloc Informations + grille mapping)
- **Sources** : une seule page `/sources` ; redirection `/admin/sources` → `/sources`
- **Sentry** : capture des erreurs fiche produit (chargement, sauvegarde, enrichissement, score) avec tags `area` et `itemId` ; doc `SENTRY_ALERTES.md` à jour
- **Tests E2E** : Playwright dans le frontend (tests catalogue + fiche produit + onglets)
- Structure de base du projet NestJS
- Modules d'authentification et de gestion des comptes
- Système d'import de flux (URL, SFTP, API)
- Système de mapping et d'optimisation IA
- Connecteurs pour Google, Meta, Amazon et Mirakl
- Intégration Pennylane pour la facturation
- Système de monitoring et de logs
- Configuration Docker pour le développement local
- Pipeline CI/CD avec GitHub Actions
- Infrastructure Terraform pour Google Cloud
- Tests unitaires et e2e
- Documentation complète

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [1.0.0] - 2024-01-XX

### Added
- Version initiale de FeedPlug
- Architecture multi-tenant
- Support des flux produits multi-plateformes
- Optimisation IA des contenus
- Facturation automatique
- Monitoring en temps réel

---

## Types de changements

- **Added** pour les nouvelles fonctionnalités
- **Changed** pour les changements de fonctionnalités existantes
- **Deprecated** pour les fonctionnalités qui seront supprimées
- **Removed** pour les fonctionnalités supprimées
- **Fixed** pour les corrections de bugs
- **Security** pour les améliorations de sécurité

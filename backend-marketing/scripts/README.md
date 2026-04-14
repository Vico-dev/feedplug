# Scripts d’administration backend-marketing

Ce dossier contient des scripts utilitaires optionnels.

- `apply-migration.sh`: exécute manuellement les migrations SQL (leads + ingestion) sur Cloud SQL.
  - Utile seulement si vous souhaitez forcer la création/MAJ du schéma en dehors du démarrage applicatif.
  - Le serveur applique déjà automatiquement la migration d’ingestion `002_ingestion_models.sql` au démarrage si la base est accessible.
- `deploy-isolated-backend.sh`: construit et déploie uniquement `backend-marketing` via Cloud Build, en réutilisant la config live Cloud Run.
  - Utile quand le dépôt parent n’est pas isolé proprement et qu’on veut éviter d’envoyer des changements hors backend.

Bonnes pratiques:
- Préférez le déploiement standard: Prisma se connecte et applique la création conditionnelle au boot.
- Utilisez ce script uniquement pour des interventions manuelles ou debugging.

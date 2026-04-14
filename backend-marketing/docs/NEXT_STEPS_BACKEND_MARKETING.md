# Next steps — Backend marketing (historique / spécifique)

Document conservé pour référence. **Prochaines étapes globales** : voir **`docs/NEXT_STEPS.md`** à la racine du repo.

Ce fichier décrit les étapes historiques / spécifiques au backend marketing (gestion IA, migrations, clés API, etc.). À utiliser en complément de la roadmap centrale.

---

## Appliquer la migration SQL (si pas encore fait)

```bash
# Option A : Via Cloud SQL Proxy
cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db
# Autre terminal
psql -h localhost -U feedplug_user -d feedplug_marketing \
  -f backend-marketing/prisma/migrations/005_ai_management.sql

# Option B : Via le script
cd backend-marketing/scripts
./apply-ai-migration.sh [MOT_DE_PASSE]
```

Vérification : `SELECT * FROM "AIProvider";` (doit retourner les providers).

---

## Configurer une clé API Gemini

- **Via l’interface** : `/admin/ai-keys` → Google Gemini → Ajouter une clé.
- **Via l’API** : `POST /api/v1/ai/providers/gemini/keys` avec `Authorization: Bearer YOUR_TOKEN`.

---

## Améliorations techniques (backlog)

- Chiffrement des clés API (actuellement en clair).
- Batch processing pour optimisations en masse.
- Alertes avant dépassement de quota (80 %).

---

## Checklist déploiement backend

- [ ] Migrations appliquées (voir `backend-marketing/prisma/migrations/`).
- [ ] Clé Gemini (ou GEMINI_API_KEY) configurée.
- [ ] SMTP configuré pour prod (voir `DEPLOI_CHECKLIST.md`).

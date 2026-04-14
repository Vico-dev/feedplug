# Objectif 99,99 % (quatre 9) — Prérequis et actions

Document de référence pour atteindre **99,99 % de disponibilité** (~52 min de coupure/an max) sur l’API et les flux critiques FeedPlug.

---

## 1. Prérequis nécessaires (checklist)

### 1.1 Infrastructure

| Prérequis | Description | Statut actuel |
|-----------|-------------|----------------|
| **Cloud SQL en haute disponibilité** | Instance en mode **regional (HA)** : multi-zone, failover auto. Sans ça, une panne zone = coupure DB. | ✅ Terraform : `availability_type = "REGIONAL"` en prod |
| **Cloud Run : pas de scale à zéro en prod** | **min-instances ≥ 1** pour éviter cold start = 503 pendant le démarrage. | ✅ `cloudbuild-backend-marketing.yaml` : `--min-instances 1` |
| **Backups DB** | Sauvegardes auto + PITR (point-in-time recovery). | ✅ Terraform : `backup_configuration` + `point_in_time_recovery_enabled` |
| **SSL / chiffrement** | DB en SSL, secrets dans Secret Manager. | ✅ Terraform : `require_ssl`, secrets |
| **Pas de SPOF réseau** | Load balancer géré par GCP, une seule région acceptable pour quatre 9. | ✅ Cloud Run géré multi-zone dans la région |

### 1.2 Application

| Prérequis | Description | Statut actuel |
|-----------|-------------|----------------|
| **Health check “readiness”** | Un endpoint (ex. `/api/v1/health`) qui vérifie DB (et optionnellement Redis) et retourne 503 si indisponible. Cloud Run utilise ça pour ne pas envoyer de trafic aux instances non prêtes. | ✅ `/api/v1/health` avec check DB + timeout 5 s |
| **Health check “liveness”** | Endpoint léger (ex. `GET /health`) qui répond 200 si le process est vivant. | ✅ `GET /health` → `{ status: 'ok' }` |
| **Graceful shutdown** | Sur SIGTERM : arrêter d’accepter de nouvelles requêtes, attendre les requêtes en cours (avec timeout), puis fermer DB et quitter. Sinon chaque déploiement coupe des requêtes. | ✅ `server.close()` + attente (timeout 30 s) puis Prisma disconnect (voir `server-minimal.js`) |
| **Timeouts sur appels externes** | Tous les appels (DB, APIs IA, GCS, etc.) avec timeout et retry si pertinent. | ✅ Health DB 5 s ; `lib/resilience.js` pour certains appels |
| **Gestion des erreurs non capturées** | `unhandledRejection` / `uncaughtException` → logs + Sentry, puis exit propre. | ✅ Instrumentation Sentry + handlers (cf. Chaos Monkey doc) |

### 1.3 Opérations et mesure

| Prérequis | Description | Statut actuel |
|-----------|-------------|----------------|
| **Déploiements sans coupure** | Nouvelle révision Cloud Run déployée avant d’envoyer le trafic ; pas d’arrêt brutal de l’ancienne révision. | ✅ Comportement par défaut Cloud Run (rolling) |
| **Mesure du temps de disponibilité** | SLO explicite (ex. “99,99 % des requêtes GET /api/v1/health en 200 sur une fenêtre glissante 30 j”) et calcul du downtime. | ✅ Uptime check GCP (Terraform `monitoring.tf`) ; dashboard / error budget dans Cloud Monitoring |
| **Alerting sur indisponibilité** | Dès que le health renvoie 503 ou que le taux d’erreur 5xx dépasse un seuil → alerte (Slack, email, PagerDuty). | ✅ Alerte « API indisponible » (Terraform `monitoring.tf`) ; ajouter canal notification dans GCP |
| **Runbook / procédures** | Que faire en cas d’incident (vérifier health, logs Cloud Run, DB, rollback). | ✅ `docs/runbook-indisponibilite.md` (compléter : contacts / astreinte) |
| **Communication SLA** | Cible 99,99 % écrite dans les contrats / page SLA clients. | ❌ À définir côté commercial / legal |

---

## 2. Ce qu’il faut faire dès à présent (plan d’action)

Priorisation : **impact direct sur la disponibilité** et **effort raisonnable** en premier.

### Priorité 1 — Court terme (1–2 semaines)

#### 1. Cloud SQL en haute disponibilité (prod uniquement)

- **Fichier :** `terraform/main.tf` (resource `google_sql_database_instance`)
- **Action :** En environnement `production`, ajouter une configuration **regional HA** pour Cloud SQL.
- **Exemple (à adapter à la version du provider Terraform) :**
  - Dans `settings`, ajouter `availability_type = "REGIONAL"` pour l’instance de prod. Cela crée une instance avec standby dans une autre zone ; en cas de panne zone, failover automatique.
- **Attention :** Peut impliquer un redéploiement ou un recréation d’instance selon la config actuelle ; à faire en fenêtre de maintenance si nécessaire.

#### 2. Min instances ≥ 1 en production (Cloud Run) — fait

- **Fichier :** `cloudbuild-backend-marketing.yaml`.
- **Action :** `--min-instances` passé à `1` (SLO 99,99 %).
- **Effet :** Plus de cold start au premier request → moins de 503 au démarrage.

#### 3. Graceful shutdown complet (backend-marketing)

- **Fichier :** `backend-marketing/server-minimal.js`
- **Action :**
  1. Conserver une référence au **serveur HTTP** retourné par `app.listen()` (ou `http.createServer(app)` puis `server.listen()`).
  2. Sur **SIGTERM** : appeler `server.close()` pour ne plus accepter de nouvelles connexions, attendre que les requêtes en cours se terminent (avec un timeout max, ex. 30 s), puis `prisma.$disconnect()` et `process.exit(0)`.
- **Effet :** Lors d’un déploiement ou scale-in, les requêtes en cours ne sont pas coupées brutalement.

### Priorité 2 — Très bientôt (2–4 semaines)

#### 4. SLO et mesure de la disponibilité — en place (Terraform)

- **Fichier :** `terraform/monitoring.tf` (uptime check toutes les 60 s sur `GET /api/v1/health`).
- **Action restante :** Dans Cloud Console → Monitoring → Dashboards, créer un dashboard avec le taux de succès de l’uptime check et l’error budget 99,99 % si besoin.
- **Variable optionnelle :** Si l’API en prod est **backend-marketing** (déployée par Cloud Build), définir `health_check_url` dans `terraform.tfvars` (ex. `https://feedplug-backend-marketing-xxx.run.app/api/v1/health`) pour que l’uptime check cible la bonne URL.

#### 5. Alerting “service down” — en place (Terraform)

- **Fichier :** `terraform/monitoring.tf` (politique d’alerte « FeedPlug API indisponible » : déclenchement après 2 min d’échec du health check).
- **Action restante :** Dans GCP → Monitoring → Alerting → modifier la politique « FeedPlug API indisponible » pour ajouter un **canal de notification** (email, Slack webhook ou PagerDuty) afin de recevoir les alertes.

#### 6. Runbook “incident disponibilité”

- **Fichier :** `docs/runbook-indisponibilite.md` (créé ; à compléter avec contacts / astreinte).
- **Contenu :** Vérifier health, Cloud Run, Cloud SQL, Sentry ; rollback si déploiement récent ; suivi error budget et communication client.

### Priorité 3 — Consolidation

#### 7. Formaliser le SLA 99,99 % côté commercial

- Mettre par écrit la cible “99,99 %” dans les contrats ou la page SLA.
- Prévoir une clause de crédit ou procédure si le SLA n’est pas tenu (optionnel mais rassurant pour les grands comptes).

#### 8. Chaos testing régulier (staging)

- Vous avez déjà Chaos Monkey ; l’utiliser régulièrement en staging (db_fail, latency, error500) et vérifier que les alertes et Sentry se déclenchent, et que le runbook est suivi.

#### 9. Optionnel : Redis / Upstash

- Si des fonctionnalités critiques dépendent de Redis (sessions, cache), vérifier la configuration haute disponibilité côté Upstash (multi-zone / failover selon l’offre) et inclure Redis dans le health check si nécessaire.

---

## 3. Résumé “dès à présent”

| Action | Où | Effet |
|--------|-----|--------|
| Cloud SQL en **REGIONAL (HA)** en prod | Terraform | Réduit fortement le risque de coupure DB (panne zone). |
| **min-instances ≥ 1** en prod (Cloud Run) | cloudbuild / config déploiement | Supprime les 503 de cold start. |
| **Graceful shutdown** (server.close + attente requêtes) | server-minimal.js | Évite de couper les requêtes en cours à chaque déploiement. |
| **SLO 99,99 %** + dashboard / error budget | Cloud Monitoring ou outil tiers | Mesure et visibilité sur l’objectif. |
| **Alerting** sur 503 / 5xx + notification | Cloud Monitoring + Slack/email | Réaction rapide aux pannes. |
| **Runbook** incident | docs/ | Réponse structurée en cas d’indisponibilité. |

En faisant **Priorité 1** en premier, vous posez les bases techniques (DB HA, pas de scale à zéro, arrêts propres). Les **Priorité 2** permettent de **mesurer** et **réagir** pour viser et tenir 99,99 % dans la durée.

# Runbook — Indisponibilité API / objectif 99,99 %

À suivre quand l’API FeedPlug est inaccessible ou dégradée (health 503, 5xx, timeouts).

---

## 1. Vérifications immédiates

1. **Health check**
   - `GET https://api.feedplug.com/api/v1/health` (ou l’URL prod du backend).
   - Si 503 : DB ou service down. Si 200 : problème peut être intermittent ou côté frontend.

2. **Console GCP**
   - **Cloud Run** : révision en erreur ? métriques (requêtes, latence, 5xx) ?
   - **Cloud SQL** : instance en lecture/écriture ? connexions saturées ? CPU élevé ?

3. **Sentry** (si configuré)
   - Pic d’erreurs ? Exceptions non gérées, timeouts DB, 5xx.

---

## 2. Actions selon la cause probable

### Déploiement récent

- **Cloud Run** → Revenir à la révision précédente (Console Cloud Run → onglet Revisions → déployer l’avant-dernière en 100 % du trafic).
- Redéployer une version stable si le rollback suffit.

### Base de données (health 503, erreurs Prisma/DB)

- Vérifier **Cloud SQL** : état de l’instance, connexions, espace disque.
- Si instance en panne ou zone impactée : le mode **REGIONAL (HA)** doit déclencher un failover ; attendre quelques minutes et revérifier le health.
- Si connexions saturées : vérifier les connexions ouvertes (Prisma pool), redémarrer le service Cloud Run pour libérer les connexions si besoin.

### Surcharge / timeouts

- **Cloud Run** : monter temporairement `max-instances` ou la taille (CPU/RAM) si la charge est légitimement plus haute.
- Vérifier les jobs lourds (import/export, IA) : ne pas lancer de gros traitements en parallèle si possible.

### Problème externe (GCP, région)

- Consulter [Google Cloud Status](https://status.cloud.google.com/).
- Si incident GCP : attendre la résolution, communiquer aux clients (maintenance / incident fournisseur).

---

## 3. Après l’incident

- Noter l’heure de début / fin et la cause dans un doc ou un ticket.
- Mettre à jour le **temps d’indisponibilité** pour le SLO 99,99 % (error budget).
- Si dépassement du SLA contractuel : déclencher la procédure client (crédit, communication) selon vos engagements.

---

## 4. Contacts / escalade

- À compléter : qui est d’astreinte ? Slack / PagerDuty / email pour les alertes ?

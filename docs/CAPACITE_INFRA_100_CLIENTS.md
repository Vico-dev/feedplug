# Capacité infra : 100 clients × 1K produits × 5 canaux

## Contexte

Question : **l’infra actuelle supporterait-elle 100 comptes avec 1 000 produits chacun sur 5 canaux ?**

---

## Infra actuelle (prod)

| Composant | Config actuelle | Fichier / source |
|-----------|-----------------|------------------|
| **Cloud SQL** | `db-custom-2-8192` (2 vCPU, 8 GB RAM), REGIONAL (HA) | `terraform/main.tf` |
| **Backend (API)** | Cloud Run : 1 CPU, 2 Gi, **max 10 instances**, min 1 | `cloudbuild-backend-marketing.yaml` |
| **Connexions DB** | Non limitées explicitement dans le code (Prisma défaut) | Chaque instance Prisma ouvre un petit pool (~5–10 connexions selon config) |

---

## Charge théorique : 100 clients × 1K produits × 5 canaux

| Ressource | Ordre de grandeur | Commentaire |
|-----------|------------------|------------|
| **FeedItem** | 100 × 1 000 = **100 000 lignes** | Volume très raisonnable pour PostgreSQL (index sur `feedid` / jointure `Feed.accountid`). Stockage ~200–500 MB selon taille des champs. |
| **ExportChannel** | 100 × 5 = **500 lignes** | Négligeable. |
| **Requêtes / jour** | Ingestion : ~100 runs/jour si 1 run/account/jour ; exports : idem, déclenchés par utilisateur ou cron | Pic possible si beaucoup d’exports manuels en même temps. |
| **Connexions DB** | Jusqu’à 10 instances × ~10 connexions = **~100 connexions** | PostgreSQL par défaut souvent `max_connections = 100`. **Risque de saturation des connexions** si les 10 instances sont actives en parallèle. |

---

## Verdict

- **Oui pour le volume de données** : 100K produits + métadonnées, c’est largement supportable (CPU, RAM, disque) sur une instance 2 vCPU / 8 GB.
- **Point d’attention : connexions DB**  
  - Si le backend scale à 10 instances et que chaque instance utilise ~10 connexions, on peut frôler ou dépasser le `max_connections` par défaut de PostgreSQL.  
  - **Recommandations** :  
    - Limiter le pool Prisma par instance (ex. `connection_limit=5` dans l’URL ou dans le client Prisma) pour rester sous ~50–80 connexions au total.  
    - Ou augmenter `max_connections` sur Cloud SQL (en restant cohérent avec la RAM : ~2–3 MB par connexion idle).  
    - Ou activer **Cloud SQL Auth Proxy / Connection Pooling** pour réduire le nombre de connexions réelles.
- **Pic de charge** : si 100 clients déclenchent des exports ou des ingestions en même temps, les 10 instances Cloud Run peuvent monter en charge ; avec un pool de connexions maîtrisé, la DB devrait tenir. Au-delà (ex. 500 clients actifs en parallèle), il faudrait revoir **max-instances**, taille de l’instance Cloud SQL et éventuellement file d’attente (Pub/Sub) pour les jobs lourds.

**En résumé** : l’infra actuelle peut **supporter 100 clients à 1K produits sur 5 canaux**, à condition de **maîtriser le pool de connexions** (et éventuellement ajuster `max_connections` côté Cloud SQL). Pour une marge de confort et une entrée de gamme plus accessible, proposer une tranche en dessous de 1K produits (ex. 250 ou 500) reste pertinent commercialement et allège encore la charge.

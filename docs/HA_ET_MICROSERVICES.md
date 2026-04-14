# Haute disponibilité et passage aux microservices

Ce document précise **quand** une architecture microservices devient nécessaire pour atteindre une très haute disponibilité (HA) pour les clients FeedPlug.

---

## 1. Clarifier l’objectif de disponibilité

| Cible        | Disponibilité | Downtime max. par an | Usage typique                    |
|-------------|---------------|------------------------|----------------------------------|
| Deux 9      | 99%           | ~3,7 jours            | Non acceptable pour un SaaS B2B  |
| Trois 9     | 99,9%         | ~8,76 h               | Minimum raisonnable              |
| **Quatre 9**| **99,99%**    | **~52 min**           | **SLA courant pour SaaS critique** |
| Cinq 9      | 99,999%       | ~5,26 min             | Banque, télécoms                 |
| Neuf 9      | 99,9999999%   | ~31 ms                | Théorique ; infra cloud ne le garantit pas |

**En pratique :**
- GCP Cloud Run / Cloud SQL proposent des SLA de l’ordre de **99,95 % à 99,99 %** selon la config (multi‑zone, etc.).
- Viser **99,99 % (quatre 9)** ou **99,95 %** est réaliste et déjà très exigeant.
- Au-delà (cinq 9 et plus), il faut multi‑région, active‑active et une stack pensée pour ça — les microservices ne suffisent pas à eux seuls.

**Recommandation :** formaliser la cible (ex. **99,99 %** sur l’API et les flux critiques) et communiquer ce pourcentage dans les contrats / SLA clients.

---

## 2. Haute disponibilité ≠ obligatoirement microservices

La disponibilité se gagne surtout par :

1. **Infrastructure**
   - Multi‑zone / multi‑région, pas de single point of failure (SPOF).
   - Base de données : réplicas, failover auto (Cloud SQL HA), ou multi‑region.
   - Redis/Upstash : mode cluster / multi‑zone si critique.

2. **Résilience applicative**
   - Health checks (liveness/readiness), graceful shutdown, timeouts, retries, circuit breakers sur les appels externes (APIs, IA, stockage).
   - Jobs lourds (import/export) déjà découplés via Pub/Sub → un problème dans un worker ne doit pas faire tomber l’API.

3. **Opérations**
   - Déploiements sans coupure (rolling / blue‑green), rollback rapide, alerting et runbooks.

Un **monolithe bien conçu** (comme votre Nest/Express actuel) peut viser **99,9 % voire 99,99 %** si l’infra et le code sont alignés avec les points ci‑dessus. Les microservices ne deviennent **indispensables** que lorsque des contraintes métier ou techniques les imposent (voir section 3).

---

## 3. Quand les microservices deviennent essentiels pour la HA

Passer aux microservices pour la disponibilité se justifie quand au moins une des conditions suivantes est vraie :

| Déclencheur | Pourquoi c’est important pour la HA |
|-------------|-------------------------------------|
| **Blast radius inacceptable** | Un bug ou un déploiement dans un module (ex. Export) fait tomber toute l’API (Auth, Billing, Dashboard). Vous voulez qu’une panne ou un déploiement n’impacte qu’un sous‑ensemble de fonctionnalités. |
| **Scaling très différent par domaine** | Les workers d’export ou d’IA doivent scaler à 100 instances alors que l’API auth reste à 2–3. En monolithe, tout scale ensemble → coût et risque de surcharge inutile. |
| **Exigence de déploiements indépendants** | Vous devez déployer 10 fois par jour sur “Export” sans jamais redéployer “Billing” ou “Auth”. En monolithe, chaque déploiement = redémarrage de tout le service. |
| **Isolation contractuelle / réglementaire** | Un client ou un régulateur exige que la partie “paiement” ou “données sensibles” soit dans un périmètre technique isolé (autre service, autre zone, autre équipe). |
| **SLA différenciés par produit** | Vous vendez un SLA “quatre 9” sur les flux et “trois 9” sur le dashboard. Isoler “flux” dans un service dédié permet de garantir et mesurer le SLA par produit. |

En résumé : **vous passez aux microservices pour la HA quand le monolithe devient le goulot d’étranglement de la disponibilité** (blast radius, scaling, déploiements, ou isolation contractuelle), pas “par principe” pour atteindre 99,99 %.

---

## 4. Ordre de priorité recommandé

### Phase 1 — Sans microservices (priorité immédiate)

- Définir la cible (ex. **99,99 %** sur l’API et les jobs critiques).
- **Infra :** Cloud SQL en mode HA (multi‑zone), Redis/Upstash résilient, Cloud Run avec min instances > 0 si besoin (éviter cold start sur chemins critiques).
- **App :** health checks (liveness/readiness), graceful shutdown, timeouts/retries/circuit breakers sur appels externes, chaos testing (ex. Chaos Monkey existant) en staging.
- **Ops :** déploiements sans coupure, alerting, runbooks, mesure du downtime (SLO/SLA).

C’est là que se gagne l’essentiel de la HA pour un monolithe.

### Phase 2 — Découplage ciblé (si besoin)

- **Workers lourds déjà en Pub/Sub** : les traiter comme “services” (scaling indépendant, échec isolé). Possible de les déployer en services Cloud Run ou GKE séparés si nécessaire.
- **Un seul domaine très critique** (ex. “génération / diffusion de flux”) : l’extraire en premier en microservice avec sa propre DB ou schéma dédié, son propre SLA et son propre déploiement.

### Phase 3 — Microservices généralisés (si vraiment nécessaire)

- Quand plusieurs domaines ont des cycles de vie, des équipes ou des SLA très différents.
- Nécessite : API inter‑services, gestion de la cohérence (saga/events), observabilité distribuée, et équipe/processus pour gérer la complexité.

---

## 5. Synthèse

- **99,9999999 %** : objectif irréaliste au niveau infra cloud ; viser **99,99 % (quatre 9)** est déjà très ambitieux et suffisant pour la plupart des SLA B2B.
- La **haute disponibilité** se construit d’abord avec **infra + résilience + opérations** ; un **monolithe modulaire** peut atteindre quatre 9.
- Les **microservices** deviennent **essentiels** quand :
  - le **blast radius** du monolithe est inacceptable,
  - le **scaling** ou les **déploiements** doivent être **indépendants** par domaine,
  - ou qu’une **isolation contractuelle / réglementaire** l’exige.

Recommandation : **formaliser la cible à 99,99 %**, renforcer le monolithe et l’infra (Phase 1), puis n’envisager le passage aux microservices (Phases 2–3) que lorsque l’une des conditions de la section 3 est clairement atteinte.

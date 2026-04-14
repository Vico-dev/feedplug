# Ce qu’il reste à faire pour être opérationnel

**Contexte** : FeedPlug vise une **première vente** (early adopters) avec facturation manuelle. Ce doc résume ce qui est en place et ce qui reste à faire pour être **opérationnel** au sens « prêt à démo + vendre ».

---

## 1. Déjà en place (auth & technique)

| Domaine | État |
|--------|------|
| **Auth** | Login, register, forgot-password, reset-password (backend-marketing + Nest), rate limiting (Nest), refresh token + intercepteur 401 (frontend). Voir `docs/AUDIT_LOGIN_REGISTER.md`. |
| **Backend prod** | Express `backend-marketing/server-minimal.js` — auth, import, catalogue, enrichissement IA, score, export GMC, dashboard, emails, Sentry. |
| **Frontend** | Next.js, i18n FR/EN, dashboard, catalogue, flux, export, paramètres. |
| **Infra** | Cloud Run, PostgreSQL (Cloud SQL), Redis si utilisé, CI/CD (GitHub Actions). |

---

## 2. À faire pour être opérationnel (première vente)

### 2.1 Obligatoire / bloquant

| # | Tâche | Où c’est détaillé | Priorité |
|---|--------|-------------------|----------|
| 1 | **Export CSV GMC** | **Corrigé** : requêtes FeedItem en camelCase (migration 002) dans `server-minimal.js`. À valider en prod. Voir `AVIS_EXPERT_FLUX_ET_BLOQUANTS.md`. | ✅ Corrigé — à valider |
| 2 | **Multi-tenancy** | **Vérifié le 20/02/2026** : tous les endpoints sensibles filtrent par `accountId`. 4 endpoints (enrichment-analysis, enrich, enrichment/score/:itemId, enrichment-history) ont été corrigés. Voir `docs/VERIFICATION_MULTITENANCY_2026-02.md`. | ✅ Validé |
| 3 | **Variables d’environnement** | **Checklist** : `backend-marketing/DEPLOI_CHECKLIST.md` § Config prod. `NEXT_PUBLIC_API_URL` au build frontend ; SMTP sur le backend. | 🔴 À faire avant démo |

### 2.2 Recommandé (Sprint 1 – semaine 1)

| # | Tâche | Effort | Réf. |
|---|--------|--------|------|
| 4 | **Page tarifs publique** — `/tarifs` avec plans Starter €49, Pro €149, Enterprise €399, CTA inscription/contact. | 0,5 j | ✅ Fait |
| 5 | **Page Facturation** — Message T1 « Gestion manuelle », contact billing@feedplug.com, plan actuel depuis API `/accounts`. | 0,5 j | ✅ Fait |
| 6 | **Alertes Sentry** — Configurer Slack/email selon `SENTRY_ALERTES.md`. | 0,5 j | Roadmap §3 |
| 7 | **Tests manuels E2E** — Flow : inscription → import → enrichissement → export GMC. Documenter les cas. | 1 j | Roadmap §3 |
| 8 | **Documentation vendeur** — 1-pager produit, arguments de vente, limites (GMC uniquement), process facturation manuelle. | 0,5 j | Roadmap §3 |

### 2.3 Polish (Sprint 2 – semaine 2)

| # | Tâche | Effort |
|---|--------|--------|
| 9 | **Environnement de démo** — Données propres, compte démo pour commerciaux. | 0,5 j |
| 10 | **Onboarding** — Parcours clair après inscription (sources, premiers flux). | 1 j |
| 11 | **Corrections UX** — Parcours critiques, messages d’erreur, états de chargement. | 1 j |

---

## 3. Points de vigilance technique

- **« Erreur mise à jour item » (Enregistrer produit)** : corrigé avant déploiement. Le message venait de l’appel à `createRevision` (table `FeedItemRevision`) lorsque la migration n’était pas appliquée en prod. Le module `backend-marketing/lib/revisions.js` est maintenant **tolérant** : si la table `FeedItemRevision` n’existe pas (code 42P01 / P2010), les fonctions ne lèvent plus d’erreur — la sauvegarde du produit réussit, l’historisation des révisions est simplement ignorée. Une fois la migration 014 (Rule, FeedItemRevision, BulkEditOperation) appliquée en prod, l’historisation fonctionnera sans changement de code.
- **Backend utilisé en prod** : aujourd’hui c’est **backend-marketing** (Express). Le Nest (`src/main.ts`) utilise `AppMinimalModule` (health uniquement). Forgot-password / reset sont donc servis par Express ; si un jour vous basculez sur Nest (AppModule), les routes auth Nest (dont forgot/reset) et le rate limiting seront actifs.
- **Refresh token** : le backend-marketing ne renvoie pas de `refreshToken` dans login/register. Le front gère l’absence (pas de crash) ; en prod actuelle, pas de prolongation de session automatique après expiration du JWT.
- **Export Meta/Amazon** : annoncés dans l’UI mais non livrés côté flux réel (cf. roadmap). Pour la première vente, communiquer « GMC + Shopify/CSV » pour éviter les mauvaises surprises.
- **CORS et URL API** : si l’app est sur `app.feedplug.com` et que `NEXT_PUBLIC_API_URL` pointe vers un autre domaine (ex. `feedplug.com` ou `api.feedplug.com`), le navigateur peut bloquer les requêtes (CORS). **Important** : `NEXT_PUBLIC_API_URL` doit pointer vers l’URL réelle du backend (ex. Cloud Run `https://feedplug-backend-marketing-xxx.run.app/api/v1`), **pas** vers `https://feedplug.com`. Les pages qui utilisent `authFetch(API_BASE_URL + '/...')` (ex. Scoring par canal, lifestyle) doivent appeler ce backend avec CORS configuré pour `https://app.feedplug.com`. Les erreurs 500/403 viennent du backend (migration, droits, route) ; vérifier les logs et les migrations.
- **Middleware** : la route `/scoring-canaux` doit figurer dans `APP_ROUTES` (middleware) pour ne pas être redirigée vers feedplug.com. **Corrigé** : `/scoring-canaux` a été ajouté ; après déploiement, les erreurs CORS sur scoring-canaux dues à cette redirection disparaissent.
- **503 (Service indisponible)** : si le catalogue affiche « Aucun produit » et la console montre « Error fetching item(s) » avec 503, le backend ou la base (Prisma/PostgreSQL) est indisponible ou en surcharge. Vérifier les logs du backend (Cloud Run), la connexion à la base, et que le service est bien déployé et healthy.

---

## 4. Checklist « prêt à vendre »

- [x] Export CSV GMC : requêtes corrigées (casse FeedItem). À valider en prod.
- [x] Filtrage par `accountId` confirmé sur tous les endpoints sensibles.
- [ ] `NEXT_PUBLIC_API_URL` et SMTP configurés en prod (voir `backend-marketing/DEPLOI_CHECKLIST.md`).
- [x] Page tarifs publique (`/tarifs`, `/fr/tarifs`, `/en/tarifs`).
- [x] Page Facturation : message « gestion manuelle » + plan depuis API.
- [ ] Au moins un flow E2E testé manuellement (inscription → import → enrichissement → export GMC).
- [ ] Documentation vendeur à jour.
- [ ] (Recommandé) Compte démo opérationnel.

---

## 5. Références

- **Audit login/register** : `docs/AUDIT_LOGIN_REGISTER.md`
- **Roadmap commercialisation** : `AUDIT_ET_ROADMAP_COMMERCIALISATION.md`
- **Bloquants flux / export** : `AVIS_EXPERT_FLUX_ET_BLOQUANTS.md`
- **Checklist déploiement** : `backend-marketing/DEPLOI_CHECKLIST.md`

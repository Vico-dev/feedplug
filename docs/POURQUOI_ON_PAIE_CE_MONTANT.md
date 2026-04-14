# Pourquoi on paie beaucoup plus que le prévisionnel (36 €) ?

Tu vois **~300 €/mois** en prévisionnel GCP alors que le script de coût prévisionnel affichait **~36 €** pour un scénario “20 clients”. Voici les raisons réelles.

---

## 1. Le 36 € était un scénario théorique avec des hypothèses basses

Le script utilisait :

- **Cloud SQL** : type `db-g1-small` → **~35 €/mois** (1 vCPU, 1,7 Go RAM).
- **Cloud Run** : très peu de requêtes (estimation basse).
- **Un seul projet** FeedPlug.

En **production**, ton setup est très probablement au-dessus de ça sur plusieurs postes.

---

## 2. Pourquoi tu paies beaucoup plus en réalité

### 2.1 Cloud SQL (souvent le plus gros poste)

- En prod, l’instance est en général **plus grosse** que `db-g1-small` (ex. 2 vCPU, 4–8 Go RAM pour tenir la charge et les pics).
- Exemples **ordre de grandeur** (europe-west1) :
  - `db-g1-small` (1 vCPU, 1,7 Go) : **~35–40 €/mois**
  - `db-custom-2-7680` (2 vCPU, 8 Go) : **~100–130 €/mois**
  - Au-delà (4 vCPU, 16 Go…) : **200 €/mois et plus**
- + **stockage** (disque) : au-delà de l’inclus, quelques dizaines d’euros possibles si beaucoup de données.

**À vérifier dans GCP :**  
Cloud SQL → ton instance → type (machine) + taille du disque. C’est très probablement la **première** raison d’un coût bien au-dessus de 36 €.

### 2.2 Plusieurs projets sur le même compte de facturation

- Tu as au moins **FeedPlug Production** (feedplug-prod) et un **autre projet** (numéro 38562478122, ~103 € dans un rapport vu plus tôt).
- La facture **“Mois en cours”** / **“Coût total prévisionnel”** = **tous les projets** du compte de facturation, pas seulement FeedPlug.
- Donc une partie des **~300 €** vient sans doute d’**autres projets** (autre produit, test, outil interne, etc.).

**À vérifier dans GCP :**  
Facturation → Rapports → grouper par **Projet** et regarder le détail par projet (feedplug-prod vs 38562478122 vs autres).

### 2.3 Cloud Run (avant et après min-instances = 0)

- Tant que tu avais **min-instances = 1** (une instance toujours allumée), Cloud Run facturait **24/7** → ordre de grandeur **50–80 €/mois** pour le backend.
- Depuis le passage à **min-instances = 0**, cette part baisse fortement quand il n’y a pas de trafic.
- Les **premiers jours de mars** peuvent encore inclure l’ancienne config ou des tests → la prévision “300 €” pour mars peut encore refléter une transition.

### 2.4 Vertex AI / Gemini (si activé)

- Enrichissement IA (titres, descriptions, etc.) = appels à l’API.
- Même avec peu de “vrais” clients, des **tests ou des faux comptes** qui déclenchent des enrichissements font monter la facture (quelques euros à dizaines d’euros selon le volume).

### 2.5 Autres postes (plus petits mais réels)

- **Artifact Registry** (images Docker) : quelques euros/mois.
- **Cloud Storage** (GCS) : flux, exports, logs → peut monter un peu si beaucoup de données.
- **Requêtes SQL** : avant les optimisations (batch), un catalogue avec des milliers de produits + règles + enrichissement pouvait générer des centaines de milliers de requêtes → Cloud SQL facture au moins l’instance, et des pics peuvent influencer le dimensionnement (donc le coût d’instance).

---

## 3. Synthèse : d’où viennent les ~300 €

| Poste probable              | Ordre de grandeur (sans optimisation) |
|----------------------------|----------------------------------------|
| Cloud SQL (instance réelle)| **80–150 €/mois** (si 2 vCPU + 8 Go)    |
| Autre(s) projet(s) GCP     | **50–100 €/mois** (ex. projet 38562478122) |
| Cloud Run (avant min=0)    | **50–80 €/mois** (1 instance 24/7)     |
| Vertex AI / Gemini         | **0–50 €/mois** selon usage             |
| Stockage, Artifact Registry| **5–20 €/mois**                         |
| **Total possible**         | **~200–400 €/mois**                    |

Donc **“on paie beaucoup plus”** parce que :

1. **Cloud SQL** est sans doute une instance plus grosse que le petit modèle du script (35 €).
2. La facture **inclut plusieurs projets**, pas seulement FeedPlug.
3. **Cloud Run** a pu encore coûter cher tant que min-instances = 1.
4. **IA + stockage** ajoutent un peu.

Le **36 €** du script, lui, supposait un tout petit SQL, un seul projet et un usage minimal → c’est un **scénario bas**, pas ton coût réel actuel.

---

## 4. Que faire pour aligner “prévisionnel” et réalité

1. **Facturation → Rapports** : grouper par **Projet** et par **Service** pour voir exactement FeedPlug (feedplug-prod) vs le reste.
2. **Cloud SQL** : noter le **type d’instance** (ex. db-custom-2-7680) et la **taille du disque** ; les comparer aux grilles tarifaires GCP pour avoir le coût réel.
3. **Identifier le projet 38562478122** (et les autres) pour savoir ce qui pèse dans les 300 €.
4. Une fois que tu as le **coût réel FeedPlug seul** (ex. X €/mois) et le **type d’instance SQL**, on peut adapter le script de prévisionnel pour utiliser ces vrais chiffres (et éventuellement un scénario “plateforme à vide” = coût fixe actuel, sans clients).
5. **Réduire le coût** : instance SQL plus petite si la charge le permet, garder min-instances = 0, limiter les tests/IA sur les faux comptes.

En résumé : **tu paies plus parce que l’infra réelle (SQL + plusieurs projets + ancien Cloud Run) coûte bien plus que le scénario “petit SQL + un seul projet” du script.** La suite, c’est regarder la facture par projet et par service pour chiffrer chaque poste et revoir la copie du prévisionnel avec ces vrais montants.

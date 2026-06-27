# Feedplug — Machine outbound vers le 1er pilote payant

> Canal n°1 vers le 1er client (consensus des consultants). À exécuter cette semaine.
> North Star : nombre de pilotes payants. Objectif 90j : 1 → 3 clients.

---

## LIVRABLE 1 — Machine de prospection (30 prospects ultra-qualifiés)

### A. Grille de scoring ICP — « signal de douleur GMC »
Note chaque prospect sur 4 critères. **Score ≥ 6/8 = tu le contactes. < 6 = poubelle.**

| Critère | 0 pt | 1 pt | 2 pts |
|---|---|---|---|
| **1. Douleur GMC visible/exprimée** | Aucun signe | Annonce en Shopping (a un flux) | A explicitement parlé d'un problème (refus, suspension, attributs) |
| **2. Taille / fit** | Grand groupe / micro sans CA | Boutique mono-produit | PME e-commerce 1-50 pers OU petite agence SEA gérant des flux |
| **3. Pile compatible** | Plateforme exotique | E-commerce custom (CSV possible) | Shopify ou export CSV propre |
| **4. Accessibilité du décideur** | Pas de contact | Email générique | Fondateur / resp. e-com / trafic manager joignable en direct |

**Bonus immédiat (court-circuite le score) :** un prospect qui poste publiquement « mon compte GMC est suspendu / mes produits sont refusés » = **contact dans l'heure**, score max.

**Drapeau rouge (skip) :** gros catalogue (>50k SKU), déjà client Channable/DataFeedWatch satisfait, pas de présence Shopping (pas de douleur = pas de vente).

### B. Sources + requêtes exactes (copiables)

**1. Forum d'aide Google Merchant Center (FR)** — `https://support.google.com/merchants/community?hl=fr`
```
site:support.google.com/merchants "produits refusés"
site:support.google.com/merchants "compte suspendu"
site:support.google.com/merchants "non approuvé" attribut
site:support.google.com/merchants/community "flux" erreur
```
→ repère l'auteur → identifie sa boutique → retrouve le décideur sur LinkedIn. **Tes meilleurs leads.**

**2. Groupes Facebook** (rejoindre + recherche interne) :
« Google Ads France » · « Google Shopping France » · « Shopify France » / « Shopify Francophone » · « E-commerçants Francophones » · « Vendre sur Internet - E-commerce France » · « Dropshipping France »
Recherche dans le groupe : `merchant center refusé` · `compte suspendu shopping` · `produits désapprouvés` · `flux google shopping problème` · `gtin attribut manquant`

**3. LinkedIn — chaînes booléennes (filtre : France)**
Marchands / resp. e-commerce :
```
("Responsable e-commerce" OR "Traffic Manager" OR "Responsable acquisition" OR "E-commerce Manager") AND ("Google Shopping" OR "Merchant Center" OR "flux produit")
```
Fondateurs de boutiques :
```
("fondateur" OR "founder" OR "gérant" OR "CEO") AND ("Shopify" OR "boutique en ligne" OR "e-commerce") AND ("Google Shopping" OR "Google Ads")
```
Agences SEA / freelances Google Ads :
```
("consultant Google Ads" OR "expert SEA" OR "freelance Google Ads" OR "agence SEA" OR "traffic manager") AND ("Google Shopping" OR "feed" OR "flux produit" OR "Merchant Center")
```
→ trie par « Publications » pour voir qui a récemment parlé de flux/Shopping = douleur fraîche.

**4. Boutiques Shopify FR qui annoncent en Shopping**
- Par les annonces : `acheter [produit niche] en ligne`, `[catégorie] pas cher livraison France` → onglet Shopping → repère les annonceurs → vérifie Shopify (footer « Powered by Shopify », `cdn.shopify.com` dans le code source).
- Par la pile : Wappalyzer / BuiltWith / store-leads.com, filtre Shopify + France.
- Signal douleur : pas de GTIN visible, titres pauvres, catégories floues.

**5. Agences SEA FR** (levier de répétition — 1 deal = plusieurs comptes)
```
"agence Google Ads" Shopping France
"agence SEA" e-commerce flux produit
freelance "Google Shopping" France
agence "gestion de flux" Merchant Center
```
→ cible les petites agences / freelances (gèrent les flux clients à la main et détestent ça).

### C. Template de fichier de suivi (Sheet / Notion)
| Col | Champ | Notes |
|---|---|---|
| A | Nom | Prénom Nom du décideur |
| B | Boutique / Agence | Nom + URL |
| C | Type | Marchand / Agence |
| D | Signal de douleur repéré | « post forum 12/06 produits refusés » / « annonce Shopping titres pauvres » |
| E | Score ICP | /8 (≥6 = go) |
| F | Canal | LinkedIn DM / Email / FB DM |
| G | Source | Forum GMC / FB groupe X / LinkedIn / Shopping |
| H | Contact | URL LinkedIn + email |
| I | Statut | À contacter → J0 → Relance J3/J7/J14 → Audit booké → Design partner → Payant → Perdu |
| J | Date dernier contact | |
| K | Date prochaine relance | **← ta colonne de travail quotidienne** |
| L | Notes / verbatim | Réponses, objections, chiffres |

---

## LIVRABLE 2 — Séquence outbound (4 touches)

**Règle de perso (1re ligne anti-copier-coller) :** la première phrase doit prouver que tu as regardé SON cas. Modèles :
- « Je suis tombé sur ton post du [date] dans [groupe] où tu parlais de [produits refusés]… »
- « J'ai vu que [boutique] annonçait sur [produit] en Shopping — j'ai regardé ton flux et… »
- « Vu sur LinkedIn que tu gères les flux Shopping de tes clients chez [agence]… »

Si tu ne peux pas écrire une 1re ligne spécifique → ne l'envoie pas.
Ton : **tu aides, tu ne vends pas.** Tu offres un audit, pas une démo. Court. Une seule question à la fin.

| Touche | Timing | Canal | But |
|---|---|---|---|
| 1 | J0 | LinkedIn DM (ou email) | Hook audit gratuit |
| 2 | J3 | Email | Valeur ajoutée + relance douce |
| 3 | J7 | LinkedIn DM | Mini-insight concret |
| 4 | J14 | Email | Break-up |

### VARIANTE MARCHAND
**T1 — J0** — *Objet : `ton flux Shopping`*
> Salut [Prénom], je suis tombé sur [ton post du 12/06 dans le groupe X / ta boutique qui annonce sur (produit)] — tu galérais avec [produits refusés GMC / suspension / attributs].
> Je construis Feedplug, un outil qui nettoie les flux Google Shopping et explique **en clair, en français**, pourquoi GMC refuse des produits.
> Je cherche 2-3 marchands pour le tester. En échange je t'**audite ton flux moi-même cette semaine** et je te dis quoi corriger — que tu utilises l'outil ou non.
> Ça t'intéresse, un audit gratuit ? 15 min en visio cette semaine ?

**T2 — J3** — *Objet : `Re: ton flux Shopping`*
> Salut [Prénom], je relance vite fait. Un truc qui revient tout le temps et fait sauter des produits sur GMC : un **GTIN manquant ou un `google_product_category` mal mappé**. Invisible dans Shopify mais ça bloque le flux.
> Si tu me donnes 15 min, je regarde le tien et je te liste les corrections. Gratuit, sans engagement, avant/après. Tu préfères jeudi ou vendredi ?

**T3 — J7** — LinkedIn DM
> [Prénom], dernier truc concret : le problème n°1 que je vois ce sont les **titres produits** (GMC matche dessus, 80% sont mal structurés → moins d'impressions ou refus).
> Je peux te faire un audit rapide et te pointer les 5 corrections qui comptent. 15 min, tu repars avec une to-do claire même si on ne bosse pas ensemble. On cale ça ?

**T4 — J14** — *Objet : `je te laisse tranquille`*
> Salut [Prénom], je ne veux pas insister. Je referme le sujet — mais l'offre d'audit gratuit de ton flux Shopping reste valable quand tu veux. Un mot et je m'en occupe. Bonne continuation sur [boutique].

### VARIANTE AGENCE SEA
**T1 — J0** — *Objet : `les flux Shopping de tes clients`*
> Salut [Prénom], vu que tu gères des campagnes Shopping pour tes clients chez [agence] — je me doute que la **gestion des flux** (CSV bricolés, refus GMC, attributs) te bouffe du temps que tu préférerais passer sur les campagnes.
> Je construis Feedplug : on nettoie les flux et on explique en clair les refus GMC. Pensé pour que **toi tu gardes la main sur tes clients**, sans y passer des heures.
> Je cherche 1-2 agences pour le tester. Je t'**audite gratuitement le flux d'un de tes clients** cette semaine. 20 min ?

**T2 — J3** — *Objet : `Re: les flux Shopping de tes clients`*
> Salut [Prénom], je relance. Le calcul agence : chaque flux client mal foutu = des heures de debug GMC non facturables + un client qui râle sur ses perfs.
> Donne-moi le flux d'**un seul** client, je fais l'audit et te montre ce qu'on détecte automatiquement. Tu juges sur pièce. Jeudi ou vendredi ?

**T3 — J7** — LinkedIn DM
> [Prénom], côté agence l'intérêt c'est le **scaling** : un seul endroit pour voir/corriger les flux de tous tes clients + un diagnostic GMC en clair pour tes reportings.
> Audit gratuit sur le client de ton choix — tu vois concrètement le gain de temps. 20 min cette semaine ?

**T4 — J14** — *Objet : `je te laisse tranquille`*
> Salut [Prénom], je ne relance pas davantage. Si un jour la gestion des flux Shopping de tes clients te pèse, l'audit gratuit reste dispo — sur le client que tu veux. Bonne continuation chez [agence].

---

## LIVRABLE 3 — L'audit de flux gratuit (cheval de Troie)

Mini-rapport répétable, produit en 15-30 min (visio écran partagé idéale). Crée le moment « aha » et débouche sur l'offre design partner.

### A. Les 7 points contrôlés (toujours les mêmes)
| # | Point | Ce que tu cherches | Pourquoi ça vend |
|---|---|---|---|
| 1 | Taux approuvés vs refusés | Le chiffre brut GMC | C'est LE chiffre du case study (« 312 refusés ») |
| 2 | GTIN / identifiants | Manquants, invalides | Cause n°1 de refus, invisible côté marchand |
| 3 | `google_product_category` + product_type | Absent / mal mappé | Bloque la diffusion |
| 4 | Titres produits | Structure, longueur, bourrage | Impact impressions + refus |
| 5 | Images | Placeholder, watermark, fond non conforme | Motif fréquent de désapprobation |
| 6 | Prix / dispo / cohérence flux↔site | Écart prix flux vs page | Cause de suspension de compte |
| 7 | Attributs manquants | `brand`, `condition`, `mpn`, `shipping` | Désapprobations silencieuses |

### B. Mini-rapport (structure 1 page, toujours identique)
```
AUDIT FLUX GOOGLE SHOPPING — [Boutique] — par [Toi], le [date]

1. ÉTAT DES LIEUX (le chiffre)
   Produits : X  |  Approuvés : X  |  Refusés/à risque : X  (→ ton chiffre AVANT)
2. CE QUI BLOQUE (3-5 problèmes prioritaires)
   🔴 Critique : ex. 187 produits sans GTIN → refus garanti
   🟠 Important : ex. titres non structurés → -30% impressions estimées
   🟡 À surveiller : ex. catégories Google mal mappées
3. CE QUE ÇA TE COÛTE : estimation des produits invisibles aujourd'hui.
4. LA TO-DO (corrections priorisées) : 1… 2… 3… (utilisable même sans toi)
```
Règles : mène avec le chiffre douloureux · code couleur lisible en 10s · donne la to-do pour de vrai · en visio, montre les erreurs détectées **automatiquement** par Feedplug.

### C. Closing audit → design partner
> « Voilà ce qui bloque. Deux options : soit tu reprends cette to-do à la main — [X heures], à refaire à chaque mise à jour de catalogue. Soit Feedplug le fait et le maintient automatiquement, et tu vois ton taux d'approbation remonter cette semaine.
> Je lance un **programme Design Partner — 3 places.** Onboarding par moi, accès direct, tarif early-bird gelé à vie (–50%, [19/29]€/mois au lieu de 49€). 1er mois à **1€ symbolique**, pour qu'on soit engagés tous les deux.
> En échange : retour honnête chaque semaine + droit d'utiliser ton logo / un témoignage si ça te débloque. Il reste [2] places. Je te réserve la tienne ? »

**Pourquoi ça marche :** alternative explicite · 1€ payé = engagement + signal de willingness to pay · rareté réelle · tarif gelé · logo/témoignage récupéré par contrat.
**Signal à écouter :** s'il a vu ses produits débloqués et refuse de payer 19-29€ → problème pas assez douloureux ou solution pas assez bonne. L'info la plus précieuse de l'opération.

---

### Ordre d'exécution cette semaine
1. Remplir le Sheet avec 30 lignes scorées ≥6.
2. Lancer 30 × Touche 1 personnalisées.
3. Tenir le template d'audit prêt pour les premiers « oui ».

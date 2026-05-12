# Plan d'exécution Markets market-first

Document compagnon de [MODELE_CIBLE_DESTINATIONS_MULTI_PLATEFORME.md](</Users/victorsoldet/Desktop/Feedplug/docs/MODELE_CIBLE_DESTINATIONS_MULTI_PLATEFORME.md>).

Ici, l'objectif n'est pas de redécrire la cible théorique. L'objectif est de définir :

- le **delta Prisma concret** depuis le schéma actuel
- le **backlog backend / frontend**
- la **V1 simple pour des marketeux**
- l'ordre de livraison qui maximise la valeur sans lancer un big bang

---

## Décision produit

Le produit doit être pensé comme suit :

- le marketeur configure un **marché**
- le marché contient des **langues**
- le marché active des **canaux**
- le système génère les **destinations techniques** en arrière-plan

En clair :

- **UI principale** : `Market`, `MarketLocale`, `MarketChannel`
- **moteur interne** : `Destination`

Le marketeur ne doit pas voir :

- `amazon_it`
- `google_be_fr`
- `destinationId`
- des paramètres techniques de publication qui ne servent qu'au runtime

---

## Point de départ code

Aujourd'hui, le produit est encore structuré autour des flux et des canaux techniques :

- `PlatformConnection` impose une unicité `(accountId, platform)` dans [schema.prisma](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/prisma/schema.prisma)
- `ExportChannel` est une clé texte par plateforme, pas un vrai marché métier dans [schema.prisma](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/prisma/schema.prisma)
- le mapping marché est statique et limité au pays dans [channels-by-market.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/config/channels-by-market.js)
- le modal "Créer un flux de sortie" renvoie simplement vers la page Flux dans [create-export-modal.tsx](/Users/victorsoldet/Desktop/Feedplug/frontend/src/components/forms/create-export-modal.tsx)
- la page catalogue active encore `google`, `amazon`, `meta` en global via `_channelOverrides` dans [catalogue/[id]/page.tsx](</Users/victorsoldet/Desktop/Feedplug/frontend/src/app/[locale]/(dashboard)/catalogue/[id]/page.tsx>)
- Google push est encore codé en dur sur `FR / fr` dans [server-minimal.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/server-minimal.js)
- Amazon push dépend encore de `channel=amazon_fr|amazon_it|...` dans [server-minimal.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/server-minimal.js)
- les règles ciblent encore `channelIds` et non des marchés ou sélecteurs métier dans [schema.prisma](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/prisma/schema.prisma), [rules/engine.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/rules/engine.js) et [rules/routes.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/rules/routes.js)

Conclusion : la bonne stratégie n'est pas de renommer quelques libellés. Il faut ajouter une couche métier "Market" sans casser le runtime existant.

---

## V1 cible

La V1 n'a pas besoin d'implémenter toute la cible finale. Elle doit surtout rendre possible un parcours simple :

1. le client clique sur "Nouveau marché"
2. il choisit un marché source, par exemple France
3. il choisit un marché cible, par exemple Italie
4. il choisit les langues
5. il active Google, Amazon, Meta
6. il définit devise et stratégie de contenu
7. FeedPlug crée tout ce qu'il faut derrière

### Ce que la V1 doit absolument faire

- créer un objet `Market`
- permettre plusieurs `MarketLocale`
- permettre plusieurs `MarketChannel`
- générer des `Destination`
- rattacher les pushes Google / Amazon à une destination
- afficher un état de readiness par marché et par canal

### Ce que la V1 peut garder simple

- on peut garder les contenus optimisés actuels dans `customfields.optimized`
- on peut garder `FeedItem` comme pseudo-produit canonique
- on peut garder `ExportLog` tant que `PublicationRun` n'est pas encore en place
- on peut garder la page Flux comme surface de publication, à condition qu'elle devienne market-first
- on peut garder le registre des plateformes dans le code au début, via une évolution de `SUPPORTED_CHANNELS`, sans introduire immédiatement `PlatformDefinition` en base

### Ce que la V1 ne doit pas faire

- exposer les destinations en UI standard
- exiger une refonte complète du catalogue
- réécrire tout le moteur de règles dès le premier lot
- introduire tout de suite la granularité complète `ContentVariant + OfferVariant + ListingProjection` si cela retarde la valeur

---

## Stratégie de migration

### Règle d'or

Le schéma doit évoluer de façon **additive**, pas destructive.

On ne renomme pas immédiatement :

- `PlatformConnection`
- `ExportChannel`
- `Rule.channelIds`

On ajoute la nouvelle couche, puis on migre le runtime, puis on retire l'ancien modèle plus tard.

### Pourquoi

Le backend actuel est encore très couplé à :

- du SQL brut dans `server-minimal.js`
- des requêtes directes sur `PlatformConnection`
- des appels front qui poussent par `channel`
- des règles qui dépendent de `channelIds`

Un remplacement in-place ferait exploser le risque de régression.

---

## Delta Prisma concret

## Lot A - Tables minimales pour la V1

Ce lot suffit à lancer une expérience market-first sans attendre la cible complète.

### 1. Ajouter `Market`

But :

- devenir l'objet principal visible dans l'UX
- stocker le paramétrage unique d'un marché

Champs recommandés :

```prisma
model Market {
  id                      String   @id @default(cuid())
  accountId               String   @map("accountid")
  sourceMarketId          String?  @map("sourcemarketid")
  code                    String
  name                    String
  countryCodesJson        Json     @default("[]") @map("countrycodesjson")
  defaultCurrencyCode     String   @map("defaultcurrencycode")
  status                  String   @default("draft")
  pricingPolicyJson       Json     @default("{}") @map("pricingpolicyjson")
  shippingPolicyJson      Json     @default("{}") @map("shippingpolicyjson")
  taxPolicyJson           Json     @default("{}") @map("taxpolicyjson")
  contentStrategyJson     Json     @default("{}") @map("contentstrategyjson")
  publicationDefaultsJson Json     @default("{}") @map("publicationdefaultsjson")
  createdAt               DateTime @default(now()) @map("createdat")
  updatedAt               DateTime @updatedAt @map("updatedat")

  account                 Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  sourceMarket            Market?  @relation("MarketCloneSource", fields: [sourceMarketId], references: [id])
  clonedMarkets           Market[] @relation("MarketCloneSource")
  locales                 MarketLocale[]
  channels                MarketChannel[]
  destinations            Destination[]

  @@unique([accountId, code])
  @@index([accountId])
}
```

### 2. Ajouter `MarketLocale`

But :

- gérer proprement les marchés multi-langues
- porter la stratégie par langue

Champs recommandés :

```prisma
model MarketLocale {
  id               String   @id @default(cuid())
  marketId         String   @map("marketid")
  localeCode       String   @map("localecode")
  languageCode     String   @map("languagecode")
  countryCode      String   @map("countrycode")
  isDefault        Boolean  @default(false) @map("isdefault")
  isRequiredLaunch Boolean  @default(false) @map("isrequiredlaunch")
  translationMode  String   @default("translate") @map("translationmode")
  createdAt        DateTime @default(now()) @map("createdat")
  updatedAt        DateTime @updatedAt @map("updatedat")

  market           Market   @relation(fields: [marketId], references: [id], onDelete: Cascade)
  destinations     Destination[]

  @@unique([marketId, localeCode])
  @@index([marketId])
}
```

### 3. Ajouter `PlatformAccount`

But :

- sortir de la contrainte actuelle "un seul compte par plateforme"
- préparer les futurs cas multi-compte

Champs recommandés :

```prisma
model PlatformAccount {
  id                    String   @id @default(cuid())
  accountId             String   @map("accountid")
  platformKey           String   @map("platformkey")
  externalAccountId     String?  @map("externalaccountid")
  externalAccountName   String?  @map("externalaccountname")
  credentialsCiphertext String?  @map("credentialsciphertext")
  credentialsVersion    Int      @default(1) @map("credentialsversion")
  status                String   @default("active")
  metadataJson          Json     @default("{}") @map("metadatajson")
  createdAt             DateTime @default(now()) @map("createdat")
  updatedAt             DateTime @updatedAt @map("updatedat")

  account               Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  channels              MarketChannel[]
  destinations          Destination[]

  @@index([accountId])
  @@index([platformKey])
}
```

### 4. Ajouter `MarketChannel`

But :

- devenir l'objet visible "Google Italy", "Amazon Italy", "Meta Belgium"
- découpler l'UX du runtime interne

Champs recommandés :

```prisma
model MarketChannel {
  id                String   @id @default(cuid())
  marketId          String   @map("marketid")
  platformKey       String   @map("platformkey")
  platformAccountId String?  @map("platformaccountid")
  status            String   @default("draft")
  isEnabled         Boolean  @default(true) @map("isenabled")
  settingsJson      Json     @default("{}") @map("settingsjson")
  createdAt         DateTime @default(now()) @map("createdat")
  updatedAt         DateTime @updatedAt @map("updatedat")

  market            Market           @relation(fields: [marketId], references: [id], onDelete: Cascade)
  platformAccount   PlatformAccount? @relation(fields: [platformAccountId], references: [id], onDelete: SetNull)
  destinations      Destination[]

  @@unique([marketId, platformKey])
  @@index([marketId])
}
```

### 5. Ajouter `Destination`

But :

- porter le runtime réel de publication
- encapsuler pays, langue, devise et scope externe

Champs recommandés :

```prisma
model Destination {
  id                 String   @id @default(cuid())
  accountId          String   @map("accountid")
  marketId           String   @map("marketid")
  marketChannelId    String   @map("marketchannelid")
  marketLocaleId     String?  @map("marketlocaleid")
  platformKey        String   @map("platformkey")
  platformAccountId  String?  @map("platformaccountid")
  currencyCode       String   @map("currencycode")
  externalScopeType  String   @map("externalscopetype")
  externalScopeId    String?  @map("externalscopeid")
  externalScopeLabel String?  @map("externalscopelabel")
  slug               String
  status             String   @default("draft")
  isPrimary          Boolean  @default(false) @map("isprimary")
  configJson         Json     @default("{}") @map("configjson")
  createdAt          DateTime @default(now()) @map("createdat")
  updatedAt          DateTime @updatedAt @map("updatedat")

  account            Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  market             Market           @relation(fields: [marketId], references: [id], onDelete: Cascade)
  marketChannel      MarketChannel    @relation(fields: [marketChannelId], references: [id], onDelete: Cascade)
  marketLocale       MarketLocale?    @relation(fields: [marketLocaleId], references: [id], onDelete: SetNull)
  platformAccount    PlatformAccount? @relation(fields: [platformAccountId], references: [id], onDelete: SetNull)
  activations        ProductActivation[]

  @@unique([accountId, slug])
  @@index([marketId])
  @@index([marketChannelId])
}
```

### 6. Ajouter `ProductActivation`

But :

- remplacer progressivement `_channelOverrides`
- pouvoir activer un produit par marché / canal réel

Champs recommandés :

```prisma
model ProductActivation {
  id               String   @id @default(cuid())
  productId        String   @map("productid")
  destinationId    String   @map("destinationid")
  isEnabled        Boolean  @default(true) @map("isenabled")
  activationStatus String   @default("active") @map("activationstatus")
  excludedReason   String?  @map("excludedreason")
  manualOverride   Boolean  @default(false) @map("manualoverride")
  createdAt        DateTime @default(now()) @map("createdat")
  updatedAt        DateTime @updatedAt @map("updatedat")

  destination      Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)

  @@unique([productId, destinationId])
  @@index([destinationId])
}
```

## Lot B - Tables utiles mais non bloquantes pour la V1

À introduire après la première bascule market-first :

- `ContentVariant`
- `OfferVariant`
- `ListingProjection`
- `PublicationRun`
- `PublicationItemResult`
- `LaunchPlan`

Autrement dit : le socle marché doit arriver **avant** le moteur complet de variantes.

---

## Delta sur les relations existantes

Dans `Account`, ajouter à terme :

```prisma
  markets          Market[]
  platformAccounts PlatformAccount[]
```

Ne pas supprimer pour l'instant :

```prisma
  platformConnections PlatformConnection[]
  exportChannels      ExportChannel[]
```

On garde ces deux relations pendant toute la phase de compatibilité.

---

## Compatibilité des données existantes

### `PlatformConnection` -> `PlatformAccount`

Au début :

- on garde `PlatformConnection` comme source legacy
- on backfill `PlatformAccount`
- on dual-write les nouvelles connexions

### `ExportChannel` -> `MarketChannel` + `Destination`

Au début :

- `ExportChannel` continue d'exister
- on le transforme en `MarketChannel` de compatibilité
- on génère une ou plusieurs `Destination`

Exemples :

- `gmc` -> un `MarketChannel Google` + une `Destination` par langue requise
- `amazon_it` -> un `MarketChannel Amazon` + une `Destination Amazon IT`

### `_channelOverrides` -> `ProductActivation`

Au début :

- continuer à lire `_channelOverrides`
- backfiller `ProductActivation`
- puis faire passer l'UI et les exports sur `ProductActivation`

---

## Backlog backend

## Lot 1 - Fondations schéma + services

### Fichiers à toucher

- [schema.prisma](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/prisma/schema.prisma)
- `backend-marketing/prisma/migrations/032_markets_core.sql`
- `backend-marketing/prisma/migrations/033_market_channels_destinations.sql`
- `backend-marketing/lib/markets/`
- [server-minimal.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/server-minimal.js)

### À livrer

- nouvelles tables Prisma
- service `MarketService`
- service `DestinationResolver`
- backfill initial depuis `ExportChannel` et `PlatformConnection`

### Critère de sortie

- un compte peut avoir au moins un `Market`
- un `Market` peut avoir ses langues et ses canaux
- les destinations sont générées automatiquement

## Lot 2 - API Markets

### Endpoints à créer

- `GET /api/v1/markets`
- `POST /api/v1/markets`
- `GET /api/v1/markets/:marketId`
- `PATCH /api/v1/markets/:marketId`
- `POST /api/v1/markets/:marketId/locales`
- `PATCH /api/v1/markets/:marketId/locales/:localeId`
- `POST /api/v1/markets/:marketId/channels`
- `PATCH /api/v1/markets/:marketId/channels/:channelId`
- `GET /api/v1/markets/:marketId/readiness`

### Endpoints de compatibilité à conserver

- `GET /api/v1/platforms/amazon/channels`
- `POST /api/v1/platforms/amazon/channels`
- `POST /api/v1/platforms/amazon/push/:feedId`
- `POST /api/v1/platforms/gmc/push/:feedId`

Mais ces routes doivent progressivement devenir des wrappers sur le nouveau modèle.

## Lot 3 - Push destination-aware

### À changer

Les pushes ne doivent plus dépendre de :

- `channel=amazon_it`
- `contentLanguage = 'fr'`
- `targetCountry = 'FR'`

Ils doivent résoudre ces valeurs depuis `Destination`.

### Cible d'API

- `POST /api/v1/destinations/:destinationId/push/:feedId`
- ou `POST /api/v1/markets/:marketId/channels/:channelId/push/:feedId`

Recommandation :

- garder l'appel UI au niveau `MarketChannel`
- faire résoudre le `destinationId` côté serveur

### Backend à refactorer en premier

- logique GMC dans [server-minimal.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/server-minimal.js)
- logique Amazon dans [server-minimal.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/server-minimal.js)
- mapping pays/canal dans [channels-by-market.js](/Users/victorsoldet/Desktop/Feedplug/backend-marketing/config/channels-by-market.js)

## Lot 4 - Activations produit

### À créer

- endpoints de lecture/écriture `ProductActivation`

Exemples :

- `GET /api/v1/catalogue/items/:itemId/activations`
- `PATCH /api/v1/catalogue/items/:itemId/activations`

### Compatibilité

Pendant la transition :

- lecture legacy `_channelOverrides`
- écriture duale `_channelOverrides` + `ProductActivation`

### Sortie du lot

- plus aucun export/push ne dépend directement de `_channelOverrides`

## Lot 5 - Règles et sélecteurs

### Problème actuel

`Rule.channelIds` encode un scope trop technique.

### Cible

Ajouter un nouveau champ :

```prisma
targetSelectorJson Json @default("{}") @map("targetselectorjson")
```

Exemples de sélecteurs :

- tous les marchés
- marché Italie
- marché Belgique langue FR
- canaux Google de tous les marchés
- destination précise si nécessaire

### Stratégie

- conserver `channelIds` pour compatibilité
- faire évoluer le moteur de règles pour comprendre les deux

---

## Backlog frontend

## Lot 1 - Introduire un écran Markets

### Fichiers à créer

- `frontend/src/app/[locale]/(dashboard)/markets/page.tsx`
- `frontend/src/components/markets/create-market-wizard.tsx`
- `frontend/src/components/markets/market-card.tsx`
- `frontend/src/components/markets/market-readiness-panel.tsx`

### Fichiers à modifier

- [dashboard-navigation.ts](/Users/victorsoldet/Desktop/Feedplug/frontend/src/components/layout/dashboard-navigation.ts)
- [onboarding-tour.tsx](/Users/victorsoldet/Desktop/Feedplug/frontend/src/components/onboarding/onboarding-tour.tsx)
- [contextual-guide.tsx](/Users/victorsoldet/Desktop/Feedplug/frontend/src/components/onboarding/contextual-guide.tsx)

### Objectif UX

Le point d'entrée ne doit plus être "Créer un flux de sortie" mais "Créer un marché".

## Lot 2 - Remplacer le modal actuel

### Aujourd'hui

Le modal [create-export-modal.tsx](/Users/victorsoldet/Desktop/Feedplug/frontend/src/components/forms/create-export-modal.tsx) ne crée rien et redirige vers `/flux`.

### Cible

Le remplacer par un wizard :

1. marché source
2. marché cible
3. langues
4. canaux
5. devise / pricing / shipping
6. comptes connectés
7. validation

## Lot 3 - Faire évoluer la page Flux

### Aujourd'hui

La page Flux est encore organisée autour de :

- `SUPPORTED_CHANNELS`
- push Google par feed
- push Amazon par `channel`

dans [flux/page.tsx](</Users/victorsoldet/Desktop/Feedplug/frontend/src/app/[locale]/(dashboard)/flux/page.tsx>) et [channels/catalog.ts](/Users/victorsoldet/Desktop/Feedplug/frontend/src/lib/channels/catalog.ts).

### Cible

La page Flux doit devenir :

- une vue d'exécution des marchés
- avec des cartes par `Market`
- puis des sous-cartes par `MarketChannel`

Le marketeur doit voir :

- Italie
- Google Italy
- Amazon Italy
- readiness
- dernier push
- erreurs

Pas :

- `amazon_it`
- `gmc`
- `channelKey`

## Lot 4 - Faire évoluer le catalogue

### Aujourd'hui

La fiche produit active `google`, `amazon`, `meta` globalement dans [catalogue/[id]/page.tsx](</Users/victorsoldet/Desktop/Feedplug/frontend/src/app/[locale]/(dashboard)/catalogue/[id]/page.tsx>).

### Cible

La fiche produit doit afficher :

- Marché France
- Marché Italie
- Marché Belgique

Puis, dans chaque marché :

- Google
- Amazon
- Meta

Le marketeur choisit donc "ce produit part en Italie sur Google et Amazon", pas "ce produit a `amazon=true`".

## Lot 5 - Faire évoluer l'optimiseur

### Aujourd'hui

L'optimiseur et les règles utilisent `SUPPORTED_CHANNELS` et `channelIds`.

### Cible

Le scope doit être présenté en langage métier :

- tous les marchés
- Italie
- Belgique FR
- tous les canaux Google
- Amazon Italie

La technique de destination reste cachée sauf en vue avancée.

---

## Ordre de livraison recommandé

## Release 1 - Foundations

- migrations Prisma Lot A
- API Markets en lecture/écriture
- génération des destinations
- page Markets simple

### Résultat visible

On peut créer un marché, mais pas encore tout piloter depuis le catalogue.

## Release 2 - Wizard market-first

- remplacement du modal actuel
- création marché source -> marché cible
- sélection langues / canaux / devise
- readiness de base

### Résultat visible

Le marketeur a enfin un vrai flow "ouvrir un marché".

## Release 3 - Push market-aware

- Google et Amazon basculent sur `Destination`
- la page Flux devient market-first
- plus de hardcodes pays/langue

### Résultat visible

L'Italie, la Belgique et la Suisse deviennent gérables proprement.

## Release 4 - Activations produit

- bascule catalogue vers `ProductActivation`
- dual-write puis retrait progressif de `_channelOverrides`

### Résultat visible

Le choix de diffusion produit est enfin cohérent avec les marchés.

## Release 5 - Règles et contenu avancé

- sélecteurs de règles market-aware
- variantes de contenu et d'offre
- readiness plus fine

### Résultat visible

Le système devient réellement scalable pour les futurs connecteurs.

---

## Définition de done V1

La V1 sera considérée réussie si un client peut faire le scénario suivant sans aide technique :

1. partir de son marché France
2. créer un marché Italie
3. choisir `it-IT`
4. activer Google et Amazon
5. connecter ou réutiliser les bons comptes
6. voir si le marché est prêt ou bloqué
7. lancer la publication depuis une interface compréhensible

Et sous le capot :

- le système a créé des `MarketChannel`
- le système a généré les `Destination`
- Google n'est plus hardcodé sur `FR/fr`
- Amazon ne dépend plus d'une clé UX comme source de vérité

---

## Recommandation CTO

Si on veut aller vite sans se piéger :

1. créer le socle `Market + MarketLocale + MarketChannel + Destination`
2. livrer le wizard market-first
3. brancher Google et Amazon sur ce socle
4. seulement ensuite faire la bascule catalogue et règles

Le bon arbitrage n'est pas "tout modéliser avant de lancer".

Le bon arbitrage est :

- **modéliser juste assez pour rendre l'ouverture de marché simple**
- **garder la sophistication interne cachée**
- **faire porter la complexité par le moteur, pas par le marketeur**

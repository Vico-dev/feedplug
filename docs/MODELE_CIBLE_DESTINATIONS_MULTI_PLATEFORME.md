# Modèle cible multi-marché / multi-langue / multi-plateforme

## Objectif

Poser un modèle cible qui permette à FeedPlug de gérer proprement :

- des marchés mono-langue et multi-langues
- Google, Amazon, Meta aujourd'hui
- TikTok, Pinterest, Snapchat, Faire, Ankorstore, Mirakl et futures plateformes demain
- des variantes de contenu, d'offre et de conformité sans multiplier les hacks par canal

Le point clé : du point de vue du marketeur, le produit doit être structuré autour d'un **marché** ; en interne, le moteur doit être structuré autour d'une **destination de diffusion**.

---

## Pourquoi le modèle actuel casse

Le schéma actuel est cohérent pour un MVP, mais il casse dès qu'on veut industrialiser l'ouverture de marchés :

- `PlatformConnection` modélise une connexion par `account + platform`, pas plusieurs contextes de diffusion sur une même plateforme.
- `ExportChannel` ne porte qu'un `platform` et un `channelKey` texte ; il ne modélise pas explicitement pays, langue, devise, compte externe, storefront ou politique commerciale.
- les activations produit sont aujourd'hui raisonnées "par plateforme" ou "par clé de canal", pas par destination métier.
- les règles ciblent `channelIds` en JSON, ce qui ne permet pas un ciblage élégant par marché, langue, famille de plateforme ou bundle commercial.
- le pipeline de publication pense encore en "export/push d'un feed" plus qu'en "projection d'un catalogue vers une destination".

Conséquence : dès qu'un marché a plusieurs langues, qu'une plateforme a plusieurs scopes techniques, ou qu'un même compte client veut plusieurs destinations sur une même plateforme, le modèle devient fragile.

---

## Principes de conception

### 1. Le catalogue canonique reste séparé de la diffusion

Le catalogue représente la vérité produit. La diffusion représente la façon dont ce produit est projeté vers une plateforme cible.

### 2. Le marché devient l'objet configuré par le marketeur

L'UX doit être **market-first**.

Un marketeur doit pouvoir :

- créer un marché une fois
- choisir pays ou groupe de pays
- choisir langues
- choisir canaux à activer
- définir devise, pricing, shipping, taxes, stratégie de contenu
- publier sans manipuler des objets techniques

Autrement dit : on pense comme Shopify Markets pour l'expérience produit.

### 3. La destination devient l'unité de publication interne

Une destination = **plateforme + compte connecté + marché + langue éventuelle + devise + scope technique**.

Exemples :

- Google Merchant Center / compte X / Italie / `it-IT` / EUR
- Meta / catalogue Y / Belgique / `fr-BE` / EUR
- Meta / catalogue Y / Belgique / `nl-BE` / EUR
- Amazon / seller Z / Italie / EUR / marketplace IT

La destination n'est pas l'objet principal dans l'interface. Elle est générée en arrière-plan depuis la configuration du marché.

### 4. Le pays et la langue ne sont plus confondus

Un marché peut avoir plusieurs langues actives. La langue doit donc être modélisée séparément du marché.

### 5. Les différences de plateformes sont pilotées par des capacités

On ne doit pas multiplier les `if (platform === ...)` dans le coeur métier. Chaque plateforme expose des capacités : besoin d'une langue, d'un pays, d'une taxonomie, d'un push API, d'un export fichier, etc.

### 6. Le contenu et l'offre sont deux sujets distincts

Le titre, la description, les bullets et les assets relèvent du **contenu**.

Le prix, la devise, le stock, le shipping, la taxe, la promo relèvent de **l'offre**.

Les deux peuvent varier par marché, par langue, ou par destination.

### 7. "Lancer un marché" est une orchestration

Ouvrir l'Italie ou la Belgique ne doit pas créer un canal magique. Cela doit :

- créer les destinations requises
- cloner ou traduire le contenu
- appliquer les policies d'offre
- connecter les comptes externes manquants
- calculer un readiness score
- lancer les publications

---

## Vue produit cible

Il faut distinguer deux couches :

- **couche visible marketeur** : `Market`, `MarketLocale`, `MarketChannel`
- **couche interne d'exécution** : `Destination`, `DestinationPolicy`, `ListingProjection`, `PublicationRun`

Le marketeur configure un marché. Le système génère ensuite les destinations nécessaires selon les plateformes et les langues actives.

Exemple :

- en UI : "Italie"
- sous le capot : Google IT, Amazon IT, Meta IT, avec une ou plusieurs destinations techniques selon les besoins réels

---

## Parcours cible de création d'un marché

Le marketeur ne doit pas assembler des canaux techniques un par un. Il doit suivre un flow court, orienté business.

### Etape 1 - Nommer et cloner

Le marketeur choisit :

- le nom du marché
- le marché source à cloner si besoin
- le pays ou groupe de pays cible

### Etape 2 - Choisir les langues

Le marketeur choisit :

- la langue principale
- les langues additionnelles
- la stratégie par langue : `reuse`, `translate`, `adapt`

### Etape 3 - Activer les canaux

Le marketeur choisit simplement :

- Google
- Meta
- Amazon
- TikTok
- Pinterest
- autres plateformes compatibles

Le système sait ensuite quelles destinations internes créer.

### Etape 4 - Régler l'offre du marché

Le marketeur choisit :

- devise
- politique de prix
- politique promo
- stock / disponibilité
- shipping / délais
- taxes si nécessaire

### Etape 5 - Régler le contenu

Le marketeur choisit :

- réutiliser le contenu source
- traduire automatiquement
- adapter avec IA
- exiger validation manuelle avant publication

### Etape 6 - Connecter les comptes manquants

Si un canal a besoin d'un compte non connecté, l'interface demande simplement :

- quel compte utiliser
- ou de connecter un nouveau compte

### Etape 7 - Vérifier et lancer

Avant activation, l'interface affiche :

- readiness score global du marché
- blocages par canal
- blocages par langue
- volume de produits prêts à partir

Puis le système :

- crée les `MarketChannel`
- génère les `Destination`
- initialise les variantes
- prépare les projections à publier

Ce flow doit tenir sur un wizard simple, avec une vue avancée optionnelle mais jamais imposée.

---

## Couches métier cibles

### 1. Catalogue canonique

- `CatalogProduct`
- `ProductAttribute`
- `ProductAsset`

### 2. Expérience marché

- `Market`
- `MarketLocale`
- `MarketChannel`

### 3. Diffusion plateforme

- `PlatformDefinition`
- `PlatformAccount`
- `Destination`
- `DestinationPolicy`
- `TaxonomyMappingProfile`

### 4. Variantes métier

- `ContentVariant`
- `OfferVariant`
- `ProductActivation`

### 5. Exécution et feedback

- `RequirementProfile`
- `ListingProjection`
- `PublicationRun`
- `PublicationItemResult`

### 6. Orchestration go-to-market

- `LaunchPlan`
- `LaunchPlanDestination`

---

## Entités pivot

### `Market`

Représente un marché configuré par un client dans FeedPlug.

C'est l'objet principal visible dans l'UX. C'est ici que le marketeur fait son paramétrage unique "à la Shopify Markets".

Champs attendus :

- `accountId`
- `code` : `FR`, `IT`, `BE`, `CH`, etc.
- `name`
- `countryCodesJson`
- `sourceMarketId` nullable
- `defaultCurrencyCode`
- `status`
- `pricingPolicyJson`
- `shippingPolicyJson`
- `taxPolicyJson`
- `contentStrategyJson`
- `publicationDefaultsJson`

Remarque : un marché peut représenter un pays unique ou, plus tard, un groupement commercial si on veut gérer des bundles de pays.

### `MarketLocale`

Représente une langue exploitable à l'intérieur d'un marché.

Exemples :

- `fr-BE`
- `nl-BE`
- `de-CH`
- `fr-CH`
- `it-CH`

Champs attendus :

- `marketId`
- `localeCode`
- `languageCode`
- `countryCode`
- `isDefault`
- `isRequiredForLaunch`
- `translationMode`

Exemples de `translationMode` :

- `reuse`
- `translate`
- `adapt`

### `MarketChannel`

Représente un canal activé dans un marché.

Du point de vue marketeur, c'est l'objet "Google en Italie", "Meta en Belgique", "Amazon en Suisse".

Champs attendus :

- `marketId`
- `platformKey`
- `platformAccountId`
- `status`
- `settingsJson`
- `isEnabled`

Un `MarketChannel` peut matérialiser une ou plusieurs destinations internes.

Exemples :

- Google Belgique + langues `fr-BE` et `nl-BE` -> 2 destinations
- Amazon Italie -> 1 destination
- Meta Suisse + 3 langues -> 3 destinations ou 1 destination multi-locale selon les capacités réelles de l'adapter

### `PlatformDefinition`

Décrit une plateforme et ses capacités. Ce n'est pas de la donnée client ; c'est plutôt un registre seedé et versionné.

Champs attendus :

- `key` : `google_merchant_center`, `amazon`, `meta`, `tiktok`, `faire`, `ankorstore`
- `family` : `SEARCH`, `MARKETPLACE`, `SOCIAL`, `WHOLESALE`, `OTHER`
- `capabilitiesJson`
- `status`

Exemples de capacités :

- `requiresMarket`
- `requiresLocale`: `required | optional | inferred | unsupported`
- `requiresCurrency`
- `supportsPushApi`
- `supportsFileExport`
- `supportsTaxonomyMapping`
- `supportsPerDestinationContent`
- `supportsPerDestinationOffer`
- `supportsCatalogLevelPublish`
- `supportsListingLevelPublish`
- `supportsMultipleScopesPerAccount`

### `PlatformAccount`

Remplace la vision actuelle de `PlatformConnection`. Représente un compte externe connecté pour un client.

Champs attendus :

- `accountId`
- `platformKey`
- `externalAccountId`
- `externalAccountName`
- `status`
- `credentialsCiphertext`
- `credentialsVersion`
- `metadataJson`

Le compte plateforme peut porter plusieurs destinations.

### `Destination`

Objet central du moteur interne.

Une destination représente un point de diffusion concret.

Par défaut, elle ne doit pas être exposée comme objet principal en UI. Elle sert à exécuter, diagnostiquer et publier.

Champs attendus :

- `marketChannelId`
- `accountId`
- `platformKey`
- `platformAccountId`
- `marketId`
- `marketLocaleId` nullable selon la plateforme
- `currencyCode`
- `externalScopeType`
- `externalScopeId`
- `externalScopeLabel`
- `slug`
- `status`
- `isPrimary`
- `policyId`

Exemples de `externalScopeType` :

- `merchant_center`
- `catalog`
- `marketplace`
- `ad_account`
- `shop`
- `storefront`

Important : `slug` peut ressembler à `google_be_fr`, mais ce n'est plus la source de vérité. La source de vérité devient `destination.id`.

Important aussi : la plupart des marketeux ne doivent jamais avoir à voir cette clé.

### `DestinationPolicy`

Porte les règles commerciales, opérationnelles et de publication propres à la destination.

Champs attendus :

- `destinationId`
- `pricingPolicyJson`
- `inventoryPolicyJson`
- `shippingPolicyJson`
- `taxPolicyJson`
- `publishingPolicyJson`
- `contentPolicyJson`
- `taxonomyMappingProfileId`

### `TaxonomyMappingProfile`

Porte le mapping catégories/attributs vers une plateforme ou une destination.

Champs attendus :

- `accountId`
- `platformKey`
- `marketId` nullable
- `name`
- `categoryMapJson`
- `attributeMapJson`
- `complianceRulesJson`

### `ContentVariant`

Porte le contenu éditorial et média réutilisable.

Le modèle doit supporter plusieurs niveaux de scope :

- `GLOBAL`
- `MARKET`
- `LOCALE`
- `DESTINATION`

Cela permet de ne pas dupliquer inutilement :

- un contenu `it-IT` partagé par Google IT et Meta IT
- un override spécifique Amazon IT si la marketplace a ses propres contraintes

Champs attendus :

- `productId`
- `scopeType`
- `marketId` nullable
- `marketLocaleId` nullable
- `destinationId` nullable
- `sourceType` : `manual | ai | translated | cloned | imported`
- `title`
- `description`
- `bulletsJson`
- `attributesJson`
- `assetsOverrideJson`
- `qualityScore`
- `status`

### `OfferVariant`

Porte l'offre commerciale.

Scopes possibles :

- `MARKET`
- `DESTINATION`

Champs attendus :

- `productId`
- `scopeType`
- `marketId` nullable
- `destinationId` nullable
- `priceAmount`
- `salePriceAmount`
- `currencyCode`
- `availability`
- `inventoryQuantity`
- `shippingTemplate`
- `taxCode`
- `leadTimeDays`

### `ProductActivation`

Remplace les overrides actuels par plateforme.

C'est le lien métier entre un produit et une destination.

Champs attendus :

- `productId`
- `destinationId`
- `isEnabled`
- `activationStatus`
- `excludedReason`
- `manualOverride`

Sans cette table, on ne peut pas dire proprement :

- ce SKU part sur Google Italie mais pas sur Meta Italie
- ce SKU part sur Meta Belgique FR mais pas sur Belgique NL
- ce SKU est actif sur Amazon Italie mais bloqué sur Faire

### `RequirementProfile`

Décrit les champs requis, recommandés et interdits pour un produit donné sur une destination donnée.

Champs attendus :

- `platformKey`
- `marketId` nullable
- `categoryKey` nullable
- `requirementJson`
- `version`
- `source`

Ce profil peut être calculé depuis l'adapter plateforme et enrichi par la taxonomie.

### `ListingProjection`

Représente la projection calculée prête à publier.

Elle résulte de :

- `CatalogProduct`
- `ContentVariant` résolu
- `OfferVariant` résolu
- `DestinationPolicy`
- `TaxonomyMappingProfile`
- `RequirementProfile`

Champs attendus :

- `productId`
- `destinationId`
- `resolvedContentVariantId`
- `resolvedOfferVariantId`
- `payloadJson`
- `validationState`
- `readinessScore`
- `payloadHash`
- `computedAt`

### `PublicationRun`

Représente une tentative de publication.

Champs attendus :

- `destinationId`
- `mode` : `API_PUSH | FILE_EXPORT | HYBRID`
- `triggerSource` : `manual | scheduled | launch_plan | retry`
- `status`
- `itemCount`
- `successCount`
- `failureCount`
- `artifactUrl`
- `startedAt`
- `finishedAt`

### `PublicationItemResult`

Représente le feedback item par item.

Champs attendus :

- `publicationRunId`
- `productId`
- `destinationId`
- `externalListingId`
- `status`
- `warningJson`
- `errorJson`
- `rawResponseJson`

### `LaunchPlan`

Représente l'ouverture d'un nouveau marché ou d'un bundle de destinations.

Champs attendus :

- `accountId`
- `sourceMarketId` nullable
- `targetMarketId`
- `requestedLocalesJson`
- `requestedPlatformsJson`
- `strategyJson`
- `status`

### `LaunchPlanDestination`

Liste les destinations créées ou visées par un `LaunchPlan`.

Champs attendus :

- `launchPlanId`
- `destinationId`
- `status`
- `readinessScore`
- `notesJson`

---

## Résolution des variantes

Pour éviter la duplication tout en gardant de la souplesse, le moteur doit résoudre les variantes selon une priorité stable.

### Contenu

Ordre recommandé :

1. `DESTINATION`
2. `LOCALE`
3. `MARKET`
4. `GLOBAL`
5. fallback catalogue canonique

### Offre

Ordre recommandé :

1. `DESTINATION`
2. `MARKET`
3. fallback offre canonique

Ce mécanisme permet :

- une adaptation locale réutilisable
- un override strictement spécifique à une plateforme si nécessaire
- un chemin de migration progressif depuis les contenus actuels

---

## Proposition de schéma Prisma cible

Le but n'est pas de figer chaque colonne dès maintenant, mais de poser la structure relationnelle.

```prisma
enum PlatformFamily {
  SEARCH
  MARKETPLACE
  SOCIAL
  WHOLESALE
  OTHER
}

enum DestinationStatus {
  DRAFT
  READY
  ACTIVE
  PAUSED
  ERROR
}

enum VariantScope {
  GLOBAL
  MARKET
  LOCALE
  DESTINATION
}

enum OfferScope {
  MARKET
  DESTINATION
}

enum PublicationMode {
  API_PUSH
  FILE_EXPORT
  HYBRID
}

enum PublicationStatus {
  PENDING
  RUNNING
  SUCCESS
  PARTIAL
  FAILED
}

model Market {
  id                  String   @id @default(cuid())
  accountId           String   @map("accountid")
  sourceMarketId      String?  @map("sourcemarketid")
  code                String
  name                String
  countryCodesJson    Json     @default("[]") @map("countrycodesjson")
  defaultCurrencyCode String   @map("defaultcurrencycode")
  status              String   @default("draft")
  pricingPolicyJson   Json     @default("{}") @map("pricingpolicyjson")
  shippingPolicyJson  Json     @default("{}") @map("shippingpolicyjson")
  taxPolicyJson       Json     @default("{}") @map("taxpolicyjson")
  contentStrategyJson Json     @default("{}") @map("contentstrategyjson")
  publicationDefaultsJson Json @default("{}") @map("publicationdefaultsjson")
  createdAt           DateTime @default(now()) @map("createdat")
  updatedAt           DateTime @updatedAt @map("updatedat")

  account             Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  sourceMarket        Market?  @relation("MarketCloneSource", fields: [sourceMarketId], references: [id])
  clonedMarkets       Market[] @relation("MarketCloneSource")
  locales             MarketLocale[]
  channels            MarketChannel[]
  destinations        Destination[]

  @@unique([accountId, code])
  @@index([accountId])
}

model MarketLocale {
  id               String   @id @default(cuid())
  marketId         String   @map("marketid")
  localeCode       String   @map("localecode")
  languageCode     String   @map("languagecode")
  countryCode      String   @map("countrycode")
  isDefault        Boolean  @default(false) @map("isdefault")
  isRequiredLaunch Boolean  @default(false) @map("isrequiredlaunch")
  translationMode  String   @default("translate") @map("translationmode")

  market           Market   @relation(fields: [marketId], references: [id], onDelete: Cascade)
  destinations     Destination[]

  @@unique([marketId, localeCode])
  @@index([marketId])
}

model MarketChannel {
  id                String   @id @default(cuid())
  marketId          String   @map("marketid")
  platformKey       String   @map("platformkey")
  platformAccountId String   @map("platformaccountid")
  status            String   @default("draft")
  isEnabled         Boolean  @default(true) @map("isenabled")
  settingsJson      Json     @default("{}") @map("settingsjson")
  createdAt         DateTime @default(now()) @map("createdat")
  updatedAt         DateTime @updatedAt @map("updatedat")

  market            Market             @relation(fields: [marketId], references: [id], onDelete: Cascade)
  platform          PlatformDefinition @relation(fields: [platformKey], references: [key])
  platformAccount   PlatformAccount    @relation(fields: [platformAccountId], references: [id], onDelete: Cascade)
  destinations      Destination[]

  @@unique([marketId, platformKey])
  @@index([marketId])
  @@index([platformKey])
}

model PlatformDefinition {
  key              String         @id
  displayName      String         @map("displayname")
  family           PlatformFamily
  capabilitiesJson Json           @default("{}") @map("capabilitiesjson")
  status           String         @default("active")
  createdAt        DateTime       @default(now()) @map("createdat")
  updatedAt        DateTime       @updatedAt @map("updatedat")

  accounts         PlatformAccount[]
  destinations     Destination[]
}

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

  account               Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  platform              PlatformDefinition @relation(fields: [platformKey], references: [key])
  destinations          Destination[]

  @@index([accountId])
  @@index([platformKey])
  @@unique([accountId, platformKey, externalAccountId])
}

model TaxonomyMappingProfile {
  id                  String   @id @default(cuid())
  accountId           String   @map("accountid")
  platformKey         String   @map("platformkey")
  marketId            String?  @map("marketid")
  name                String
  categoryMapJson     Json     @default("{}") @map("categorymapjson")
  attributeMapJson    Json     @default("{}") @map("attributemapjson")
  complianceRulesJson Json     @default("{}") @map("compliancerulesjson")
  createdAt           DateTime @default(now()) @map("createdat")
  updatedAt           DateTime @updatedAt @map("updatedat")

  destinations        Destination[]

  @@index([accountId])
  @@index([platformKey])
  @@index([marketId])
}

model DestinationPolicy {
  id                     String   @id @default(cuid())
  pricingPolicyJson      Json     @default("{}") @map("pricingpolicyjson")
  inventoryPolicyJson    Json     @default("{}") @map("inventorypolicyjson")
  shippingPolicyJson     Json     @default("{}") @map("shippingpolicyjson")
  taxPolicyJson          Json     @default("{}") @map("taxpolicyjson")
  publishingPolicyJson   Json     @default("{}") @map("publishingpolicyjson")
  contentPolicyJson      Json     @default("{}") @map("contentpolicyjson")
  taxonomyProfileId      String?  @map("taxonomyprofileid")
  createdAt              DateTime @default(now()) @map("createdat")
  updatedAt              DateTime @updatedAt @map("updatedat")

  destinations           Destination[]
}

model Destination {
  id                 String            @id @default(cuid())
  marketChannelId    String            @map("marketchannelid")
  accountId          String            @map("accountid")
  platformKey        String            @map("platformkey")
  platformAccountId  String            @map("platformaccountid")
  marketId           String            @map("marketid")
  marketLocaleId     String?           @map("marketlocaleid")
  currencyCode       String            @map("currencycode")
  externalScopeType  String            @map("externalscopetype")
  externalScopeId    String?           @map("externalscopeid")
  externalScopeLabel String?           @map("externalscopelabel")
  slug               String
  status             DestinationStatus @default(DRAFT)
  isPrimary          Boolean           @default(false) @map("isprimary")
  policyId           String?           @map("policyid")
  createdAt          DateTime          @default(now()) @map("createdat")
  updatedAt          DateTime          @updatedAt @map("updatedat")

  account            Account               @relation(fields: [accountId], references: [id], onDelete: Cascade)
  marketChannel      MarketChannel         @relation(fields: [marketChannelId], references: [id], onDelete: Cascade)
  platform           PlatformDefinition    @relation(fields: [platformKey], references: [key])
  platformAccount    PlatformAccount       @relation(fields: [platformAccountId], references: [id], onDelete: Cascade)
  market             Market                @relation(fields: [marketId], references: [id])
  locale             MarketLocale?         @relation(fields: [marketLocaleId], references: [id])
  policy             DestinationPolicy?    @relation(fields: [policyId], references: [id])
  taxonomyProfile    TaxonomyMappingProfile? @relation(fields: [taxonomyProfileId], references: [id])
  activations        ProductActivation[]
  projections        ListingProjection[]
  publicationRuns    PublicationRun[]

  taxonomyProfileId  String?               @map("taxonomyprofileid")

  @@index([accountId])
  @@index([marketChannelId])
  @@index([platformKey])
  @@index([marketId])
  @@index([marketLocaleId])
  @@unique([accountId, slug])
}

model ContentVariant {
  id                String       @id @default(cuid())
  productId         String       @map("productid")
  scopeType         VariantScope @map("scopetype")
  marketId          String?      @map("marketid")
  marketLocaleId    String?      @map("marketlocaleid")
  destinationId     String?      @map("destinationid")
  sourceType        String       @default("manual") @map("sourcetype")
  title             String?
  description       String?
  bulletsJson       Json         @default("[]") @map("bulletsjson")
  attributesJson    Json         @default("{}") @map("attributesjson")
  assetsOverrideJson Json        @default("{}") @map("assetsoverridejson")
  qualityScore      Decimal?     @map("qualityscore")
  status            String       @default("draft")
  createdAt         DateTime     @default(now()) @map("createdat")
  updatedAt         DateTime     @updatedAt @map("updatedat")

  @@index([productId])
  @@index([marketId])
  @@index([marketLocaleId])
  @@index([destinationId])
}

model OfferVariant {
  id                String     @id @default(cuid())
  productId         String     @map("productid")
  scopeType         OfferScope @map("scopetype")
  marketId          String?    @map("marketid")
  destinationId     String?    @map("destinationid")
  priceAmount       Decimal?   @map("priceamount")
  salePriceAmount   Decimal?   @map("salepriceamount")
  currencyCode      String     @map("currencycode")
  availability      String?    @default("in_stock")
  inventoryQuantity Int?       @map("inventoryquantity")
  shippingTemplate  String?    @map("shippingtemplate")
  taxCode           String?    @map("taxcode")
  leadTimeDays      Int?       @map("leadtimedays")
  createdAt         DateTime   @default(now()) @map("createdat")
  updatedAt         DateTime   @updatedAt @map("updatedat")

  @@index([productId])
  @@index([marketId])
  @@index([destinationId])
}

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

model ListingProjection {
  id                      String   @id @default(cuid())
  productId               String   @map("productid")
  destinationId           String   @map("destinationid")
  resolvedContentVariantId String? @map("resolvedcontentvariantid")
  resolvedOfferVariantId  String?  @map("resolvedoffervariantid")
  payloadJson             Json     @map("payloadjson")
  validationState         String   @default("pending") @map("validationstate")
  readinessScore          Decimal? @map("readinessscore")
  payloadHash             String   @map("payloadhash")
  computedAt              DateTime @default(now()) @map("computedat")

  destination             Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)

  @@unique([productId, destinationId])
  @@index([destinationId])
}

model PublicationRun {
  id            String            @id @default(cuid())
  destinationId String            @map("destinationid")
  mode          PublicationMode
  triggerSource String            @map("triggersource")
  status        PublicationStatus @default(PENDING)
  itemCount     Int               @default(0) @map("itemcount")
  successCount  Int               @default(0) @map("successcount")
  failureCount  Int               @default(0) @map("failurecount")
  artifactUrl   String?           @map("artifacturl")
  startedAt     DateTime?         @map("startedat")
  finishedAt    DateTime?         @map("finishedat")
  createdAt     DateTime          @default(now()) @map("createdat")

  destination   Destination       @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  results       PublicationItemResult[]

  @@index([destinationId])
  @@index([status])
}

model PublicationItemResult {
  id               String   @id @default(cuid())
  publicationRunId String   @map("publicationrunid")
  productId        String   @map("productid")
  destinationId    String   @map("destinationid")
  externalListingId String? @map("externallistingid")
  status           String
  warningJson      Json     @default("[]") @map("warningjson")
  errorJson        Json     @default("[]") @map("errorjson")
  rawResponseJson  Json     @default("{}") @map("rawresponsejson")
  createdAt        DateTime @default(now()) @map("createdat")

  publicationRun   PublicationRun @relation(fields: [publicationRunId], references: [id], onDelete: Cascade)

  @@index([publicationRunId])
  @@index([destinationId])
}

model LaunchPlan {
  id                   String   @id @default(cuid())
  accountId            String   @map("accountid")
  sourceMarketId       String?  @map("sourcemarketid")
  targetMarketId       String   @map("targetmarketid")
  requestedLocalesJson Json     @default("[]") @map("requestedlocalesjson")
  requestedPlatformsJson Json   @default("[]") @map("requestedplatformsjson")
  strategyJson         Json     @default("{}") @map("strategyjson")
  status               String   @default("draft")
  createdAt            DateTime @default(now()) @map("createdat")
  updatedAt            DateTime @updatedAt @map("updatedat")

  destinations         LaunchPlanDestination[]

  @@index([accountId])
  @@index([targetMarketId])
}

model LaunchPlanDestination {
  id             String   @id @default(cuid())
  launchPlanId   String   @map("launchplanid")
  destinationId  String   @map("destinationid")
  status         String   @default("pending")
  readinessScore Decimal? @map("readinessscore")
  notesJson      Json     @default("{}") @map("notesjson")

  launchPlan     LaunchPlan  @relation(fields: [launchPlanId], references: [id], onDelete: Cascade)

  @@unique([launchPlanId, destinationId])
  @@index([destinationId])
}
```

### Note importante sur `CatalogProduct`

Le schéma ci-dessus suppose un produit canonique distinct du `FeedItem`.

En pratique, pour éviter un big bang, il est raisonnable de faire la migration en deux temps :

- court terme : `productId` pointe encore vers `FeedItem.id`
- moyen terme : introduction d'un vrai `CatalogProduct` si plusieurs sources par SKU deviennent un besoin fort

La refonte "destination" ne doit pas dépendre d'une refonte complète du catalogue.

### Note importante sur `MarketChannel` et `Destination`

`MarketChannel` est l'objet que l'on peut afficher et piloter dans l'interface.

`Destination` reste un objet d'exécution. Il peut être :

- totalement caché en UX standard
- visible dans une vue avancée ou diagnostic
- généré automatiquement à chaque modification structurante d'un marché

Cette séparation est essentielle si l'on veut garder une expérience simple pour des marketeux.

---

## Contrat adapter plateforme

Le vrai levier d'échelle ne vient pas seulement des tables. Il vient aussi d'un contrat d'adapter stable.

Chaque plateforme doit exposer un adapter de ce type :

```ts
type PlatformAdapter = {
  key: string;
  family: 'SEARCH' | 'MARKETPLACE' | 'SOCIAL' | 'WHOLESALE' | 'OTHER';
  capabilities: {
    requiresMarket: boolean;
    requiresLocale: 'required' | 'optional' | 'inferred' | 'unsupported';
    requiresCurrency: boolean;
    supportsPushApi: boolean;
    supportsFileExport: boolean;
    supportsTaxonomyMapping: boolean;
    supportsPerDestinationContent: boolean;
    supportsPerDestinationOffer: boolean;
  };
  buildRequirementProfile(input: BuildRequirementInput): RequirementProfile;
  resolveProjection(input: ProjectionInput): ListingProjection;
  publish(input: PublishInput): PublicationRun;
  parseFeedback(input: FeedbackInput): PublicationItemResult[];
};
```

Conséquence :

- Google et Meta peuvent partager certains patterns
- Amazon et Faire peuvent diverger sur l'offre et la taxonomie
- l'arrivée d'une nouvelle plateforme devient l'ajout d'un adapter et de capacités, pas une réécriture du modèle

---

## Exemples concrets

### Belgique

Marché visible :

- `Market = BE`

Locales :

- `fr-BE`
- `nl-BE`

Canaux visibles :

- `Google Belgium`
- `Meta Belgium`

Destinations internes :

- `google / account A / BE / fr-BE / EUR`
- `google / account A / BE / nl-BE / EUR`
- `meta / account B / BE / fr-BE / EUR`
- `meta / account B / BE / nl-BE / EUR`

Contenu :

- un `ContentVariant` scope `LOCALE` pour `fr-BE`
- un `ContentVariant` scope `LOCALE` pour `nl-BE`
- éventuellement un override `DESTINATION` si Meta NL a des contraintes créatives spécifiques

### Suisse

Marché visible :

- `Market = CH`

Locales :

- `de-CH`
- `fr-CH`
- `it-CH`

Offre :

- une `OfferVariant` scope `MARKET` en CHF
- éventuellement une `OfferVariant` scope `DESTINATION` si une plateforme impose des frais ou règles spécifiques

### Italie

Marché visible :

- `Italy`

Canaux visibles :

- `Google Italy`
- `Amazon Italy`

Destinations internes :

- `google / account A / IT / it-IT / EUR`
- `amazon / account C / IT / locale inferred / EUR / marketplace IT`

Le modèle supporte donc qu'Amazon n'ait pas exactement la même granularité de langue que Google.

---

## Impact sur les objets existants

| Existant | Cible | Décision |
|----------|-------|----------|
| marché implicite dans le code | `Market` | en faire l'objet principal visible dans l'UX |
| activation plateforme dans la page Flux | `MarketChannel` | configurer les canaux au niveau du marché |
| `PlatformConnection` | `PlatformAccount` | migration quasi directe |
| `ExportChannel` | `MarketChannel` + `Destination` | séparer UX et exécution |
| `channelKey` | `Destination.slug` | garder un slug lisible, mais non structurant |
| overrides plateforme dans le runtime | `ProductActivation` | rendre l'activation explicite par destination |
| contenu optimisé par plateforme | `ContentVariant` | séparer contenu, scope et source |
| logique prix/stock implicite | `OfferVariant` + `DestinationPolicy` | rendre l'offre pilotable par marché ou destination |
| `Rule.channelIds` | `destinationIds` puis `targetSelectorJson` | migration en deux temps |
| export/push par `platform` ou `channel` | export/push par `destinationId` | clé de voûte de la transition |

---

## Plan de migration recommandé

## Phase 0 - Préparer la compatibilité

- introduire les tables `Market`, `MarketLocale`, `MarketChannel`, `PlatformAccount`, `Destination`, `DestinationPolicy`
- seed des `PlatformDefinition`
- garder le runtime actuel inchangé

Objectif : créer la nouvelle grammaire métier sans casser la prod.

## Phase 1 - Backfill des connexions et destinations

- migrer `PlatformConnection` vers `PlatformAccount`
- migrer `ExportChannel` vers `MarketChannel`, puis générer les `Destination`
- dériver un `slug` compatible depuis `platform + channelKey`
- rattacher un `marketId` et un `marketLocaleId` quand l'information est inférable

Objectif : avoir un inventaire complet des destinations existantes.

## Phase 2 - Passer les services en `destinationId`

- les endpoints de push/export acceptent `destinationId`
- le moteur de publication résout pays, langue, devise et scope depuis la destination
- `channelKey` reste accepté temporairement comme alias technique

Objectif : sortir définitivement des hardcodes `amazon_it`, `gmc`, `meta`.

## Phase 3 - Introduire l'activation explicite

- créer `ProductActivation`
- backfiller depuis les overrides actuels
- faire lire le catalogue et les exports depuis `ProductActivation`

Objectif : pouvoir activer un SKU par destination réelle.

## Phase 4 - Sortir le contenu et l'offre du runtime implicite

- créer `ContentVariant`
- créer `OfferVariant`
- implémenter la résolution des variantes
- commencer par Google, Amazon, Meta

Objectif : rendre possible un vrai multi-langue et multi-offre.

## Phase 5 - Ajouter projection, validation et feedback

- créer `ListingProjection`
- calculer `RequirementProfile`
- normaliser les retours plateformes dans `PublicationRun` et `PublicationItemResult`

Objectif : mesurer la readiness et fiabiliser les pushes.

## Phase 6 - Construire le flow "Lancer un marché"

- `LaunchPlan`
- création ou clonage d'un `Market`
- sélection des `MarketLocale`
- sélection des `MarketChannel`
- clonage du marché source vers marché cible
- traduction / adaptation
- configuration destinations
- readiness score par destination

Objectif : transformer l'ouverture d'un marché en flow produit, pas en chantier manuel.

---

## Décisions d'architecture recommandées

### 1. `Market` et `MarketChannel` doivent être le pivot UI ; `Destination` le pivot d'exécution

Toutes les opérations suivantes doivent recevoir un `destinationId` :

- activer un produit
- prévisualiser un listing
- exporter un fichier
- pousser vers une plateforme
- afficher les erreurs

En revanche, dans l'interface principale, le marketeur doit manipuler :

- un marché
- ses langues
- ses canaux
- sa stratégie de contenu et d'offre

### 2. `slug` est un identifiant UX, pas un identifiant métier

On peut garder `google_be_fr` ou `amazon_it` dans les menus, mais la logique ne doit plus parser ces chaînes.

### 3. `PlatformDefinition` peut rester seedé

Ce n'est pas nécessaire d'en faire un écran admin dans un premier temps. Le registre de capacités peut rester dans le code et être seedé en base pour reporting ou référentiel.

### 4. `ContentVariant` et `OfferVariant` doivent rester séparés

Les plateformes sociales et les marketplaces n'ont pas le même cycle de vie entre créa éditoriale et offre commerciale. Les fusionner recréera rapidement de la rigidité.

### 5. La refonte destinations ne doit pas attendre un master catalog parfait

Le vrai blocage business court terme est l'absence de destination explicite. On peut faire cette évolution avant la création d'un `CatalogProduct` totalement autonome.

---

## Ce que ce modèle débloque

- ouverture propre de marchés mono-langue et multi-langues
- paramétrage unique d'un marché, orienté marketing plutôt que technique
- support de plusieurs destinations sur une même plateforme
- support des plateformes à granularité différente
- réutilisation du contenu entre plateformes quand c'est pertinent
- adaptation spécifique quand une plateforme l'exige
- readiness score par destination
- flow produit "lancer un marché"
- ajout futur de TikTok, Pinterest, Snapchat, Faire, Ankorstore sans casser le coeur métier

---

## Recommandation de mise en oeuvre

Si on veut maximiser l'impact produit avec le moins de risque :

1. faire d'abord `PlatformAccount + Market + MarketChannel + Destination`
2. passer Google, Amazon et Meta en `destinationId`
3. sortir ensuite `ProductActivation + ContentVariant + OfferVariant`
4. finir par `LaunchPlan` et le wizard d'ouverture de marché

Autrement dit : **construire une UX market-first sur une colonne vertébrale destination-first**.

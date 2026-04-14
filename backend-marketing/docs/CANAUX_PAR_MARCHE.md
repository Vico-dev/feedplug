# Canaux par marché (pays)

**Objectif** : savoir quels canaux (Amazon, GMC, etc.) proposer selon le pays du compte ou du flux, pour l’internationalisation.

## Fichier de configuration

- **`backend-marketing/config/channels-by-market.js`**
  - `getChannelsForCountry(countryCode)` → liste de `channelKey` (ex. `['amazon_uk', 'gmc']`)
  - `getAmazonChannels()` → config complète des marketplaces Amazon (marketplaceId, currency, countryCode, locale, label)
  - `CHANNELS_BY_COUNTRY` : mapping pays (ISO 3166-1 alpha-2) → channelKeys

## Pays avec canal Amazon dédié

| Pays | Code | Canaux |
|------|------|--------|
| France | FR | amazon_fr, gmc |
| Royaume-Uni | GB | amazon_uk, gmc |
| Allemagne | DE | amazon_de, gmc |
| Italie | IT | amazon_it, gmc |
| Espagne | ES | amazon_es, gmc |

## Autres pays

Pour les pays listés dans `CHANNELS_BY_COUNTRY` (BE, NL, AT, CH, SE, NO, DK, FI, PL, PT, etc.), seul **gmc** (Google Merchant Center) est proposé par défaut. L’export GMC peut cibler plusieurs pays ; les canaux Amazon peuvent être étendus plus tard (ex. Amazon SE) selon la roadmap produit.

## Utilisation

- **Onboarding / compte** : si l’utilisateur renseigne un pays, appeler `getChannelsForCountry(country)` pour pré-sélectionner ou afficher les canaux disponibles.
- **Création de flux / export** : filtrer la liste des canaux proposés selon le pays du compte ou un paramètre « marché cible ».

## Référence

- Design canaux Amazon : `AMAZON_CANAUX_DESIGN.md`
- Implémentation serveur : `server-minimal.js` (AMAZON_CHANNELS, routes export)

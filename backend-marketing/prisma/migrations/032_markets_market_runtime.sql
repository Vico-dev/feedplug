-- Migration 032 : socle Markets market-first
-- Ajoute la couche marché/langues/canaux visible en UX, tout en gardant le runtime legacy intact.

CREATE TABLE IF NOT EXISTS "Market" (
  id                      TEXT PRIMARY KEY,
  accountid               TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  sourcemarketid          TEXT REFERENCES "Market"(id) ON DELETE SET NULL,
  code                    TEXT NOT NULL,
  name                    TEXT NOT NULL,
  countrycodesjson        JSONB NOT NULL DEFAULT '[]',
  defaultcurrencycode     TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'draft',
  pricingpolicyjson       JSONB NOT NULL DEFAULT '{}',
  shippingpolicyjson      JSONB NOT NULL DEFAULT '{}',
  taxpolicyjson           JSONB NOT NULL DEFAULT '{}',
  contentstrategyjson     JSONB NOT NULL DEFAULT '{}',
  publicationdefaultsjson JSONB NOT NULL DEFAULT '{}',
  createdat               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_market_account_code
  ON "Market"(accountid, code);
CREATE INDEX IF NOT EXISTS idx_market_accountid
  ON "Market"(accountid);
CREATE INDEX IF NOT EXISTS idx_market_sourcemarketid
  ON "Market"(sourcemarketid);

COMMENT ON TABLE "Market" IS 'Marché visible en UX : paramétrage business d''un pays/groupe de pays.';

CREATE TABLE IF NOT EXISTS "MarketLocale" (
  id               TEXT PRIMARY KEY,
  marketid         TEXT NOT NULL REFERENCES "Market"(id) ON DELETE CASCADE,
  localecode       TEXT NOT NULL,
  languagecode     TEXT NOT NULL,
  countrycode      TEXT NOT NULL,
  isdefault        BOOLEAN NOT NULL DEFAULT false,
  isrequiredlaunch BOOLEAN NOT NULL DEFAULT false,
  translationmode  TEXT NOT NULL DEFAULT 'translate',
  createdat        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_marketlocale_market_locale
  ON "MarketLocale"(marketid, localecode);
CREATE INDEX IF NOT EXISTS idx_marketlocale_marketid
  ON "MarketLocale"(marketid);

COMMENT ON TABLE "MarketLocale" IS 'Langues activées dans un marché (ex. fr-BE, nl-BE).';

CREATE TABLE IF NOT EXISTS "PlatformAccount" (
  id                    TEXT PRIMARY KEY,
  accountid             TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  platformkey           TEXT NOT NULL,
  externalaccountid     TEXT,
  externalaccountname   TEXT,
  credentialsciphertext TEXT,
  credentialsversion    INT NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'active',
  metadatajson          JSONB NOT NULL DEFAULT '{}',
  createdat             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platformaccount_accountid
  ON "PlatformAccount"(accountid);
CREATE INDEX IF NOT EXISTS idx_platformaccount_platformkey
  ON "PlatformAccount"(platformkey);

COMMENT ON TABLE "PlatformAccount" IS 'Compte plateforme logique, distinct de PlatformConnection legacy.';

CREATE TABLE IF NOT EXISTS "MarketChannel" (
  id                TEXT PRIMARY KEY,
  marketid          TEXT NOT NULL REFERENCES "Market"(id) ON DELETE CASCADE,
  platformkey       TEXT NOT NULL,
  platformaccountid TEXT REFERENCES "PlatformAccount"(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  isenabled         BOOLEAN NOT NULL DEFAULT true,
  settingsjson      JSONB NOT NULL DEFAULT '{}',
  createdat         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_marketchannel_market_platform
  ON "MarketChannel"(marketid, platformkey);
CREATE INDEX IF NOT EXISTS idx_marketchannel_marketid
  ON "MarketChannel"(marketid);
CREATE INDEX IF NOT EXISTS idx_marketchannel_platformaccountid
  ON "MarketChannel"(platformaccountid);

COMMENT ON TABLE "MarketChannel" IS 'Canal visible en UX dans un marché (Google Italy, Amazon Italy, etc.).';

CREATE TABLE IF NOT EXISTS "Destination" (
  id                 TEXT PRIMARY KEY,
  accountid          TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  marketid           TEXT NOT NULL REFERENCES "Market"(id) ON DELETE CASCADE,
  marketchannelid    TEXT NOT NULL REFERENCES "MarketChannel"(id) ON DELETE CASCADE,
  marketlocaleid     TEXT REFERENCES "MarketLocale"(id) ON DELETE SET NULL,
  platformkey        TEXT NOT NULL,
  platformaccountid  TEXT REFERENCES "PlatformAccount"(id) ON DELETE SET NULL,
  currencycode       TEXT NOT NULL,
  externalscopetype  TEXT NOT NULL,
  externalscopeid    TEXT,
  externalscopelabel TEXT,
  slug               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft',
  isprimary          BOOLEAN NOT NULL DEFAULT false,
  configjson         JSONB NOT NULL DEFAULT '{}',
  createdat          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_destination_account_slug
  ON "Destination"(accountid, slug);
CREATE INDEX IF NOT EXISTS idx_destination_marketid
  ON "Destination"(marketid);
CREATE INDEX IF NOT EXISTS idx_destination_marketchannelid
  ON "Destination"(marketchannelid);
CREATE INDEX IF NOT EXISTS idx_destination_marketlocaleid
  ON "Destination"(marketlocaleid);

COMMENT ON TABLE "Destination" IS 'Destination technique de diffusion générée depuis un marché.';

CREATE TABLE IF NOT EXISTS "ProductActivation" (
  id               TEXT PRIMARY KEY,
  productid        TEXT NOT NULL,
  destinationid    TEXT NOT NULL REFERENCES "Destination"(id) ON DELETE CASCADE,
  isenabled        BOOLEAN NOT NULL DEFAULT true,
  activationstatus TEXT NOT NULL DEFAULT 'active',
  excludedreason   TEXT,
  manualoverride   BOOLEAN NOT NULL DEFAULT false,
  createdat        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_productactivation_product_destination
  ON "ProductActivation"(productid, destinationid);
CREATE INDEX IF NOT EXISTS idx_productactivation_destinationid
  ON "ProductActivation"(destinationid);

COMMENT ON TABLE "ProductActivation" IS 'Activation explicite d''un produit par destination.';

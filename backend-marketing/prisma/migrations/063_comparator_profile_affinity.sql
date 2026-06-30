-- Onboarding enrichi du compte CONSO du comparateur : socio-démo (RGPD) + affinité marques.
--
-- Contexte : la personnalisation du feed/reco s'appuie sur ComparatorInterest (catégories,
-- migration 055) ET, en option, sur des données socio-démographiques et des marques favorites.
--
-- RGPD : ComparatorProfile contient des données personnelles. Toutes ses colonnes sont
-- NULLABLE (jamais bloquant), et `consentat` matérialise le consentement explicite à la
-- finalité « personnalisation des recommandations ». Aucune IP/donnée d'identification
-- directe n'est stockée ici. La suppression du compte (autre périmètre) supprimera ces lignes
-- par userid.
--
-- Tables PascalCase, colonnes minuscules, idempotent (CREATE TABLE IF NOT EXISTS).

-- Profil socio-démographique (1 ligne par user, toutes valeurs optionnelles).
CREATE TABLE IF NOT EXISTS "ComparatorProfile" (
  userid      text PRIMARY KEY,
  agerange    text,          -- '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'
  gender      text,          -- 'f' | 'h' | 'autre' | 'nsp'
  region      text,          -- code région/département FR (ex. 'idf', '75')
  household   text,          -- 'seul' | 'couple' | 'famille' | 'coloc' | 'autre'
  budgetrange text,          -- 'eco' | 'moyen' | 'premium'
  consentat   timestamptz,   -- consentement explicite à la finalité personnalisation
  updatedat   timestamptz NOT NULL DEFAULT now()
);

-- Affinité marques : marques favorites déclarées par le user (set complet remplaçable).
CREATE TABLE IF NOT EXISTS "ComparatorBrandAffinity" (
  userid    text NOT NULL,
  brand     text NOT NULL,        -- marque normalisée (minuscule, trim)
  createdat timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (userid, brand)
);
CREATE INDEX IF NOT EXISTS idx_comparatorbrandaffinity_userid ON "ComparatorBrandAffinity" (userid);
CREATE INDEX IF NOT EXISTS idx_comparatorbrandaffinity_brand  ON "ComparatorBrandAffinity" (brand);

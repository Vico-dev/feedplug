-- Taxonomie MAISON du comparateur (10 catégories top-level) + classement des produits.
-- Les catégories AWIN (bruitées) servent de signal, pas de référentiel exposé. Idempotent.

CREATE TABLE IF NOT EXISTS "ComparatorCategory" (
  id       text PRIMARY KEY,           -- slug stable
  slug     text NOT NULL,
  labelfr  text NOT NULL,
  labelen  text,
  icon     text,                        -- nom d'icône lucide-react pour le front
  position smallint NOT NULL DEFAULT 0,
  active   boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparatorcategory_slug ON "ComparatorCategory" (slug);

INSERT INTO "ComparatorCategory" (id, slug, labelfr, labelen, icon, position) VALUES
  ('informatique',   'informatique',   'Informatique',      'Computing',      'Laptop',         1),
  ('telephonie',     'telephonie',     'Téléphonie',        'Phones',         'Smartphone',     2),
  ('tv-son',         'tv-son',         'TV & Son',          'TV & Audio',     'Tv',             3),
  ('electromenager', 'electromenager', 'Électroménager',    'Appliances',     'WashingMachine', 4),
  ('jeux-video',     'jeux-video',     'Jeux vidéo',        'Video games',    'Gamepad2',       5),
  ('maison-deco',    'maison-deco',    'Maison & Déco',     'Home & Deco',    'Sofa',           6),
  ('mode',           'mode',           'Mode',              'Fashion',        'Shirt',          7),
  ('beaute-parfums', 'beaute-parfums', 'Beauté & Parfums',  'Beauty',         'Sparkles',       8),
  ('sport',          'sport',          'Sport',             'Sport',          'Dumbbell',       9),
  ('jouets',         'jouets',         'Jouets & Enfants',  'Toys & Kids',    'ToyBrick',      10)
ON CONFLICT (id) DO NOTHING;

-- Catégorie principale d'un produit (1 par produit en v1).
CREATE TABLE IF NOT EXISTS "ProductGroupCategory" (
  groupid    text PRIMARY KEY,
  categoryid text NOT NULL,
  confidence smallint NOT NULL DEFAULT 50,   -- awin_map=80, keyword=50
  source     text NOT NULL DEFAULT 'keyword',
  updatedat  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_productgroupcategory_categoryid ON "ProductGroupCategory" (categoryid);

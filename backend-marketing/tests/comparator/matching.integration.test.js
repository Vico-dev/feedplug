'use strict';

/**
 * tests/comparator/matching.integration.test.js
 * ------------------------------------------------------------------
 * Tests d'INTÉGRATION DB du matching produit du comparateur CSS (revue Phase 2).
 *
 * Couvre la cascade de réconciliation (GTIN -> MPN+marque -> fuzzy titre -> seed)
 * et surtout la régression bloquante : un même produit (même GTIN) vendu dans
 * plusieurs pays doit donner UN SEUL ProductGroup mais DES PRIX PAR PAYS
 * (ProductGroupCountryPrice), sans jamais mélanger les devises (EUR vs GBP).
 *
 * --- Exécution ---
 *   - SANS base configurée : tous les cas sont `skip` (npm test reste vert).
 *   - AVEC base : exporter COMPARATOR_TEST_DATABASE_URL (ou TEST_DATABASE_URL)
 *     vers une base Postgres où les migrations 040/046/047/050 sont appliquées
 *     (extension pg_trgm requise), puis :
 *         node --test tests/comparator/matching.integration.test.js
 *
 * Isolation : chaque exécution seede sous un accountid unique
 * (`comparator-test-<runId>`) et nettoie TOUT à la fin (after). On ne touche
 * jamais aux autres comptes. PrismaClient n'est instancié qu'à l'intérieur des
 * tests/hooks, jamais au top-level (l'import du fichier ne doit pas planter).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  reconcileFeed,
  reconcileItem,
} = require('../../domains/comparator/matching');
const {
  snapshotGroupPrices,
  getPriceSignals,
} = require('../../domains/comparator/price-history');

// ------------------------------------------------------------------
// Garde de configuration : sans base de test, on skip proprement.
// ------------------------------------------------------------------
const DB_URL =
  process.env.COMPARATOR_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL || null;
const NO_DB = !DB_URL;

// Identifiant de run unique : isole ce passage des données d'autres runs/comptes.
const RUN_ID = crypto.randomUUID().slice(0, 8);
const ACCOUNT_ID = `comparator-test-${RUN_ID}`;

// PrismaClient partagé entre les tests d'un même fichier (instancié à la 1re utilisation).
let prisma = null;

function getPrisma() {
  if (!prisma) {
    // Require LOCAL : ne s'exécute que quand une base est configurée.
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  }
  return prisma;
}

const now = () => new Date().toISOString();

/** Crée le compte de test (idempotent). */
async function seedAccount(p) {
  await p.$executeRawUnsafe(
    `INSERT INTO "Account" (id, name, plan, createdat, updatedat)
     VALUES ($1::text, $2::text, 'STARTER', $3::timestamptz, $3::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    ACCOUNT_ID,
    `Comparateur Test ${RUN_ID}`,
    now()
  );
}

/** Crée une FeedSource avec un countrycode donné. */
async function seedSource(p, { id, name, countryCode }) {
  await p.$executeRawUnsafe(
    `INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, countrycode, accountid, createdat, updatedat)
     VALUES ($1::text, $2::text, 'CSV', '{}'::jsonb, 'DAILY', 'ACTIVE', $3::text, $4::text, $5::timestamptz, $5::timestamptz)`,
    id,
    name,
    countryCode,
    ACCOUNT_ID,
    now()
  );
}

/** Crée un Feed rattaché à une source. */
async function seedFeed(p, { id, name, sourceId }) {
  await p.$executeRawUnsafe(
    `INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, accountid, createdat, updatedat)
     VALUES ($1::text, $2::text, $3::text, 'DAILY', 'ACTIVE', '{}'::jsonb, 'guid_or_url', $4::text, $5::timestamptz, $5::timestamptz)`,
    id,
    name,
    sourceId,
    ACCOUNT_ID,
    now()
  );
}

/**
 * Insère une offre (FeedItem). `price`/`gtin`/`mpn`/`brand`/`currency` optionnels.
 * Renvoie l'id de l'offre.
 */
async function seedItem(p, feedId, item) {
  const id = item.id || crypto.randomUUID();
  const originId = item.originId || id;
  const contentHash = crypto.randomUUID();
  await p.$executeRawUnsafe(
    `INSERT INTO "FeedItem"
       (id, feedid, originid, title, brand, gtin, mpn, imageurl, price, currency, contenthash, createdat, updatedat)
     VALUES
       ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::double precision, $10::text, $11::text, $12::timestamptz, $12::timestamptz)`,
    id,
    feedId,
    originId,
    item.title,
    item.brand ?? null,
    item.gtin ?? null,
    item.mpn ?? null,
    item.imageUrl ?? null,
    item.price ?? null,
    item.currency ?? null,
    contentHash,
    now()
  );
  return id;
}

/** Supprime toutes les données seedées par ce run (ordre FK-safe). */
async function cleanup(p) {
  // Les FeedItem référencent ProductGroup (SET NULL) et Feed ; on les supprime d'abord.
  await p.$executeRawUnsafe(
    `DELETE FROM "FeedItem" WHERE feedid IN (SELECT id FROM "Feed" WHERE accountid = $1::text)`,
    ACCOUNT_ID
  );
  await p.$executeRawUnsafe(
    `DELETE FROM "ProductGroupCountryPrice" WHERE groupid IN (SELECT id FROM "ProductGroup" WHERE accountid = $1::text)`,
    ACCOUNT_ID
  );
  await p.$executeRawUnsafe(
    `DELETE FROM "ProductGroupPriceHistory" WHERE groupid IN (SELECT id FROM "ProductGroup" WHERE accountid = $1::text)`,
    ACCOUNT_ID
  );
  await p.$executeRawUnsafe(`DELETE FROM "ProductGroup" WHERE accountid = $1::text`, ACCOUNT_ID);
  await p.$executeRawUnsafe(`DELETE FROM "Feed" WHERE accountid = $1::text`, ACCOUNT_ID);
  await p.$executeRawUnsafe(`DELETE FROM "FeedSource" WHERE accountid = $1::text`, ACCOUNT_ID);
  await p.$executeRawUnsafe(`DELETE FROM "Account" WHERE id = $1::text`, ACCOUNT_ID);
}

/** Lit les lignes de prix par pays d'un groupe, ordonnées par pays. */
async function countryPrices(p, groupId) {
  return p.$queryRawUnsafe(
    `SELECT countrycode, lowestprice, currency, offercount
     FROM "ProductGroupCountryPrice"
     WHERE groupid = $1::text
     ORDER BY countrycode ASC`,
    groupId
  );
}

/** Compte les ProductGroup du compte de test. */
async function groupCount(p) {
  const rows = await p.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "ProductGroup" WHERE accountid = $1::text`,
    ACCOUNT_ID
  );
  return rows[0].n;
}

// ------------------------------------------------------------------
// Hooks : préparer une base propre / nettoyer.
// ------------------------------------------------------------------
test.before(async () => {
  if (NO_DB) return;
  const p = getPrisma();
  await cleanup(p); // au cas où un run précédent aurait laissé des restes
  await seedAccount(p);
});

test.after(async () => {
  if (!prisma) return;
  try {
    await cleanup(prisma);
  } finally {
    await prisma.$disconnect();
  }
});

// Options communes : skip propre quand aucune base n'est configurée.
const SKIP = { skip: NO_DB ? 'COMPARATOR_TEST_DATABASE_URL/TEST_DATABASE_URL non configurée' : false };

// ------------------------------------------------------------------
// CAS 1 — Régression bloquante : même GTIN FR/GB -> 1 groupe, 2 prix/pays.
// ------------------------------------------------------------------
test('Cas 1 — même GTIN vendu FR (EUR) et GB (GBP) : un seul groupe, deux prix par pays sans mélange de devise', SKIP, async () => {
  const p = getPrisma();
  const gtin = '5452000099991';

  const srcFr = `src-fr-${RUN_ID}`;
  const srcGb = `src-gb-${RUN_ID}`;
  const feedFr = `feed-fr-${RUN_ID}`;
  const feedGb = `feed-gb-${RUN_ID}`;
  await seedSource(p, { id: srcFr, name: 'Source FR', countryCode: 'FR' });
  await seedSource(p, { id: srcGb, name: 'Source GB', countryCode: 'GB' });
  await seedFeed(p, { id: feedFr, name: 'Feed FR', sourceId: srcFr });
  await seedFeed(p, { id: feedGb, name: 'Feed GB', sourceId: srcGb });

  await seedItem(p, feedFr, { title: 'Casque Audio X', brand: 'Acme', gtin, price: 99.9, currency: 'EUR' });
  await seedItem(p, feedGb, { title: 'Headphones X', brand: 'Acme', gtin, price: 79.5, currency: 'GBP' });

  await reconcileFeed(p, feedFr, ACCOUNT_ID);
  await reconcileFeed(p, feedGb, ACCOUNT_ID);

  // Un seul ProductGroup pour ce GTIN (matching GTIN fusionne les deux pays).
  const groups = await p.$queryRawUnsafe(
    `SELECT id FROM "ProductGroup" WHERE accountid = $1::text AND gtin = $2::text`,
    ACCOUNT_ID,
    '05452000099991' // GTIN normalisé en GTIN-14
  );
  assert.equal(groups.length, 1, 'un seul groupe pour le même GTIN');
  const groupId = groups[0].id;

  // Deux lignes de prix par pays, devises NON mélangées.
  const prices = await countryPrices(p, groupId);
  assert.equal(prices.length, 2, 'deux lignes ProductGroupCountryPrice (FR + GB)');

  const fr = prices.find((r) => r.countrycode === 'FR');
  const gb = prices.find((r) => r.countrycode === 'GB');
  assert.ok(fr && gb, 'lignes FR et GB présentes');
  assert.equal(Number(fr.lowestprice), 99.9);
  assert.equal(fr.currency, 'EUR', 'FR garde EUR (pas de fuite GBP)');
  assert.equal(Number(gb.lowestprice), 79.5);
  assert.equal(gb.currency, 'GBP', 'GB garde GBP (pas de fuite EUR)');
});

// ------------------------------------------------------------------
// CAS 2 — Idempotence : réexécuter ne double pas les offercounts.
// ------------------------------------------------------------------
test('Cas 2 — reconcileFeed deux fois : mêmes groupes, offercount par pays stable', SKIP, async () => {
  const p = getPrisma();
  const gtin = '4006381333931';

  const src = `src-idem-${RUN_ID}`;
  const feed = `feed-idem-${RUN_ID}`;
  await seedSource(p, { id: src, name: 'Source FR idem', countryCode: 'FR' });
  await seedFeed(p, { id: feed, name: 'Feed idem', sourceId: src });
  await seedItem(p, feed, { title: 'Souris Sans Fil', brand: 'Logi', gtin, price: 25.0, currency: 'EUR' });

  await reconcileFeed(p, feed, ACCOUNT_ID);

  const g1 = await p.$queryRawUnsafe(
    `SELECT groupid FROM "FeedItem" WHERE feedid = $1::text`,
    feed
  );
  const groupId1 = g1[0].groupid;
  assert.ok(groupId1);
  const prices1 = await countryPrices(p, groupId1);
  assert.equal(prices1.length, 1);
  assert.equal(prices1[0].offercount, 1, 'une offre comptée après le 1er passage');

  // 2e passage : doit être idempotent (UPSERT, pas d'accumulation).
  await reconcileFeed(p, feed, ACCOUNT_ID);

  const g2 = await p.$queryRawUnsafe(
    `SELECT groupid FROM "FeedItem" WHERE feedid = $1::text`,
    feed
  );
  assert.equal(g2[0].groupid, groupId1, 'même groupid après réexécution');

  const prices2 = await countryPrices(p, groupId1);
  assert.equal(prices2.length, 1, 'toujours une seule ligne pays');
  assert.equal(prices2[0].offercount, 1, 'offercount stable (non doublé)');
});

// ------------------------------------------------------------------
// CAS 3 — Filtre price > 0 : une offre à 0 ne fixe pas lowestprice à 0.
// ------------------------------------------------------------------
test('Cas 3 — une offre price=0 est ignorée pour le prix mini (pas de lowestprice à 0)', SKIP, async () => {
  const p = getPrisma();
  const gtin = '0888462079525';

  const src = `src-zero-${RUN_ID}`;
  const feed = `feed-zero-${RUN_ID}`;
  await seedSource(p, { id: src, name: 'Source FR zero', countryCode: 'FR' });
  await seedFeed(p, { id: feed, name: 'Feed zero', sourceId: src });

  // Deux offres du même produit : une valide à 49.99, une « épuisée » à 0.
  await seedItem(p, feed, { title: 'Clavier Méca', brand: 'Keyz', gtin, price: 49.99, currency: 'EUR' });
  await seedItem(p, feed, { title: 'Clavier Méca', brand: 'Keyz', gtin, price: 0, currency: 'EUR' });

  await reconcileFeed(p, feed, ACCOUNT_ID);

  const groups = await p.$queryRawUnsafe(
    `SELECT id FROM "ProductGroup" WHERE accountid = $1::text AND gtin = $2::text`,
    ACCOUNT_ID,
    '00888462079525'
  );
  assert.equal(groups.length, 1);
  const prices = await countryPrices(p, groups[0].id);
  assert.equal(prices.length, 1);
  assert.equal(Number(prices[0].lowestprice), 49.99, 'lowestprice = offre valide, pas 0');
  assert.equal(prices[0].offercount, 1, 'seule l’offre price>0 est comptée');
});

// ------------------------------------------------------------------
// CAS 4 — Fuzzy : deux titres proches (dont accents) -> même groupe.
// ------------------------------------------------------------------
test('Cas 4 — fuzzy titre : variantes avec/sans accents de la même marque convergent sur un groupe', SKIP, async () => {
  const p = getPrisma();

  const src = `src-fuzzy-${RUN_ID}`;
  const feed = `feed-fuzzy-${RUN_ID}`;
  await seedSource(p, { id: src, name: 'Source FR fuzzy', countryCode: 'FR' });
  await seedFeed(p, { id: feed, name: 'Feed fuzzy', sourceId: src });

  // Sans GTIN ni MPN -> on tombe sur le matching fuzzy par titre (gardé par marque).
  // Titres quasi identiques, l'un accentué : la normalisation symétrique (normtitle)
  // doit les rapprocher au-dessus du seuil de similarité.
  await seedItem(p, feed, { title: 'Cafetiere Expresso Automatique 1500W', brand: 'Brewly' });
  await seedItem(p, feed, { title: 'Cafetière Expresso Automatique 1500W', brand: 'Brewly' });

  await reconcileFeed(p, feed, ACCOUNT_ID);

  const rows = await p.$queryRawUnsafe(
    `SELECT groupid FROM "FeedItem" WHERE feedid = $1::text`,
    feed
  );
  assert.equal(rows.length, 2);
  assert.ok(rows[0].groupid && rows[1].groupid, 'les deux offres sont rattachées');
  assert.equal(rows[0].groupid, rows[1].groupid, 'même groupe malgré l’accent (normtitle symétrique)');

  // Un seul groupe créé côté ProductGroup pour ces deux offres.
  const grp = await p.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "ProductGroup"
     WHERE accountid = $1::text AND gtin IS NULL AND lower(brand) = 'brewly'`,
    ACCOUNT_ID
  );
  assert.equal(grp[0].n, 1, 'un seul groupe fuzzy pour la marque');
});

// ------------------------------------------------------------------
// CAS 5 — MPN + marque (sans GTIN) -> regroupement déterministe.
// ------------------------------------------------------------------
test('Cas 5 — MPN+marque sans GTIN : regroupement déterministe sur un même groupe', SKIP, async () => {
  const p = getPrisma();

  const src = `src-mpn-${RUN_ID}`;
  const feed = `feed-mpn-${RUN_ID}`;
  await seedSource(p, { id: src, name: 'Source FR mpn', countryCode: 'FR' });
  await seedFeed(p, { id: feed, name: 'Feed mpn', sourceId: src });

  // Même MPN + même marque, titres volontairement DIFFÉRENTS (pour exclure le fuzzy)
  // et sans GTIN -> seul le niveau MPN+marque peut les regrouper.
  await seedItem(p, feed, { title: 'Perceuse modele A bleu', brand: 'ToolCo', mpn: 'TC-PRC-77', price: 120, currency: 'EUR' });
  await seedItem(p, feed, { title: 'Visseuse pack pro noir', brand: 'ToolCo', mpn: 'TC-PRC-77', price: 110, currency: 'EUR' });

  await reconcileFeed(p, feed, ACCOUNT_ID);

  const rows = await p.$queryRawUnsafe(
    `SELECT groupid, matchstrategy FROM "FeedItem" WHERE feedid = $1::text ORDER BY price DESC`,
    feed
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].groupid, rows[1].groupid, 'même groupe via MPN+marque');
  // La 2e offre traitée doit être rattachée par la stratégie mpn_brand (la 1re est seed).
  const strategies = rows.map((r) => r.matchstrategy).sort();
  assert.ok(strategies.includes('mpn_brand'), 'au moins une offre rattachée par mpn_brand');
});

// ------------------------------------------------------------------
// CAS 6 — snapshotGroupPrices puis getPriceSignals : cohérent par pays.
// ------------------------------------------------------------------
test('Cas 6 — snapshot puis signaux : historique cohérent par pays', SKIP, async () => {
  const p = getPrisma();
  const gtin = '7613034626844';

  const srcFr = `src-snap-fr-${RUN_ID}`;
  const srcGb = `src-snap-gb-${RUN_ID}`;
  const feedFr = `feed-snap-fr-${RUN_ID}`;
  const feedGb = `feed-snap-gb-${RUN_ID}`;
  await seedSource(p, { id: srcFr, name: 'Snap FR', countryCode: 'FR' });
  await seedSource(p, { id: srcGb, name: 'Snap GB', countryCode: 'GB' });
  await seedFeed(p, { id: feedFr, name: 'Feed snap FR', sourceId: srcFr });
  await seedFeed(p, { id: feedGb, name: 'Feed snap GB', sourceId: srcGb });

  await seedItem(p, feedFr, { title: 'Montre Connectee', brand: 'Timez', gtin, price: 199.0, currency: 'EUR' });
  await seedItem(p, feedGb, { title: 'Smart Watch', brand: 'Timez', gtin, price: 149.0, currency: 'GBP' });

  await reconcileFeed(p, feedFr, ACCOUNT_ID);
  await reconcileFeed(p, feedGb, ACCOUNT_ID);

  const groups = await p.$queryRawUnsafe(
    `SELECT id FROM "ProductGroup" WHERE accountid = $1::text AND gtin = $2::text`,
    ACCOUNT_ID,
    '07613034626844'
  );
  assert.equal(groups.length, 1);
  const groupId = groups[0].id;

  // Fige les prix du jour, puis lit les signaux par pays.
  const snap = await snapshotGroupPrices(p, ACCOUNT_ID);
  assert.ok(snap.rows >= 2, 'au moins deux lignes d’historique figées (FR + GB)');

  const sigFr = await getPriceSignals(p, groupId, 'FR');
  const sigGb = await getPriceSignals(p, groupId, 'GB');
  assert.ok(sigFr, 'signaux FR présents');
  assert.ok(sigGb, 'signaux GB présents');
  assert.equal(sigFr.current, 199.0, 'prix courant FR cohérent');
  assert.equal(sigGb.current, 149.0, 'prix courant GB cohérent');
  // Avec un seul point, on est forcément « au plus bas ».
  assert.equal(sigFr.isAtLowest, true);
  assert.equal(sigGb.isAtLowest, true);
});

// ------------------------------------------------------------------
// CAS 7 (bonus) — reconcileItem direct : seed quand aucun identifiant.
// ------------------------------------------------------------------
test('Cas 7 — reconcileItem crée un groupe seed (confiance 100) quand aucun identifiant ne matche', SKIP, async () => {
  const p = getPrisma();

  const src = `src-seed-${RUN_ID}`;
  const feed = `feed-seed-${RUN_ID}`;
  await seedSource(p, { id: src, name: 'Source FR seed', countryCode: 'FR' });
  await seedFeed(p, { id: feed, name: 'Feed seed', sourceId: src });

  const before = await groupCount(p);
  const itemId = await seedItem(p, feed, { title: 'Produit Unique Sans Identifiant ABCXYZ', price: 12.34, currency: 'EUR' });

  const groupId = await reconcileItem(p, ACCOUNT_ID, {
    id: itemId,
    originid: itemId,
    title: 'Produit Unique Sans Identifiant ABCXYZ',
    brand: null,
    gtin: null,
    mpn: null,
    imageurl: null,
    price: 12.34,
    currency: 'EUR',
  });

  assert.ok(groupId, 'un groupe seed est retourné');
  const after = await groupCount(p);
  assert.equal(after, before + 1, 'exactement un nouveau groupe créé');

  const row = await p.$queryRawUnsafe(
    `SELECT matchstrategy, matchconfidence FROM "FeedItem" WHERE id = $1::text`,
    itemId
  );
  assert.equal(row[0].matchstrategy, 'seed');
  assert.equal(row[0].matchconfidence, 100);
});

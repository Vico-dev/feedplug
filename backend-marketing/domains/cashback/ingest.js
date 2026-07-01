'use strict';
// Rapprochement conversion AWIN → utilisateur via clickref, puis écriture dans le ledger.
const crypto = require('crypto');

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** AWIN renvoie commissionAmount/saleAmount soit en nombre, soit en objet {amount,currency}. */
function amount(x) {
  if (x && typeof x === 'object') return Number(x.amount) || 0;
  return Number(x) || 0;
}
function currencyOf(tx) {
  return (tx.commissionAmount && tx.commissionAmount.currency)
    || (tx.saleAmount && tx.saleAmount.currency)
    || tx.currency || null;
}

/** Part de commission reversée à l'utilisateur (cashback). share ∈ [0,1]. */
function computeCashback(commission, share) {
  const s = (typeof share === 'number' && share >= 0 && share <= 1) ? share : 0.5;
  return round2(amount(commission) * s);
}

/** Statut AWIN brut → statut ledger interne. */
function mapAwinStatus(awinStatus) {
  const s = String(awinStatus || '').toLowerCase();
  if (s === 'approved') return 'validated';
  if (s === 'declined' || s === 'rejected') return 'rejected';
  return 'pending';
}

function clickrefOf(tx) {
  return tx.clickRef || tx.clickref || tx.clickRefs || null;
}

/**
 * Pour chaque transaction AWIN : retrouve le ClickEvent par clickref → userid,
 * et upsert un CashbackTransaction (idempotent sur awintransactionid).
 * Les clics anonymes (userid NULL) ou inconnus sont ignorés (skipped).
 * Retourne { total, matched, credited, skipped }.
 */
async function ingestTransactions(prisma, transactions, { share = 0.5 } = {}) {
  let matched = 0, credited = 0, skipped = 0;
  const list = Array.isArray(transactions) ? transactions : [];
  for (const tx of list) {
    const clickref = clickrefOf(tx);
    if (!clickref || tx.id == null) { skipped++; continue; }
    const ce = await prisma.$queryRawUnsafe(
      `SELECT id, userid, merchantname FROM "ClickEvent" WHERE clickref = $1::text LIMIT 1`,
      String(clickref),
    );
    const row = ce && ce[0];
    if (!row || !row.userid) { skipped++; continue; } // clic inconnu ou anonyme → pas de cashback
    matched++;

    const status = mapAwinStatus(tx.commissionStatus);
    const cashback = computeCashback(tx.commissionAmount, share);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CashbackTransaction"
         (id, userid, clickeventid, awintransactionid, advertiserid, merchantname, saleamount, commissionamount, cashbackamount, currency, status, awinstatus, clickref, occurredat, validatedat, createdat, updatedat)
       VALUES ($1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::double precision,$8::double precision,$9::double precision,$10::text,$11::text,$12::text,$13::text,$14::timestamptz,$15::timestamptz, now(), now())
       ON CONFLICT (awintransactionid) DO UPDATE SET
         status = EXCLUDED.status, awinstatus = EXCLUDED.awinstatus,
         commissionamount = EXCLUDED.commissionamount, cashbackamount = EXCLUDED.cashbackamount,
         validatedat = COALESCE(EXCLUDED.validatedat, "CashbackTransaction".validatedat), updatedat = now()`,
      crypto.randomUUID(), row.userid, row.id, String(tx.id),
      tx.advertiserId != null ? String(tx.advertiserId) : null,
      tx.advertiserName || row.merchantname || null,
      amount(tx.saleAmount), amount(tx.commissionAmount), cashback, currencyOf(tx),
      status, tx.commissionStatus || null, String(clickref),
      tx.transactionDate || null,
      status === 'validated' ? (tx.validationDate || tx.transactionDate || null) : null,
    );
    credited++;
  }
  return { total: list.length, matched, credited, skipped };
}

module.exports = { round2, amount, currencyOf, computeCashback, mapAwinStatus, clickrefOf, ingestTransactions };

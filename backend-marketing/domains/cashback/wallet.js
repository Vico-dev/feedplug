'use strict';
// Wallet conso = agrégat du ledger CashbackTransaction par statut.
//  - pending   : conversions non encore validées par AWIN (en attente, ~30-90 j)
//  - available : validées/payables → retirables (en bon d'achat v1)
//  - paid      : déjà versées (voucher émis)

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** rows: [{ status, total, n }] → { pending, available, paid, lifetime, currency }. Pur (testable). */
function summarize(rows) {
  let pending = 0, available = 0, paid = 0;
  for (const r of rows || []) {
    const t = Number(r.total) || 0;
    if (r.status === 'pending') pending += t;
    else if (r.status === 'validated' || r.status === 'payable') available += t;
    else if (r.status === 'paid') paid += t;
    // 'rejected' : ignoré (retours/annulations).
  }
  return {
    pending: round2(pending),
    available: round2(available),
    paid: round2(paid),
    lifetime: round2(available + paid),
    currency: 'EUR',
  };
}

async function getWallet(prisma, userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT status, COALESCE(SUM(cashbackamount), 0)::float AS total, count(*)::int AS n
     FROM "CashbackTransaction" WHERE userid = $1::text GROUP BY status`,
    userId,
  );
  return summarize(rows);
}

async function listTransactions(prisma, userId, limit = 50) {
  return prisma.$queryRawUnsafe(
    `SELECT id, merchantname, cashbackamount, currency, status, occurredat, createdat
     FROM "CashbackTransaction" WHERE userid = $1::text ORDER BY createdat DESC LIMIT $2::int`,
    userId, Math.min(Number(limit) || 50, 100),
  );
}

module.exports = { round2, summarize, getWallet, listTransactions };

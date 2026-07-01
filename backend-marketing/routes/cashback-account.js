'use strict';
// Endpoint conso du wallet cashback (authentifié par cookie cmp_session via requireComparatorAuth).
// Logique pure dans domains/cashback/wallet.js ; ici uniquement le HTTP.
const { getWallet, listTransactions } = require('../domains/cashback/wallet');

function registerCashbackAccountRoutes(app, { getPrisma, getPrismaReady, requireComparatorAuth }) {
  app.get('/api/v1/comparator/account/cashback', requireComparatorAuth, async (req, res) => {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    try {
      const userId = req.comparatorUser.id;
      const [wallet, transactions] = await Promise.all([
        getWallet(prisma, userId),
        listTransactions(prisma, userId, 50),
      ]);
      const payoutThreshold = Number(process.env.CASHBACK_PAYOUT_THRESHOLD) || 10;
      return res.json({
        wallet,
        transactions,
        payoutThreshold,
        payoutAvailable: wallet.available >= payoutThreshold,
      });
    } catch (e) {
      console.error('[cashback] wallet error:', e.message);
      return res.status(500).json({ message: 'Erreur' });
    }
  });
}

module.exports = { registerCashbackAccountRoutes };

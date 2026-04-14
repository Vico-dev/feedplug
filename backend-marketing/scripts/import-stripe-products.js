#!/usr/bin/env node
/**
 * Script d'import massif des produits/tarifs FeedPlug dans Stripe.
 * Usage: node scripts/import-stripe-products.js
 * 
 * Prérequis: STRIPE_SECRET_KEY dans l'environnement
 */

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCT_TIERS = [100, 500, 1000, 2500, 10000, 50000];
const CHANNEL_OPTIONS = [1, 2, 3, 4, 5];
const ADDON_IA_PRICE_EUR = 49;

const PRICING_GRID_EUR = {
  100: { 1: 39, 2: 49, 3: 59, 4: 69, 5: 79 },
  500: { 1: 79, 2: 99, 3: 119, 4: 139, 5: 159 },
  1000: { 1: 129, 2: 159, 3: 189, 4: 219, 5: 249 },
  2500: { 1: 199, 2: 249, 3: 299, 4: 349, 5: 399 },
  10000: { 1: 299, 2: 369, 3: 439, 4: 509, 5: 579 },
  50000: { 1: 449, 2: 549, 3: 649, 4: 749, 5: 849 },
};

async function createProduct(name, description) {
  const product = await stripe.products.create({
    name,
    description,
    metadata: { feedplug: 'true' }
  });
  return product;
}

async function createPrice(productId, nickname, amountEur, interval, metadata = {}) {
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(amountEur * 100),
    currency: 'eur',
    recurring: { interval },
    nickname,
    metadata: { feedplug: 'true', ...metadata }
  });
  return price;
}

async function importAll() {
  console.log('🎯 Import massif des produits FeedPlug dans Stripe\n');

  // 1. Créer le produit principal
  console.log('📦 Création du produit principal...');
  const mainProduct = await createProduct(
    'FeedPlug - Plan Configurable',
    'Plan avec nombre de produits et canaux configurables. Inclut toutes les fonctionnalités FeedPlug.'
  );
  console.log(`   ✅ Produit créé: ${mainProduct.id}\n`);

  const results = [];

  // 2. Créer tous les prix mensuels
  console.log('💰 Création des prix mensuels...\n');

  for (const tier of PRODUCT_TIERS) {
    for (const channels of CHANNEL_OPTIONS) {
      const basePrice = PRICING_GRID_EUR[tier][channels];
      
      // Prix sans IA
      const nickname = `${tier} produits - ${channels} canal${channels > 1 ? 'x' : ''}`;
      const price = await createPrice(mainProduct.id, nickname, basePrice, 'month', {
        tier: String(tier),
        channels: String(channels),
        addonIA: 'false'
      });
      results.push({ tier, channels, addonIA: false, priceId: price.id, amount: basePrice });
      console.log(`   ✅ ${nickname}: ${basePrice}€ → ${price.id}`);

      // Prix avec IA
      const priceWithAI = await createPrice(mainProduct.id, `${nickname} + IA`, basePrice + ADDON_IA_PRICE_EUR, 'month', {
        tier: String(tier),
        channels: String(channels),
        addonIA: 'true'
      });
      results.push({ tier, channels, addonIA: true, priceId: priceWithAI.id, amount: basePrice + ADDON_IA_PRICE_EUR });
      console.log(`   ✅ ${nickname} + IA: ${basePrice + ADDON_IA_PRICE_EUR}€ → ${priceWithAI.id}`);
    }
  }

  // 3. Résumé
  console.log('\n📋 Résumé des Price IDs:\n');
  console.log('```');
  console.log('// Tier → Channel → (Price sans IA, Price avec IA)');
  
  for (const tier of PRODUCT_TIERS) {
    const prices = results.filter(r => r.tier === tier && !r.addonIA);
    const pricesWithIA = results.filter(r => r.tier === tier && r.addonIA);
    
    console.log(`\n// ${tier} produits`);
    for (const p of prices) {
      const withIA = pricesWithIA.find(pi => pi.channels === p.channels);
      console.log(`  ${p.channels} canal${p.channels > 1 ? 'x' : ''}: ${p.priceId} / ${withIA?.priceId}`);
    }
  }
  console.log('```');

  // 4. Sauvegarder dans un fichier
  const fs = require('fs');
  const output = {
    productId: mainProduct.id,
    prices: results,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync('stripe-prices.json', JSON.stringify(output, null, 2));
  console.log('\n💾 Résultats sauvegardés dans stripe-prices.json');

  console.log('\n✨ Import terminé !');
  console.log(`   Produit: ${mainProduct.id}`);
  console.log(`   Prix créés: ${results.length}`);
}

importAll().catch(err => {
  console.error('\n❌ Erreur:', err.message);
  process.exit(1);
});

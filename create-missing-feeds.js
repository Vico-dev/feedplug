// Script pour créer les flux manquants pour les sources existantes
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createMissingFeeds() {
  try {
    // Récupérer toutes les sources CSV sans flux
    const sourcesWithoutFeeds = await prisma.$queryRawUnsafe(`
      SELECT s.*
      FROM "FeedSource" s
      LEFT JOIN "Feed" f ON f.sourceid = s.id
      WHERE s.connector = 'CSV' AND f.id IS NULL
    `);

    console.log(`📋 ${sourcesWithoutFeeds.length} sources sans flux trouvées`);

    for (const source of sourcesWithoutFeeds) {
      try {
        const feedId = crypto.randomUUID();
        const now = new Date().toISOString();
        const sourceConfig = source.configjson || source.configJson || {};
        
        if (!sourceConfig.csvUrl && !sourceConfig.csvurl) {
          console.warn(`⚠️  Source ${source.name} (${source.id}) n'a pas de csvUrl`);
          continue;
        }

        // Mapping par défaut pour CSV
        const defaultMapping = {
          title: 'title',
          sku: 'sku',
          price: 'price',
          url: 'url',
          imageUrl: 'image',
          brand: 'brand',
          description: 'description',
          inventory: 'stock'
        };

        await prisma.$executeRaw`
          INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat)
          VALUES (
            ${feedId}::text,
            ${`Flux principal - ${source.name}`}::text,
            ${source.id}::text,
            ${source.defaultfreq || 'DAILY'}::text,
            'ACTIVE'::text,
            ${JSON.stringify(defaultMapping)}::jsonb,
            'guid_or_url'::text,
            ${now}::timestamptz,
            ${now}::timestamptz
          )
        `;

        console.log(`✅ Flux créé pour la source ${source.name} (${source.id})`);
      } catch (error) {
        console.error(`❌ Erreur pour la source ${source.name}:`, error.message);
      }
    }

    console.log('✅ Terminé !');
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMissingFeeds();


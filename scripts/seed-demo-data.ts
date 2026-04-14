import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding des données de démonstration...');

  // Nettoyer les données existantes
  await prisma.importRun.deleteMany();
  await prisma.import.deleteMany();
  await prisma.export.deleteMany();
  await prisma.product.deleteMany();
  await prisma.mapping.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();

  // Créer un compte de démonstration
  const demoAccount = await prisma.account.create({
    data: {
      name: 'Demo E-commerce',
      slug: 'demo-ecommerce',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL',
      settings: {
        timezone: 'Europe/Paris',
        currency: 'EUR',
        language: 'fr'
      }
    }
  });

  console.log('✅ Compte de démonstration créé:', demoAccount.name);

  // Créer des utilisateurs de démonstration
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Demo',
      role: 'OWNER',
      accountId: demoAccount.id,
      status: 'ACTIVE'
    }
  });

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@demo.com',
      password: hashedPassword,
      firstName: 'Manager',
      lastName: 'Demo',
      role: 'MANAGER',
      accountId: demoAccount.id,
      status: 'ACTIVE'
    }
  });

  console.log('✅ Utilisateurs de démonstration créés');

  // Créer des imports de démonstration
  const shopifyImport = await prisma.import.create({
    data: {
      name: 'Catalogue Shopify Principal',
      description: 'Import automatique du catalogue produits depuis Shopify',
      type: 'API',
      flowType: 'PRIMARY',
      source: 'https://demo-shop.myshopify.com',
      status: 'COMPLETED',
      schedule: 'daily',
      config: {
        platform: 'shopify',
        apiKey: 'shpat_***',
        shopDomain: 'demo-shop.myshopify.com',
        syncProducts: true,
        syncVariants: true,
        syncImages: true
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    }
  });

  const csvImport = await prisma.import.create({
    data: {
      name: 'Import CSV Produits',
      description: 'Import manuel via fichier CSV',
      type: 'MANUAL',
      flowType: 'PRIMARY',
      source: 'catalogue-produits.csv',
      status: 'COMPLETED',
      schedule: 'manual',
      config: {
        separator: ';',
        encoding: 'UTF-8',
        hasHeaders: true,
        columns: {
          id: 'ID',
          name: 'Nom',
          description: 'Description',
          price: 'Prix',
          category: 'Catégorie',
          brand: 'Marque',
          stock: 'Stock'
        }
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    }
  });

  const reviewsImport = await prisma.import.create({
    data: {
      name: 'Enrichissement Avis Clients',
      description: 'Import des avis clients depuis Trustpilot',
      type: 'API',
      flowType: 'SECONDARY',
      source: 'https://api.trustpilot.com',
      status: 'COMPLETED',
      schedule: 'weekly',
      priority: 2,
      config: {
        platform: 'trustpilot',
        apiKey: 'tp_***',
        syncReviews: true,
        minRating: 3,
        maxReviews: 100
      },
      accountId: demoAccount.id,
      userId: managerUser.id
    }
  });

  console.log('✅ Imports de démonstration créés');

  // Créer des produits de démonstration
  const products = [
    {
      sourceProductId: 'IPH15PM-256-BLK',
      data: {
        name: 'iPhone 15 Pro Max',
        description: 'Le dernier iPhone avec écran Super Retina XDR de 6,7 pouces',
        price: 1299.99,
        category: 'Smartphones',
        brand: 'Apple',
        sku: 'IPH15PM-256-BLK',
        stock: 45,
        status: 'ACTIVE',
        color: 'Noir',
        storage: '256GB',
        screen: '6.7"',
        camera: '48MP',
        battery: '4422mAh',
        weight: '221g',
        dimensions: '159.9 x 76.7 x 8.25 mm'
      }
    },
    {
      sourceProductId: 'MBA-M3-256-SLV',
      data: {
        name: 'MacBook Air M3',
        description: 'Ordinateur portable ultra-fin avec puce M3',
        price: 1299.99,
        category: 'Ordinateurs',
        brand: 'Apple',
        sku: 'MBA-M3-256-SLV',
        stock: 23,
        status: 'ACTIVE',
        color: 'Argent',
        storage: '256GB',
        ram: '8GB',
        screen: '13.6"',
        processor: 'M3',
        battery: '18h',
        weight: '1.24kg'
      }
    },
    {
      sourceProductId: 'APP2-WHT',
      data: {
        name: 'AirPods Pro 2',
        description: 'Écouteurs sans fil avec réduction de bruit active',
        price: 279.99,
        category: 'Audio',
        brand: 'Apple',
        sku: 'APP2-WHT',
        stock: 67,
        status: 'ACTIVE',
        color: 'Blanc',
        battery: '6h + 24h (étui)',
        connectivity: 'Bluetooth 5.3',
        features: ['Réduction de bruit', 'Transparence adaptative', 'Audio spatial'],
        weight: '5.3g'
      }
    },
    {
      sourceProductId: 'SGS24U-512-BLK',
      data: {
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Smartphone Android premium avec S Pen',
        price: 1199.99,
        category: 'Smartphones',
        brand: 'Samsung',
        sku: 'SGS24U-512-BLK',
        stock: 31,
        status: 'ACTIVE',
        color: 'Noir Titanium',
        storage: '512GB',
        ram: '12GB',
        screen: '6.8"',
        camera: '200MP',
        battery: '5000mAh',
        features: ['S Pen', '5G', 'WiFi 7']
      }
    },
    {
      sourceProductId: 'WH1000XM5-BLK',
      data: {
        name: 'Sony WH-1000XM5',
        description: 'Casque audio avec réduction de bruit exceptionnelle',
        price: 399.99,
        category: 'Audio',
        brand: 'Sony',
        sku: 'WH1000XM5-BLK',
        stock: 18,
        status: 'ACTIVE',
        color: 'Noir',
        battery: '30h',
        connectivity: 'Bluetooth 5.2',
        features: ['Réduction de bruit', 'Hi-Res Audio', 'Charge rapide'],
        weight: '250g'
      }
    }
  ];

  const createdProducts = [];
  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        ...productData,
        accountId: demoAccount.id,
        importId: shopifyImport.id
      }
    });
    createdProducts.push(product);
  }

  console.log('✅ Produits de démonstration créés');

  // Créer des mappings de démonstration
  const mapping = await prisma.mapping.create({
    data: {
      name: 'Mapping Standard E-commerce',
      platform: 'GOOGLE',
      rules: {
        rules: [
          {
            source: 'title',
            target: 'name',
            transformation: 'trim'
          },
          {
            source: 'description',
            target: 'description',
            transformation: 'clean_html'
          },
          {
            source: 'price',
            target: 'price',
            transformation: 'format_currency',
            params: { currency: 'EUR' }
          },
          {
            source: 'category',
            target: 'category',
            transformation: 'normalize_category'
          }
        ],
        aiOptimization: {
          enabled: true,
          optimizeDescriptions: true,
          generateKeywords: true,
          improveImages: false
        }
      },
      accountId: demoAccount.id,
      userId: adminUser.id,
      importId: shopifyImport.id
    }
  });

  console.log('✅ Mapping de démonstration créé');

  // Créer des exports de démonstration
  const googleAdsExport = await prisma.export.create({
    data: {
      name: 'Google Ads - Campagnes Shopping',
      platform: 'GOOGLE',
      status: 'COMPLETED',
      schedule: 'daily',
      mappingId: mapping.id,
      config: {
        accountId: '123-456-7890',
        campaignType: 'SHOPPING',
        targetCountries: ['FR', 'BE', 'CH'],
        language: 'fr',
        currency: 'EUR',
        feedSettings: {
          includeVariants: true,
          includeImages: true,
          includeReviews: true,
          maxProducts: 10000
        }
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    }
  });

  const facebookExport = await prisma.export.create({
    data: {
      name: 'Meta - Catalogue Produits',
      platform: 'META',
      status: 'COMPLETED',
      schedule: 'daily',
      mappingId: mapping.id,
      config: {
        pixelId: '123456789',
        catalogId: '987654321',
        targetCountries: ['FR', 'BE', 'CH'],
        language: 'fr',
        currency: 'EUR',
        feedSettings: {
          includeVariants: true,
          includeImages: true,
          includeReviews: false,
          maxProducts: 5000
        }
      },
      accountId: demoAccount.id,
      userId: managerUser.id
    }
  });

  const amazonExport = await prisma.export.create({
    data: {
      name: 'Amazon - Marketplace FR',
      platform: 'AMAZON',
      status: 'COMPLETED',
      schedule: 'daily',
      mappingId: mapping.id,
      config: {
        marketplace: 'A13V1IB3VIYZZH',
        sellerId: 'A123456789',
        targetCountry: 'FR',
        language: 'fr',
        currency: 'EUR',
        feedSettings: {
          includeVariants: true,
          includeImages: true,
          includeReviews: false,
          maxProducts: 2000
        }
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    }
  });

  console.log('✅ Exports de démonstration créés');

  // Créer des runs d'import de démonstration
  const importRun = await prisma.importRun.create({
    data: {
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2h
      endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000), // 5min plus tard
      productsCreated: 5,
      productsUpdated: 0,
      productsFailed: 0,
      log: [
        {
          level: 'INFO',
          message: 'Début de l\'import depuis Shopify',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          level: 'INFO',
          message: '5 produits importés avec succès',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000)
        }
      ],
      importId: shopifyImport.id
    }
  });

  console.log('✅ Runs d\'import de démonstration créés');

  // Créer des logs de démonstration
  const logs = [
    {
      level: 'INFO',
      message: 'Import Shopify terminé avec succès',
      context: {
        importId: shopifyImport.id,
        productsCount: 5,
        duration: '5m 23s'
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    },
    {
      level: 'WARNING',
      message: 'Produit "iPhone 15 Pro Max" - Image manquante',
      context: {
        productId: createdProducts[0].id,
        sku: 'IPH15PM-256-BLK'
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    },
    {
      level: 'ERROR',
      message: 'Échec de l\'export vers Amazon - API rate limit',
      context: {
        exportId: amazonExport.id,
        platform: 'AMAZON',
        retryCount: 3
      },
      accountId: demoAccount.id,
      userId: managerUser.id
    },
    {
      level: 'SUCCESS',
      message: 'Export Google Ads terminé - 5 produits synchronisés',
      context: {
        exportId: googleAdsExport.id,
        platform: 'GOOGLE_ADS',
        productsCount: 5
      },
      accountId: demoAccount.id,
      userId: adminUser.id
    }
  ];

  for (const logData of logs) {
    await prisma.log.create({
      data: logData
    });
  }

  console.log('✅ Logs de démonstration créés');

  console.log('🎉 Seeding terminé avec succès !');
  console.log('\n📊 Résumé des données créées :');
  console.log(`- 1 compte : ${demoAccount.name}`);
  console.log(`- 2 utilisateurs : admin@demo.com, manager@demo.com`);
  console.log(`- 3 imports : Shopify, CSV, Avis clients`);
  console.log(`- 5 produits : iPhone, MacBook, AirPods, Galaxy, Sony`);
  console.log(`- 1 mapping : Standard E-commerce`);
  console.log(`- 3 exports : Google Ads, Meta, Amazon`);
  console.log(`- 1 run d'import : Shopify (5 produits)`);
  console.log(`- 4 logs : Info, Warning, Error, Success`);
  console.log('\n🔑 Identifiants de connexion :');
  console.log('Email: admin@demo.com | Mot de passe: password123');
  console.log('Email: manager@demo.com | Mot de passe: password123');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





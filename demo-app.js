const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes de démonstration
app.get('/', (req, res) => {
  res.json({
    message: '🚀 FeedPlug API - Démonstration',
    version: '1.0.0',
    description: 'Plateforme SaaS B2B pour la centralisation et l\'optimisation des flux produits',
    endpoints: {
      auth: '/api/v1/auth',
      accounts: '/api/v1/accounts',
      imports: '/api/v1/imports',
      products: '/api/v1/products',
      mappings: '/api/v1/mappings',
      feeds: '/api/v1/feeds',
      exports: '/api/v1/exports',
      billing: '/api/v1/billing',
      monitoring: '/api/v1/monitoring',
      docs: '/api/docs'
    }
  });
});

// Documentation API
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'FeedPlug API Documentation',
    version: '1.0.0',
    description: 'API pour la plateforme FeedPlug - Centralisation et optimisation des flux produits',
    tags: [
      {
        name: 'auth',
        description: 'Authentification et autorisation'
      },
      {
        name: 'accounts',
        description: 'Gestion des comptes clients'
      },
      {
        name: 'imports',
        description: 'Import des flux sources'
      },
      {
        name: 'mappings',
        description: 'Mapping et optimisation IA'
      },
      {
        name: 'products',
        description: 'Gestion des produits normalisés'
      },
      {
        name: 'feeds',
        description: 'Génération de flux (Feed Engine)'
      },
      {
        name: 'exports',
        description: 'Export vers les plateformes'
      },
      {
        name: 'billing',
        description: 'Facturation Pennylane'
      },
      {
        name: 'monitoring',
        description: 'Monitoring et logs'
      }
    ],
    endpoints: {
      'POST /api/v1/auth/register': {
        description: 'Créer un nouveau compte utilisateur',
        parameters: {
          email: 'string (required)',
          password: 'string (required, min 8 chars)',
          firstName: 'string (required)',
          lastName: 'string (required)',
          accountName: 'string (required)'
        }
      },
      'POST /api/v1/auth/login': {
        description: 'Connexion utilisateur',
        parameters: {
          email: 'string (required)',
          password: 'string (required)'
        }
      },
      'GET /api/v1/accounts': {
        description: 'Obtenir les informations du compte',
        auth: 'Bearer token required'
      },
      'POST /api/v1/imports': {
        description: 'Créer un nouvel import',
        auth: 'Bearer token required',
        parameters: {
          name: 'string (required)',
          type: 'URL|SFTP|API|MANUAL',
          source: 'string (required)',
          config: 'object (optional)',
          schedule: 'string (optional, cron format)'
        }
      },
      'POST /api/v1/mappings': {
        description: 'Créer un nouveau mapping',
        auth: 'Bearer token required',
        parameters: {
          name: 'string (required)',
          platform: 'GOOGLE|META|AMAZON|MIRAKL|CUSTOM',
          importId: 'string (required)',
          config: 'object (required)',
          aiOptimized: 'boolean (optional)'
        }
      },
      'POST /api/v1/exports': {
        description: 'Créer un nouvel export',
        auth: 'Bearer token required',
        parameters: {
          name: 'string (required)',
          platform: 'GOOGLE|META|AMAZON|MIRAKL|CUSTOM',
          mappingId: 'string (required)',
          config: 'object (required)',
          schedule: 'string (optional, cron format)'
        }
      },
      'GET /api/v1/billing': {
        description: 'Obtenir les informations de facturation',
        auth: 'Bearer token required'
      },
      'GET /api/v1/monitoring/health': {
        description: 'Vérifier la santé du système'
      }
    }
  });
});

// Routes de démonstration pour chaque module
app.get('/api/v1/auth/demo', (req, res) => {
  res.json({
    message: 'Module d\'authentification',
    features: [
      'Authentification JWT',
      'Gestion des rôles RBAC (Owner, Manager, Viewer, Agency)',
      'Refresh tokens avec Redis',
      'OAuth2 pour les connecteurs plateformes'
    ],
    demo: {
      user: {
        id: 'demo-user-id',
        email: 'demo@feedplug.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'OWNER',
        accountId: 'demo-account-id'
      },
      account: {
        id: 'demo-account-id',
        name: 'Demo Account',
        slug: 'demo-account',
        plan: 'PROFESSIONAL'
      },
      accessToken: 'demo-jwt-token',
      refreshToken: 'demo-refresh-token'
    }
  });
});

app.get('/api/v1/accounts/demo', (req, res) => {
  res.json({
    message: 'Module des comptes clients',
    features: [
      'Gestion multi-tenant',
      'CRUD utilisateurs et invitations',
      'Gestion des rôles et permissions',
      'Statistiques de compte'
    ],
    demo: {
      account: {
        id: 'demo-account-id',
        name: 'Demo Account',
        slug: 'demo-account',
        plan: 'PROFESSIONAL',
        status: 'ACTIVE',
        users: [
          {
            id: 'user-1',
            email: 'admin@demo.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'OWNER',
            status: 'ACTIVE'
          },
          {
            id: 'user-2',
            email: 'manager@demo.com',
            firstName: 'Manager',
            lastName: 'User',
            role: 'MANAGER',
            status: 'ACTIVE'
          }
        ],
        stats: {
          users: 2,
          imports: 5,
          exports: 3,
          mappings: 4,
          logs: 150
        }
      }
    }
  });
});

app.get('/api/v1/imports/demo', (req, res) => {
  res.json({
    message: 'Module d\'import des flux',
    features: [
      'Import depuis URL, SFTP, API',
      'Parsing CSV, JSON, XML',
      'Planification avec cron',
      'Gestion des erreurs et retry',
      'Jobs asynchrones via Pub/Sub'
    ],
    demo: {
      imports: [
        {
          id: 'import-1',
          name: 'Import Shopify',
          type: 'URL',
          source: 'https://demo-shop.myshopify.com/products.json',
          status: 'COMPLETED',
          lastRunAt: '2024-01-20T10:30:00Z',
          productsCount: 150,
          schedule: '0 2 * * *'
        },
        {
          id: 'import-2',
          name: 'Import WooCommerce',
          type: 'API',
          source: 'https://demo-store.com/wp-json/wc/v3/products',
          status: 'RUNNING',
          lastRunAt: '2024-01-20T11:00:00Z',
          productsCount: 89,
          schedule: '0 */6 * * *'
        }
      ]
    }
  });
});

app.get('/api/v1/products/demo', (req, res) => {
  res.json({
    message: 'Module de gestion des produits normalisés',
    features: [
      'Stockage des produits normalisés',
      'Calcul de score de qualité',
      'Enrichissement par IA',
      'Filtrage et recherche avancée',
      'Mise à jour en lot'
    ],
    demo: {
      products: [
        {
          id: 'product-1',
          sku: 'SKU-001',
          title: 'iPhone 15 Pro',
          description: 'Dernier iPhone avec puce A17 Pro',
          price: 1199.99,
          currency: 'EUR',
          imageLink: 'https://example.com/iphone15pro.jpg',
          availability: 'in stock',
          condition: 'new',
          brand: 'Apple',
          gtin: '1234567890123',
          category: 'Electronics',
          qualityScore: 95,
          isActive: true
        },
        {
          id: 'product-2',
          sku: 'SKU-002',
          title: 'Samsung Galaxy S24',
          description: 'Smartphone Android haut de gamme',
          price: 999.99,
          currency: 'EUR',
          imageLink: 'https://example.com/galaxy-s24.jpg',
          availability: 'in stock',
          condition: 'new',
          brand: 'Samsung',
          gtin: '9876543210987',
          category: 'Electronics',
          qualityScore: 92,
          isActive: true
        }
      ],
      stats: {
        total: 150,
        active: 145,
        inactive: 5,
        quality: {
          average: 87.5,
          min: 45,
          max: 98
        },
        categories: [
          { category: 'Electronics', count: 45 },
          { category: 'Clothing', count: 32 },
          { category: 'Home & Garden', count: 28 }
        ]
      }
    }
  });
});

app.get('/api/v1/feeds/demo', (req, res) => {
  res.json({
    message: 'Module de génération de flux (Feed Engine)',
    features: [
      'Génération de flux multi-plateformes',
      'Templates XML, CSV, JSON',
      'Mapping automatique par canal',
      'Stockage d\'artefacts',
      'Push API vers les plateformes'
    ],
    demo: {
      feeds: [
        {
          id: 'feed-1',
          name: 'Feed Google Shopping',
          channel: 'google',
          status: 'ACTIVE',
          lastRunAt: '2024-01-20T11:30:00Z',
          productsGenerated: 150,
          artifactUrl: 'https://storage.googleapis.com/feeds/google-shopping.xml',
          schedule: '0 3 * * *'
        },
        {
          id: 'feed-2',
          name: 'Feed Meta Catalog',
          channel: 'meta',
          status: 'ACTIVE',
          lastRunAt: '2024-01-20T11:35:00Z',
          productsGenerated: 150,
          artifactUrl: 'https://storage.googleapis.com/feeds/meta-catalog.csv',
          schedule: '0 3 * * *'
        }
      ],
      templates: {
        google: {
          format: 'XML',
          features: ['Google Shopping', 'Product attributes', 'Inventory sync']
        },
        meta: {
          format: 'CSV/TSV',
          features: ['Meta Catalog', 'Dynamic ads', 'Product feed']
        },
        amazon: {
          format: 'JSON',
          features: ['SP-API', 'Product listing', 'Inventory management']
        },
        mirakl: {
          format: 'JSON',
          features: ['Marketplace sync', 'Offer management', 'Order processing']
        }
      }
    }
  });
});

app.get('/api/v1/mappings/demo', (req, res) => {
  res.json({
    message: 'Module de mapping et IA',
    features: [
      'Mapping des champs entre sources et destinations',
      'Optimisation IA des contenus',
      'Calcul de score de qualité',
      'Templates par plateforme'
    ],
    demo: {
      mappings: [
        {
          id: 'mapping-1',
          name: 'Mapping Google Shopping',
          platform: 'GOOGLE',
          config: {
            title: 'name',
            description: 'description',
            price: 'price',
            image_link: 'image',
            availability: 'availability',
            brand: 'vendor',
            gtin: 'barcode'
          },
          aiOptimized: true,
          qualityScore: 92
        },
        {
          id: 'mapping-2',
          name: 'Mapping Meta Catalog',
          platform: 'META',
          config: {
            name: 'title',
            description: 'description',
            url: 'link',
            image_url: 'image',
            availability: 'availability',
            condition: 'condition',
            price: 'price'
          },
          aiOptimized: true,
          qualityScore: 88
        }
      ]
    }
  });
});

app.get('/api/v1/exports/demo', (req, res) => {
  res.json({
    message: 'Module d\'export vers les plateformes',
    features: [
      'Connecteurs Google, Meta, Amazon, Mirakl',
      'Transformation des données',
      'Gestion des erreurs et retry',
      'Jobs asynchrones via Pub/Sub'
    ],
    demo: {
      exports: [
        {
          id: 'export-1',
          name: 'Export Google Shopping',
          platform: 'GOOGLE',
          status: 'ACTIVE',
          lastRunAt: '2024-01-20T11:15:00Z',
          productsExported: 150,
          errorsCount: 2,
          schedule: '0 3 * * *'
        },
        {
          id: 'export-2',
          name: 'Export Meta Catalog',
          platform: 'META',
          status: 'ACTIVE',
          lastRunAt: '2024-01-20T11:20:00Z',
          productsExported: 150,
          errorsCount: 0,
          schedule: '0 3 * * *'
        }
      ],
      connectors: {
        google: {
          name: 'Google Merchant Center',
          features: ['Product upload', 'Inventory sync', 'Price updates'],
          status: 'Connected'
        },
        meta: {
          name: 'Meta Catalog',
          features: ['Product feed', 'Dynamic ads', 'Catalog sync'],
          status: 'Connected'
        },
        amazon: {
          name: 'Amazon SP-API',
          features: ['Product listing', 'Inventory management', 'Order sync'],
          status: 'Pending setup'
        },
        mirakl: {
          name: 'Mirakl Marketplace',
          features: ['Product sync', 'Offer management', 'Order processing'],
          status: 'Pending setup'
        }
      }
    }
  });
});

app.get('/api/v1/billing/demo', (req, res) => {
  res.json({
    message: 'Module de facturation Pennylane avancé',
    features: [
      'Intégration Pennylane API complète',
      'Génération automatique de factures mensuelles',
      'Gestion des plans et overages intelligente',
      'Webhooks de paiement et notifications',
      'Dashboard de facturation en temps réel',
      'Analytics d\'usage et prédictions',
      'Stockage sécurisé des PDF',
      'Gestion des méthodes de paiement'
    ],
    demo: {
      billing: {
        id: 'billing-1',
        plan: 'PROFESSIONAL',
        monthlyFee: 79.99,
        status: 'ACTIVE',
        lastInvoiceAt: '2024-01-01T00:00:00Z',
        nextInvoiceAt: '2024-02-01T00:00:00Z',
        pennylaneId: 'cust_123456789'
      },
      usage: {
        imports: 1250,
        exports: 3200,
        products: 15000,
        feeds: 8,
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        }
      },
      upcomingInvoice: {
        baseAmount: 79.99,
        overageAmount: 12.50,
        overageDetails: [
          {
            type: 'imports',
            quantity: 250,
            unitPrice: 0.05,
            total: 12.50
          }
        ],
        subtotal: 92.49,
        vat: 18.50,
        total: 110.99,
        dueDate: '2024-02-01T00:00:00Z'
      },
      invoices: [
        {
          id: 'invoice-1',
          number: 'INV-2024-001',
          amount: 79.99,
          status: 'PAID',
          dueDate: '2024-01-31T00:00:00Z',
          paidAt: '2024-01-15T10:30:00Z',
          downloadUrl: '/api/v1/billing/invoices/invoice-1/download'
        },
        {
          id: 'invoice-2',
          number: 'INV-2024-002',
          amount: 95.99,
          status: 'PENDING',
          dueDate: '2024-02-28T00:00:00Z',
          downloadUrl: '/api/v1/billing/invoices/invoice-2/download'
        }
      ],
      paymentMethods: [
        {
          id: 'pm_123456789',
          type: 'card',
          last4: '4242',
          brand: 'visa',
          expMonth: 12,
          expYear: 2025,
          isDefault: true
        }
      ],
      analytics: {
        period: '30d',
        dailyUsage: [
          { date: '2024-01-01', imports: 45, exports: 120, feeds: 2, total: 167 },
          { date: '2024-01-02', imports: 52, exports: 98, feeds: 1, total: 151 },
          { date: '2024-01-03', imports: 38, exports: 145, feeds: 3, total: 186 }
        ],
        trends: {
          imports: { trend: 'increasing', change: 15.2 },
          exports: { trend: 'stable', change: 2.1 },
          feeds: { trend: 'increasing', change: 8.7 }
        },
        prediction: {
          imports: 1500,
          exports: 3500,
          feeds: 10,
          total: 5010
        },
        summary: {
          total: { imports: 1250, exports: 3200, feeds: 8 },
          average: { imports: 40.3, exports: 103.2, feeds: 0.26 },
          peakDay: { date: '2024-01-15', total: 245 }
        }
      },
      planLimits: {
        STARTER: {
          imports: 1000,
          exports: 2000,
          products: 10000,
          feeds: 2,
          price: 29.99
        },
        PROFESSIONAL: {
          imports: 5000,
          exports: 10000,
          products: 50000,
          feeds: 5,
          price: 79.99
        },
        ENTERPRISE: {
          imports: 20000,
          exports: 50000,
          products: 200000,
          feeds: 20,
          price: 199.99
        }
      }
    }
  });
});

app.get('/api/v1/monitoring/demo', (req, res) => {
  res.json({
    message: 'Module de monitoring avancé',
    features: [
      'Logs centralisés avec filtrage',
      'Métriques système en temps réel',
      'Alertes intelligentes avec cooldown',
      'Health checks automatisés',
      'Dashboard de performance',
      'Rapports de tendances',
      'Notifications multi-canaux'
    ],
    demo: {
      health: {
        status: 'HEALTHY',
        score: 95,
        issues: [],
        lastChecked: new Date().toISOString()
      },
      metrics: {
        imports: {
          total: 150,
          successful: 145,
          failed: 5,
          successRate: 96.7,
          averageTime: 2.5,
          last24h: 12
        },
        exports: {
          total: 300,
          successful: 295,
          failed: 5,
          successRate: 98.3,
          averageTime: 4.2,
          last24h: 25
        },
        feeds: {
          total: 4,
          active: 4,
          lastRun: '2024-01-20T11:30:00Z',
          averageGenerationTime: 3.8,
          last24h: 8
        },
        products: {
          total: 1500,
          active: 1450,
          averageQualityScore: 87.5,
          lowQualityCount: 25,
          last24h: 45
        },
        system: {
          uptime: 86400,
          memoryUsage: 65.2,
          cpuUsage: 23.8,
          diskUsage: 45.1,
          apiResponseTime: 145
        },
        billing: {
          totalInvoices: 12,
          paidInvoices: 11,
          overdueInvoices: 0,
          totalRevenue: 959.88,
          lastInvoiceDate: '2024-01-01T00:00:00Z'
        }
      },
      alerts: [
        {
          id: 'alert-1',
          severity: 'MEDIUM',
          title: 'Taux de succès des imports faible',
          message: 'Le taux de succès des imports (96.7%) est inférieur au seuil recommandé (98%)',
          metric: 'imports.successRate',
          value: 96.7,
          threshold: 98,
          triggeredAt: '2024-01-20T10:30:00Z',
          status: 'TRIGGERED'
        }
      ],
      alertConfigs: [
        {
          id: 'config-1',
          name: 'Import Success Rate',
          type: 'IMPORT_ERROR',
          threshold: 95,
          condition: 'LESS_THAN',
          metric: 'imports.successRate',
          enabled: true,
          channels: ['EMAIL', 'SLACK'],
          recipients: ['admin@feedplug.com', '#alerts'],
          cooldown: 30
        }
      ],
      recentLogs: [
        {
          level: 'INFO',
          message: 'Import Shopify completed successfully',
          timestamp: '2024-01-20T11:15:00Z',
          context: { importId: 'import-1', productsCount: 150 }
        },
        {
          level: 'SUCCESS',
          message: 'Export Google Shopping completed',
          timestamp: '2024-01-20T11:20:00Z',
          context: { exportId: 'export-1', productsExported: 150 }
        },
        {
          level: 'WARN',
          message: 'Some products rejected by Google',
          timestamp: '2024-01-20T11:25:00Z',
          context: { exportId: 'export-1', rejectedProducts: 2 }
        }
      ],
      performance: {
        summary: {
          health: 'HEALTHY',
          score: 95,
          issues: 0,
          lastChecked: new Date().toISOString()
        },
        recommendations: [
          'Optimiser les connecteurs de plateformes pour améliorer le taux de succès',
          'Activer l\'enrichissement IA pour les produits de faible qualité'
        ],
        trends: {
          imports: { trend: 'stable', change: 0 },
          exports: { trend: 'increasing', change: 5.2 },
          products: { trend: 'increasing', change: 12.8 },
          quality: { trend: 'improving', change: 3.1 }
        }
      }
    }
  });
});

app.get('/api/v1/onboarding/demo', (req, res) => {
  res.json({
    message: 'Module d\'onboarding produit-first',
    features: [
      'Parcours d\'onboarding guidé',
      'Recommandations intelligentes',
      'Données de démonstration',
      'Actions automatiques',
      'Suivi de progression',
      'Personnalisation par étape',
      'Assistant IA contextuel',
      'Analytics d\'onboarding'
    ],
    demo: {
      steps: [
        {
          stepId: 'welcome',
          title: 'Bienvenue sur FeedPlug',
          description: 'Découvrez comment FeedPlug peut optimiser vos flux produits',
          completed: true,
          current: false,
          actions: ['start_onboarding']
        },
        {
          stepId: 'company_info',
          title: 'Informations entreprise',
          description: 'Configurez les informations de votre entreprise',
          completed: true,
          current: false,
          data: {
            companyName: 'Mon Entreprise',
            industry: 'E-commerce',
            website: 'https://mon-entreprise.com'
          },
          actions: ['save_company_info', 'skip_step']
        },
        {
          stepId: 'ecommerce_platform',
          title: 'Plateforme e-commerce',
          description: 'Connectez votre plateforme e-commerce',
          completed: true,
          current: false,
          data: {
            platform: 'shopify',
            storeUrl: 'https://ma-boutique.myshopify.com'
          },
          actions: ['connect_platform', 'skip_step']
        },
        {
          stepId: 'import_feed',
          title: 'Import de flux',
          description: 'Importez votre premier flux de produits',
          completed: true,
          current: false,
          data: {
            importType: 'url',
            feedUrl: 'https://ma-boutique.com/products.csv',
            feedFormat: 'csv',
            feedName: 'Produits principaux'
          },
          actions: ['import_feed', 'use_demo_data']
        },
        {
          stepId: 'quality_check',
          title: 'Vérification qualité',
          description: 'Vérifiez et améliorez la qualité de vos données',
          completed: false,
          current: true,
          data: {
            acceptRecommendations: true,
            customRules: []
          },
          actions: ['run_quality_check', 'apply_recommendations']
        },
        {
          stepId: 'ai_enrichment',
          title: 'Enrichissement IA',
          description: 'Activez l\'enrichissement automatique par IA',
          completed: false,
          current: false,
          actions: ['enable_ai', 'configure_ai']
        },
        {
          stepId: 'first_export',
          title: 'Premier export',
          description: 'Exportez vos produits vers une plateforme',
          completed: false,
          current: false,
          actions: ['create_export', 'test_export']
        },
        {
          stepId: 'billing_setup',
          title: 'Configuration facturation',
          description: 'Configurez votre plan et méthode de paiement',
          completed: false,
          current: false,
          actions: ['select_plan', 'setup_payment']
        },
        {
          stepId: 'completed',
          title: 'Onboarding terminé',
          description: 'Félicitations ! Votre compte est configuré',
          completed: false,
          current: false,
          actions: ['view_dashboard', 'start_using']
        }
      ],
      progress: {
        currentStep: 'quality_check',
        completedSteps: ['welcome', 'company_info', 'ecommerce_platform', 'import_feed'],
        progress: 44,
        lastUpdated: new Date().toISOString()
      },
      recommendations: [
        {
          type: 'quality',
          title: 'Améliorez la qualité de vos produits',
          description: '15 produits ont un score de qualité faible',
          impact: 'high',
          effort: 'medium',
          suggestedActions: ['enable_ai_enrichment', 'fix_manual_products']
        },
        {
          type: 'optimization',
          title: 'Activez l\'enrichissement IA',
          description: 'L\'IA peut améliorer automatiquement vos titres, descriptions et catégories',
          impact: 'high',
          effort: 'low',
          suggestedActions: ['enable_ai', 'configure_ai_rules']
        }
      ],
      aiAssistant: {
        personalizedMessage: 'Parfait ! Vérifions la qualité de vos données produits.',
        nextStepSuggestion: 'Activons l\'enrichissement IA pour améliorer vos produits.',
        estimatedTimeRemaining: 'Environ 10 minutes',
        contextualTips: [
          'Un score de qualité élevé améliore vos performances',
          'L\'IA peut corriger automatiquement les erreurs',
          'Vérifiez les images et descriptions'
        ]
      },
      stats: {
        totalAccounts: 1250,
        onboardedAccounts: 890,
        completionRate: 71.2,
        stepDistribution: [
          { step: 'welcome', count: 1250, percentage: 100 },
          { step: 'company_info', count: 1100, percentage: 88 },
          { step: 'ecommerce_platform', count: 950, percentage: 76 },
          { step: 'import_feed', count: 800, percentage: 64 },
          { step: 'quality_check', count: 650, percentage: 52 },
          { step: 'ai_enrichment', count: 500, percentage: 40 },
          { step: 'first_export', count: 400, percentage: 32 },
          { step: 'billing_setup', count: 350, percentage: 28 },
          { step: 'completed', count: 890, percentage: 71.2 }
        ]
      }
    }
  });
});

// Route pour tester l'API
app.get('/api/v1/test', (req, res) => {
  res.json({
    message: '✅ FeedPlug API fonctionne correctement !',
    timestamp: new Date().toISOString(),
    environment: 'demo',
    version: '1.0.0'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log('🚀 FeedPlug API Demo démarrée !');
  console.log(`📡 Serveur disponible sur http://localhost:${PORT}`);
  console.log(`📚 Documentation API sur http://localhost:${PORT}/api/docs`);
  console.log('');
  console.log('🔗 Endpoints de démonstration :');
  console.log(`   • Accueil: http://localhost:${PORT}`);
  console.log(`   • Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`   • Test API: http://localhost:${PORT}/api/v1/test`);
  console.log(`   • Auth Demo: http://localhost:${PORT}/api/v1/auth/demo`);
  console.log(`   • Accounts Demo: http://localhost:${PORT}/api/v1/accounts/demo`);
  console.log(`   • Imports Demo: http://localhost:${PORT}/api/v1/imports/demo`);
  console.log(`   • Products Demo: http://localhost:${PORT}/api/v1/products/demo`);
  console.log(`   • Mappings Demo: http://localhost:${PORT}/api/v1/mappings/demo`);
  console.log(`   • Feeds Demo: http://localhost:${PORT}/api/v1/feeds/demo`);
  console.log(`   • Exports Demo: http://localhost:${PORT}/api/v1/exports/demo`);
  console.log(`   • Billing Demo: http://localhost:${PORT}/api/v1/billing/demo`);
  console.log(`   • Monitoring Demo: http://localhost:${PORT}/api/v1/monitoring/demo`);
  console.log(`   • Onboarding Demo: http://localhost:${PORT}/api/v1/onboarding/demo`);
  console.log('');
  console.log('🎉 Tour du propriétaire prêt !');
});

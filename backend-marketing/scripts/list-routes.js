// Inventaire des routes Express : charge l'app sans listener ni DB et imprime
// "METHOD /chemin" trié, une ligne par route, sur stdout (JSON).
// Utilisé par tests/routes/route-inventory.test.js comme filet de sécurité
// pendant l'extraction des domaines hors de server-minimal.js.
//
// Les secrets factices ci-dessous garantissent que les routes conditionnelles
// (webhooks Stripe / Shopify) s'enregistrent et figurent dans l'inventaire.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'route-inventory-dummy-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'route-inventory-dummy-refresh';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_route_inventory_dummy';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_route_inventory_dummy';
process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || 'shpss_route_inventory_dummy';

// Neutraliser les logs du serveur pour que stdout ne contienne que le JSON.
console.log = () => {};
console.warn = () => {};
console.error = () => {};

const express = require('express');

const app = express();
require('../server-minimal.js')(app);

function collectRoutes(stack, prefix) {
  const routes = [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all');
      for (const method of methods) {
        routes.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      // Router monté : reconstruire le préfixe depuis la regexp du layer.
      const mountPath = layer.regexp?.source
        ?.replace('^\\/', '/')
        ?.replace('\\/?(?=\\/|$)', '')
        ?.replace(/\\\//g, '/') || '';
      routes.push(...collectRoutes(layer.handle.stack, prefix + mountPath));
    }
  }
  return routes;
}

const routes = [...new Set(collectRoutes(app._router.stack, ''))].sort();
process.stdout.write(JSON.stringify(routes, null, 2) + '\n');
process.exit(0);

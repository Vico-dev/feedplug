/**
 * Initialisation Sentry pour le backend (à charger en premier).
 * Si SENTRY_DSN n'est pas défini, Sentry n'est pas activé.
 */
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
} else {
  // Désactiver Sentry si pas de DSN (dev local sans config)
  Sentry.close(0);
}

module.exports = Sentry;

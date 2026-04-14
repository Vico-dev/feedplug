import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  
  // Activer uniquement si le DSN est configuré
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  tracesSampleRate: 0.1, // 10% des transactions
  replaysSessionSampleRate: 0.05, // 5% des sessions
  replaysOnErrorSampleRate: 1.0, // 100% des sessions avec erreur
  
  environment: process.env.NODE_ENV || "production",
});

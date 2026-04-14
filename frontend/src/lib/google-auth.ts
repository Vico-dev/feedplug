/**
 * Client ID Google pour l'auth "Continuer avec Google"
 * Fallback si .env.local non chargé (Next.js inlined à build time)
 */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "771607738477-iam4qts7ch3sn9do88djdkohvpj0f4a9.apps.googleusercontent.com";

export const hasGoogleAuth = GOOGLE_CLIENT_ID.length > 20;

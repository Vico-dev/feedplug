"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker PWA du comparateur (/sw.js, scope "/").
 *
 * UNIQUEMENT en production : en dev le SW mettrait en cache des assets
 * volatils (_next/static) et masquerait le HMR. Monté depuis le layout du
 * groupe (comparateur) exclusivement : le SW ne s'installe donc que pour les
 * visiteurs du comparateur B2C, jamais depuis le dashboard B2B (le sw.js
 * lui-même bypasse /dashboard, /api, /embedded… par sécurité).
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Best-effort : un échec d'enregistrement ne doit jamais casser la page.
    });
  }, []);

  return null;
}

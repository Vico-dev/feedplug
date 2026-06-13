"use client";

import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback } from "react";

/**
 * Hook fournissant un `fetch` qui injecte automatiquement le session token
 * Shopify dans l'header Authorization. À utiliser pour toutes les requêtes
 * depuis le contexte embedded.
 *
 * Côté backend : si l'header décrypte comme JWT signé avec SHOPIFY_API_SECRET
 * et audience = SHOPIFY_API_KEY, c'est un session token Shopify, et on
 * identifie le shop via le claim `dest` (cf. verifyShopifySessionToken).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/feedplug-api";

export function useEmbeddedFetch() {
  const shopify = useAppBridge();

  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      let sessionToken: string | null = null;
      try {
        sessionToken = await shopify.idToken();
      } catch {
        // App Bridge pas encore prêt ou contexte non-embedded : on appelle
        // l'API sans header session token, le backend retombera sur JWT cookie
        // si disponible.
      }
      const headers = new Headers(init.headers || {});
      if (sessionToken) {
        headers.set("Authorization", `Bearer ${sessionToken}`);
      }
      if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
        headers.set("Content-Type", "application/json");
      }
      const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
      return fetch(url, {
        ...init,
        headers,
        credentials: init.credentials ?? "include",
        cache: init.cache ?? "no-store",
      });
    },
    [shopify]
  );
}

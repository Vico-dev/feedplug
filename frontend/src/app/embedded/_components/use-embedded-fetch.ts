"use client";

import { useCallback } from "react";

/**
 * Hook fournissant un `fetch` qui injecte automatiquement le session token
 * Shopify dans l'header Authorization. À utiliser pour toutes les requêtes
 * depuis le contexte embedded.
 *
 * Backend reconnaît : si l'header est un JWT signé avec SHOPIFY_API_SECRET et
 * audience = SHOPIFY_API_KEY, c'est un session token et on identifie le shop.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/feedplug-api";

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

async function getShopifySessionToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const idToken = window.shopify?.idToken;
  if (typeof idToken !== "function") return null;
  try {
    const token = await idToken();
    return token || null;
  } catch {
    return null;
  }
}

export function useEmbeddedFetch() {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const sessionToken = await getShopifySessionToken();
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
  }, []);
}

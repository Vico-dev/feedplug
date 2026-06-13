"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "";

function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Le script App Bridge est chargé par le root layout via next/script
 * strategy="beforeInteractive" (seule manière de garantir un <script> non-async,
 * requis par App Bridge).
 *
 * Ce composant ne fait plus que probe le session token Shopify pour les routes
 * NON-/embedded (le segment /embedded gère son auth via useEmbeddedFetch).
 * Utile pour les pages standalone qui doivent détecter un contexte Shopify
 * (ex: une page d'audit publique ouverte depuis Shopify Admin).
 */
export function ShopifyEmbeddedBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentSearchParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const host = currentSearchParams.get("host") || "";

  const shouldProbe = useMemo(() => {
    if (!SHOPIFY_API_KEY) return false;
    // Le segment /embedded gère son propre flow (useEmbeddedFetch).
    if (pathname?.startsWith("/embedded")) return false;
    return (
      Boolean(currentSearchParams.get("host")) ||
      currentSearchParams.get("embedded") === "1" ||
      Boolean(currentSearchParams.get("shop")) ||
      isEmbeddedFrame()
    );
  }, [currentSearchParams, pathname]);

  useEffect(() => {
    if (!shouldProbe) return;

    let cancelled = false;
    let retryHandle: number | null = null;

    const probeSessionToken = async (attempt = 0) => {
      if (cancelled) return;

      const idToken = window.shopify?.idToken;
      if (typeof idToken !== "function") {
        if (attempt < 8) {
          retryHandle = window.setTimeout(() => {
            void probeSessionToken(attempt + 1);
          }, 350);
        }
        return;
      }

      try {
        const token = await idToken();
        if (!token || cancelled) return;

        await fetch("/feedplug-api/shopify/session-token/probe", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pathname,
            host,
          }),
          credentials: "include",
          cache: "no-store",
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Shopify App Bridge session probe failed:", error);
        }
      }
    };

    void probeSessionToken();

    return () => {
      cancelled = true;
      if (retryHandle !== null) {
        window.clearTimeout(retryHandle);
      }
    };
  }, [host, pathname, shouldProbe]);

  return null;
}

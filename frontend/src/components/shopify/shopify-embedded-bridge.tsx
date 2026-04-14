"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

const SHOPIFY_APP_BRIDGE_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "";

function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function ShopifyEmbeddedBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [scriptReady, setScriptReady] = useState(false);
  const searchKey = searchParams.toString();
  const currentSearchParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const host = currentSearchParams.get("host") || "";

  const shouldLoadBridge = useMemo(() => {
    if (!SHOPIFY_API_KEY) return false;
    return (
      Boolean(currentSearchParams.get("host")) ||
      currentSearchParams.get("embedded") === "1" ||
      Boolean(currentSearchParams.get("shop")) ||
      isEmbeddedFrame()
    );
  }, [currentSearchParams]);

  useEffect(() => {
    if (!SHOPIFY_API_KEY) return;
    let meta = document.querySelector('meta[name="shopify-api-key"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "shopify-api-key");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", SHOPIFY_API_KEY);
  }, []);

  useEffect(() => {
    if (!shouldLoadBridge) return;

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

    void probeSessionToken(scriptReady ? 0 : 1);

    return () => {
      cancelled = true;
      if (retryHandle !== null) {
        window.clearTimeout(retryHandle);
      }
    };
  }, [host, pathname, scriptReady, shouldLoadBridge]);

  if (!shouldLoadBridge) {
    return null;
  }

  return (
    <Script
      id="shopify-app-bridge"
      src={SHOPIFY_APP_BRIDGE_SRC}
      strategy="afterInteractive"
      onLoad={() => setScriptReady(true)}
    />
  );
}

"use client";

import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import frTranslations from "@shopify/polaris/locales/fr.json";
import esTranslations from "@shopify/polaris/locales/es.json";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { LinkLikeComponentProps } from "@shopify/polaris/build/ts/src/utilities/link";

/**
 * Détecte la locale Shopify Admin via le query param `locale` (envoyé par
 * Shopify Admin lors du chargement de l'iframe), avec fallback FR par défaut.
 */
function pickLocale(rawLocale: string | null): "fr" | "en" | "es" {
  const lower = (rawLocale || "").toLowerCase().split("-")[0];
  if (lower === "fr" || lower === "en" || lower === "es") return lower;
  return "fr";
}

/**
 * Adapter pour que les composants Polaris (Link, Button as a link) utilisent
 * next/link, ce qui permet la navigation App Bridge-friendly (sans recharger
 * l'iframe) tout en respectant les conventions Polaris.
 */
function PolarisLink({
  children,
  url,
  external,
  ref: _ref,
  ...rest
}: LinkLikeComponentProps) {
  if (external || /^https?:\/\//.test(url)) {
    return (
      <a href={url} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={url} {...rest}>
      {children}
    </Link>
  );
}

export function EmbeddedProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const locale = pickLocale(searchParams.get("locale"));
  const i18n = useMemo(() => {
    if (locale === "en") return enTranslations;
    if (locale === "es") return esTranslations;
    return frTranslations;
  }, [locale]);

  // Sur le 1er rendu côté client, on attend que App Bridge soit chargé pour éviter
  // un flash de contenu avant que l'iframe soit prêt à recevoir des actions.
  const [bridgeReady, setBridgeReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const probe = () => {
      if (cancelled) return;
      // window.shopify est injecté par le script CDN App Bridge chargé dans le
      // root layout via <ShopifyEmbeddedBridge />.
      if (typeof window !== "undefined" && (window as any).shopify?.idToken) {
        setBridgeReady(true);
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        setTimeout(probe, 250);
      } else {
        // Au bout de 5s sans App Bridge, on continue (ex: ouverture standalone
        // pour debug). Les hooks App Bridge resteront inertes.
        setBridgeReady(true);
      }
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppProvider i18n={i18n} linkComponent={PolarisLink}>
      <div data-embedded-bridge-ready={bridgeReady ? "1" : "0"}>{children}</div>
    </AppProvider>
  );
}

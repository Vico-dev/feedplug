import type { Metadata } from "next";
import { Suspense } from "react";
import "@shopify/polaris/build/esm/styles.css";
import { EmbeddedProvider } from "./_components/embedded-provider";
import { EmbeddedNavMenu } from "./_components/embedded-nav-menu";

export const metadata: Metadata = {
  title: { default: "FeedPlug", template: "%s · FeedPlug" },
  description:
    "Synchronisez votre catalogue Shopify vers Google Shopping, Bing et Amazon.",
  // L'iframe Shopify Admin n'est pas indexé, mais on cadenasse au cas où.
  robots: { index: false, follow: false },
};

/**
 * Layout dédié à l'expérience embedded Shopify Admin.
 *
 * Distinct du layout (dashboard) afin que :
 *  - le design Polaris ne pollue pas le dashboard standalone FeedPlug
 *  - le contexte App Bridge ne soit chargé que dans l'iframe Shopify
 *  - les merchants installés via Shopify aient une UX native Shopify
 *    (requise pour le badge Built for Shopify)
 *
 * Le bridge App Bridge CDN script est déjà chargé conditionnellement par
 * `<ShopifyEmbeddedBridge />` dans le root layout. On preconnect ici au CDN
 * Shopify (script app-bridge.js + assets Polaris) pour gagner le DNS+TLS
 * handshake avant le 1er parse JS.
 */
export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  // App Bridge (<meta> + <script>) est injecté dans le root layout via
  // strategy="beforeInteractive" — c'est la seule manière de garantir un
  // <script> non-async, requis par App Bridge ("must not use async").
  return (
    <>
      <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="" />
      <link rel="dns-prefetch" href="https://cdn.shopify.com" />
      <Suspense fallback={null}>
        <EmbeddedProvider>
          <EmbeddedNavMenu />
          {children}
        </EmbeddedProvider>
      </Suspense>
    </>
  );
}

import { Suspense } from "react";
import "@shopify/polaris/build/esm/styles.css";
import { EmbeddedProvider } from "./_components/embedded-provider";
import { EmbeddedNavMenu } from "./_components/embedded-nav-menu";

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
 * `<ShopifyEmbeddedBridge />` dans le root layout.
 */
export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <EmbeddedProvider>
        <EmbeddedNavMenu />
        {children}
      </EmbeddedProvider>
    </Suspense>
  );
}

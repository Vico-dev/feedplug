import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import "./globals.css";
import { AuthProviderWrapper } from "./auth-provider-wrapper";
import { ShopifyEmbeddedBridge } from "@/components/shopify/shopify-embedded-bridge";

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "";

const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const fontSans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const fontSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://feedplug.com"),
  title: {
    default: "FeedPlug - Multi-channel Product Synchronization",
    template: "%s | FeedPlug",
  },
  description: "Centralize and synchronize your product catalogs across all channels",
  // Pas de `icons:` explicite → Next.js auto-détecte :
  //  - src/app/favicon.ico (ICO multi-res 16/32/48, square mark officiel dark)
  //  - src/app/icon.png (PNG 512×512, coins arrondis transparents)
  //  - src/app/apple-icon.png (180×180 full-bleed, iOS applique son propre masque)
  // Source : FeedPlug Design System — feedplug-mark-1200 (dark primary).
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let locale = "fr";
  try {
    locale = await getLocale();
  } catch {
    // Fallback pour les routes sans contexte i18n (ex: /login)
  }
  // App Bridge exige d'être le PREMIER <script> du <head>, sans async/defer.
  // Contraintes Next.js 15 / React 19 :
  //  - <script src="..."> JSX dans un server component nested est hoist avec async
  //  - next/script strategy="beforeInteractive" n'injecte PAS dans le HTML SSR (App Router)
  //  - <script> inline avec dangerouslySetInnerHTML EST préservé tel quel
  //
  // Solution : un <script> inline (jamais async) qui injecte synchroniquement
  // le <script src="...app-bridge.js"> via document.write pendant le parsing
  // HTML, MAIS uniquement sur les routes /embedded/*. App Bridge embarque
  // son CSS Shopify Admin qui override --ink/--paper s'il est chargé sur les
  // pages publiques (audit lead magnet, marketing, docs, login) — d'où le
  // bug "texte noir sur fond noir" historique sur /audit-flux.
  //
  // Le check pathname.indexOf('/embedded')===0 tourne pendant le parsing du
  // head donc document.write reste safe (pas d'effacement du body).

  return (
    <html lang={locale} suppressHydrationWarning className="light">
      <head>
        {SHOPIFY_API_KEY ? (
          <>
            <meta name="shopify-api-key" content={SHOPIFY_API_KEY} />
            <script
              dangerouslySetInnerHTML={{
                __html: `if(location.pathname.indexOf('/embedded')===0){document.write('<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"><\\/script>');}`,
              }}
            />
          </>
        ) : null}
      </head>
      <body
        suppressHydrationWarning
        className={`${fontDisplay.variable} ${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}
      >
        <AuthProviderWrapper>
          <Suspense fallback={null}>
            <ShopifyEmbeddedBridge />
          </Suspense>
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  );
}

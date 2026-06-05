import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import "./globals.css";
import { AuthProviderWrapper } from "./auth-provider-wrapper";
import { ShopifyEmbeddedBridge } from "@/components/shopify/shopify-embedded-bridge";

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
  //  - src/app/favicon.ico (ICO multi-res, picto "FP" sur fond blanc)
  //  - src/app/icon.tsx (PNG dynamique 32×32)
  //  - src/app/apple-icon.tsx (apple-touch-icon)
  // L'ancien override forçait /app-icon-1200.png comme favicon, taille
  // trop grande pour être reconnue comme favicon par les browsers → onglet vide.
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
  return (
    <html lang={locale} suppressHydrationWarning className="light">
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

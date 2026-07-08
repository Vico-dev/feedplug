"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import CookieConsent from "./CookieConsent";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-KTF5X89N";

// Clé du consentement CONSO, persistée par la bannière du comparateur
// (components/comparateur/cookie-consent.tsx) : 'all' | 'essential' en
// localStorage + cookie 1st-party, avec un CustomEvent 'cmp-consent' au choix.
const CMP_CONSENT_KEY = "cmp_cookie_consent";

// Hôtes conso (apex) : la bannière du comparateur y est montée par le layout
// (comparateur) et pilote seule le consentement. On n'y affiche donc PAS la
// bannière marketing (sinon double bannière). Sur pro./app./run.app/localhost,
// la bannière marketing reste le mécanisme existant (clé feedplug_cookie_consent).
function isConsumerHostname(hostname: string) {
  return hostname === "feedplug.com" || hostname === "www.feedplug.com";
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [consentGiven, setConsentGiven] = useState(false);
  const [consumerHost, setConsumerHost] = useState(false);

  // Deux signaux de consentement cohabitent (OU logique) :
  //  - marketing B2B : bannière ./CookieConsent (callbacks onAccept/onRefuse,
  //    clé feedplug_cookie_consent) — mécanisme historique, inchangé ;
  //  - conso comparateur : clé cmp_cookie_consent ('all' = accepté) lue au
  //    montage + event 'cmp-consent' dispatché en live par la bannière conso.
  useEffect(() => {
    try {
      if (localStorage.getItem(CMP_CONSENT_KEY) === "all") setConsentGiven(true);
    } catch {
      /* stockage indisponible : on reste sur "pas de consentement" */
    }
    setConsumerHost(isConsumerHostname(window.location.hostname));

    const onCmpConsent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail === "all") setConsentGiven(true);
      else if (detail === "essential") setConsentGiven(false);
    };
    window.addEventListener("cmp-consent", onCmpConsent);
    return () => window.removeEventListener("cmp-consent", onCmpConsent);
  }, []);

  const handleAccept = useCallback(() => {
    setConsentGiven(true);
  }, []);

  const handleRefuse = useCallback(() => {
    setConsentGiven(false);
  }, []);

  // Pas de GTM ni de bannière cookies dans l'iframe Shopify embarquée
  // (contexte admin Shopify, consentement géré hors de notre périmètre).
  if (pathname?.startsWith("/embedded")) return null;

  return (
    <>
      {/* GTM only loads after cookie consent (bannière marketing OU conso) */}
      {consentGiven && GTM_ID && (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_ID}');
            `}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}
      {!consumerHost && <CookieConsent onAccept={handleAccept} onRefuse={handleRefuse} />}
    </>
  );
}

// Push custom events to dataLayer
export function trackEvent(event: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

"use client";

import Script from "next/script";
import { useState, useCallback } from "react";
import CookieConsent from "./CookieConsent";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-KTF5X89N";

export default function GoogleAnalytics() {
  const [consentGiven, setConsentGiven] = useState(false);

  const handleAccept = useCallback(() => {
    setConsentGiven(true);
  }, []);

  const handleRefuse = useCallback(() => {
    setConsentGiven(false);
  }, []);

  return (
    <>
      {/* GTM only loads after cookie consent */}
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
      <CookieConsent onAccept={handleAccept} onRefuse={handleRefuse} />
    </>
  );
}

// Push custom events to dataLayer
export function trackEvent(event: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

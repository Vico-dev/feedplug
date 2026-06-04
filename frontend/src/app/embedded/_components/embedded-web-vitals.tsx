"use client";

import { useAppBridge } from "@shopify/app-bridge-react";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type ShopifyVitalMetric = {
  id: string;
  name: string;
  value: number;
};

type ShopifyVitalReport = {
  metrics: ShopifyVitalMetric[];
};

/**
 * Mesure les Web Vitals que Shopify Admin calcule sur notre iframe embedded
 * et les transmet à Sentry comme breadcrumbs + métriques custom.
 *
 * Pourquoi : pour Built for Shopify, Shopify mesure LCP/CLS/INP sur l'iframe
 * en prod. En s'abonnant à `shopify.webVitals.onReport`, on récupère les MÊMES
 * mesures côté client → on peut :
 *  - alerter si la perf dégrade (Sentry threshold)
 *  - corréler les régressions avec un release
 *  - prouver à BFS qu'on a une boucle perf opérationnelle
 *
 * À ne mounter QU'UNE SEULE FOIS par session (dans EmbeddedProvider) — sinon
 * on register plusieurs callbacks et on duplique les events.
 */
export function EmbeddedWebVitals() {
  const shopify = useAppBridge();

  useEffect(() => {
    let cancelled = false;
    const register = async () => {
      // L'API n'est disponible que dans le bridge réellement chargé. En SSR ou
      // si le bridge n'a pas démarré, useAppBridge renvoie un Proxy qui throw
      // à l'accès → on l'enveloppe dans try/catch.
      try {
        if (typeof shopify?.webVitals?.onReport !== "function") return;
        if (cancelled) return;
        await shopify.webVitals.onReport((report: ShopifyVitalReport) => {
          if (cancelled) return;
          for (const metric of report?.metrics ?? []) {
            // Sentry : breadcrumb pour le contexte + measurement pour le suivi
            Sentry.addBreadcrumb({
              category: "shopify.web-vitals",
              message: `${metric.name}=${metric.value}`,
              level: "info",
              data: { id: metric.id, name: metric.name, value: metric.value },
            });
            try {
              // Sentry.setMeasurement existe sur l'API legacy et est encore
              // supporté dans v10. Si elle disparaît, le try/catch protège.
              const setMeasurement = (Sentry as unknown as {
                setMeasurement?: (name: string, value: number, unit: string) => void;
              }).setMeasurement;
              if (typeof setMeasurement === "function") {
                const unit = metric.name === "CLS" ? "" : "millisecond";
                setMeasurement(`shopify.${metric.name}`, metric.value, unit);
              }
            } catch {
              // ignore
            }
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.info("[shopify webvitals]", metric.name, metric.value);
            }
          }
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[shopify webvitals] register failed", err);
        }
      }
    };

    void register();

    return () => {
      cancelled = true;
      // On NE désabonne PAS via onReport(null) car ça invaliderait le report
      // pour les autres potentielles consumers. La cleanup ferme juste notre
      // closure avec `cancelled = true`.
    };
  }, [shopify]);

  return null;
}

"use client";

import { Box, EmptyState, Page } from "@shopify/polaris";
import { useEffect } from "react";

/**
 * Error boundary global pour le segment /embedded.
 *
 * Pourquoi Polaris EmptyState plutôt qu'un message brut :
 *  - cohérence visuelle avec Shopify Admin (BFS audit)
 *  - illustration d'État d'erreur identifiable au premier coup d'œil
 *  - bouton "Réessayer" Polaris exécute le `reset` Next.js qui re-monte
 *    le segment sans recharger l'iframe (gain UX vs F5)
 */
export default function EmbeddedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En prod, l'erreur remonte déjà à Sentry via le root error boundary.
    // En dev, on log pour faciliter le debug.
    if (process.env.NODE_ENV !== "production") {
      console.error("[embedded error boundary]", error);
    }
  }, [error]);

  return (
    <Page>
      <Box paddingBlock="800">
        <EmptyState
          heading="Une erreur est survenue"
          action={{
            content: "Réessayer",
            onAction: reset,
          }}
          secondaryAction={{
            content: "Contacter le support",
            url: "mailto:support@feedplug.com",
            external: true,
          }}
          image="/embedded-empty.svg"
        >
          <p>
            FeedPlug n&apos;a pas pu charger cette page. Si le problème persiste,
            contactez le support en mentionnant la référence{" "}
            <code>{error?.digest || "n/a"}</code>.
          </p>
        </EmptyState>
      </Box>
    </Page>
  );
}

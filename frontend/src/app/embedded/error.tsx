"use client";

import { Box, EmptyState, Page } from "@shopify/polaris";
import { useEffect } from "react";
import { useEmbeddedT } from "./_locale";

/**
 * Error boundary global pour le segment /embedded.
 *
 * Pourquoi Polaris EmptyState plutôt qu'un message brut :
 *  - cohérence visuelle avec Shopify Admin (BFS audit)
 *  - illustration d'État d'erreur identifiable au premier coup d'œil
 *  - bouton "Retry" Polaris exécute le `reset` Next.js qui re-monte
 *    le segment sans recharger l'iframe (gain UX vs F5)
 */
export default function EmbeddedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useEmbeddedT();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[embedded error boundary]", error);
    }
  }, [error]);

  return (
    <Page>
      <Box paddingBlock="800">
        <EmptyState
          heading={t("error.heading")}
          action={{
            content: t("error.retry"),
            onAction: reset,
          }}
          secondaryAction={{
            content: t("error.support"),
            url: "mailto:support@feedplug.com",
            external: true,
          }}
          image="/embedded-empty.svg"
        >
          <p>{t("error.message")}</p>
          <p>
            <small>
              {t("error.reference", { digest: error?.digest || "n/a" })}
            </small>
          </p>
        </EmptyState>
      </Box>
    </Page>
  );
}

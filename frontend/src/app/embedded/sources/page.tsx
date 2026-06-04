"use client";

import {
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  Layout,
  Link,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

/**
 * Stub /embedded/sources — la gestion fine du catalogue reste sur le dashboard
 * standalone pour l'instant. La page existe pour que le lien NavMenu pointe
 * vers du contenu cohérent (et non un 404) lors de la review App Store.
 *
 * Migration progressive : on portera ici la vue "Sources" complète du dashboard
 * standalone une fois les Web Vitals optimisés.
 */
export default function EmbeddedSourcesPage() {
  return (
    <Page>
      <TitleBar title="Catalogue" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Catalogue Shopify connecté
              </Text>
              <Text variant="bodyMd" as="p">
                FeedPlug détecte automatiquement vos produits Shopify et les
                synchronise vers les canaux d'export que vous avez choisis.
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                La gestion détaillée des sources (mapping personnalisé, filtres
                par collection, règles d'optimisation) est disponible sur votre
                espace FeedPlug.
              </Text>
              <Box>
                <Button
                  variant="primary"
                  url="https://app.feedplug.com/fr/sources"
                  target="_blank"
                  accessibilityLabel="Ouvrir la gestion des sources sur app.feedplug.com (nouvel onglet)"
                >
                  Gérer mes sources sur app.feedplug.com
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

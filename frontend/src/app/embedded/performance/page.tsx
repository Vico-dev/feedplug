"use client";

import {
  BlockStack,
  Box,
  Button,
  Card,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

/**
 * Stub /embedded/performance — dashboards de performance (impressions, clics,
 * conversions par canal) restent sur le standalone pour l'instant.
 */
export default function EmbeddedPerformancePage() {
  return (
    <Page>
      <TitleBar title="Performance" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Performance des canaux
              </Text>
              <Text variant="bodyMd" as="p">
                Suivez les impressions, clics, revenus et score qualité de
                chaque canal d'export depuis votre dashboard FeedPlug.
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Cette vue arrive bientôt directement dans Shopify Admin. En
                attendant, retrouvez vos métriques sur app.feedplug.com.
              </Text>
              <Box>
                <Button
                  variant="primary"
                  url="https://app.feedplug.com/fr/performance"
                  target="_blank"
                  accessibilityLabel="Ouvrir le tableau de bord performance sur app.feedplug.com (nouvel onglet)"
                >
                  Voir mes performances sur app.feedplug.com
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

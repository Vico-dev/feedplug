"use client";

import {
  Layout,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  LegacyCard as Card,
} from "@shopify/polaris";

/**
 * Loading state pendant les transitions de route /embedded/*.
 * Polaris SkeletonPage donne un placeholder cohérent avec le design système
 * Shopify Admin, ce qui améliore la perception de vitesse (clé pour BFS) et
 * évite le flash de contenu vide.
 */
export default function EmbeddedLoading() {
  return (
    <SkeletonPage primaryAction>
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <SkeletonDisplayText size="medium" />
            <div style={{ marginTop: 16 }}>
              <SkeletonBodyText lines={3} />
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card sectioned>
            <SkeletonBodyText lines={4} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

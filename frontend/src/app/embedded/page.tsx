"use client";

import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Link,
  List,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useEmbeddedFetch } from "./_components/use-embedded-fetch";
import { useEmbeddedLocale, useEmbeddedT } from "./_locale";

type CurrentSub = {
  active: boolean;
  planKey?: string;
  priceAmount?: number;
  currency?: string;
  status?: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  testMode?: boolean;
};

const LOCALE_TO_INTL: Record<"fr" | "en" | "es", string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
};

function formatDateLabel(value: string | null | undefined, locale: "fr" | "en" | "es"): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE_TO_INTL[locale], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Page d'accueil de l'app embedded FeedPlug dans Shopify Admin.
 *
 * Affiche selon l'état de la subscription :
 *  - Sub active → bandeau "Plan X active" + bouton "Manage subscription"
 *    (raccourci "Manage subscription" requis BFS).
 *  - Pas de sub → grille onboarding 3 étapes + CTA "Choose a plan".
 *
 * Tous les libellés passent par le hook useEmbeddedT() pour supporter FR/EN/ES
 * via le query param ?locale= envoyé par Shopify Admin.
 */
export default function EmbeddedHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopify = useAppBridge();
  const fetchApi = useEmbeddedFetch();
  const locale = useEmbeddedLocale();
  const t = useEmbeddedT();

  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);

  const refetchSub = useCallback(async () => {
    try {
      const response = await fetchApi("/billing/shopify/current");
      if (response.ok) {
        const body = (await response.json()) as CurrentSub;
        setCurrentSub(body);
      } else {
        setCurrentSub({ active: false });
      }
    } catch {
      setCurrentSub({ active: false });
    } finally {
      setSubLoaded(true);
    }
  }, [fetchApi]);

  useEffect(() => {
    void refetchSub();
  }, [refetchSub]);

  useEffect(() => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/embedded")) {
      router.replace(returnTo);
      return;
    }
    if (searchParams.get("billing") === "ok") {
      try {
        shopify.toast.show(
          locale === "en"
            ? "Shopify subscription confirmed. Welcome to FeedPlug."
            : locale === "es"
              ? "Suscripción de Shopify confirmada. Bienvenido a FeedPlug."
              : "Abonnement Shopify confirmé. Bienvenue sur FeedPlug.",
          { duration: 6000 }
        );
      } catch {
        // Bridge non disponible
      }
      const cleaned = new URLSearchParams(searchParams.toString());
      cleaned.delete("billing");
      const qs = cleaned.toString();
      router.replace(`/embedded${qs ? `?${qs}` : ""}`);
    }
  }, [searchParams, shopify, router, locale]);

  const subActive = currentSub?.active === true;
  const titleBarCta = subActive ? t("home.titleBar.manageSubscription") : t("home.titleBar.choosePlan");
  const planKey = currentSub?.planKey || "FeedPlug";

  return (
    <Page subtitle={t("home.subtitle")}>
      <TitleBar title="FeedPlug">
        <button
          variant="primary"
          onClick={() => router.push("/embedded/billing")}
        >
          {titleBarCta}
        </button>
        <a
          href="https://feedplug.com/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("nav.documentation")}
        </a>
      </TitleBar>
      <Layout>
        {/* Bandeau état de l'abonnement */}
        <Layout.Section>
          {!subLoaded ? (
            <Card>
              <InlineStack align="center" blockAlign="center" gap="300">
                <Spinner accessibilityLabel={t("home.sub.loading")} size="small" />
                <Text variant="bodySm" as="span" tone="subdued">
                  {t("home.sub.loading")}
                </Text>
              </InlineStack>
            </Card>
          ) : subActive ? (
            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap>
                <InlineStack gap="300" blockAlign="center" wrap>
                  <Badge tone="success">{currentSub?.status || "ACTIVE"}</Badge>
                  <BlockStack gap="050">
                    <Text variant="headingMd" as="h2">
                      {t("home.sub.activePlan", { planKey })}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {currentSub?.trialEndsAt
                        ? t("home.sub.trialEnds", { date: formatDateLabel(currentSub.trialEndsAt, locale) })
                        : ""}
                      {t("home.sub.nextRenewal", {
                        date: formatDateLabel(currentSub?.currentPeriodEnd, locale),
                      })}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Button onClick={() => router.push("/embedded/billing")}>
                  {t("home.sub.manageButton")}
                </Button>
              </InlineStack>
            </Card>
          ) : (
            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="050">
                  <Text variant="headingMd" as="h2">
                    {t("home.sub.noActive")}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    {t("home.sub.noActiveHint")}
                  </Text>
                </BlockStack>
                <Button variant="primary" onClick={() => router.push("/embedded/billing")}>
                  {t("home.sub.choosePlan")}
                </Button>
              </InlineStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                {t("home.welcome.heading")}
              </Text>
              <Text variant="bodyMd" as="p">
                {t("home.welcome.body")}
              </Text>
              <InlineStack gap="300" wrap>
                <Button
                  variant="primary"
                  onClick={() => router.push(subActive ? "/embedded/diagnostic" : "/embedded/billing")}
                >
                  {subActive ? t("home.welcome.diagnosticCta") : t("home.sub.choosePlan")}
                </Button>
                <Button onClick={() => router.push("/embedded/channels")}>
                  {t("home.welcome.channelsCta")}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                {t("home.steps.heading")}
              </Text>
              <List type="number">
                <List.Item>{t("home.steps.1")}</List.Item>
                <List.Item>{t("home.steps.2")}</List.Item>
                <List.Item>{t("home.steps.3")}</List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                {t("home.features.heading")}
              </Text>
              <InlineStack gap="400" wrap>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      {t("home.features.realTimeTitle")}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {t("home.features.realTimeBody")}
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      {t("home.features.diagnosticTitle")}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {t("home.features.diagnosticBody")}
                    </Text>
                  </BlockStack>
                </Box>
                <Box minWidth="200px">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      {t("home.features.mappingTitle")}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {t("home.features.mappingBody")}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Box paddingBlock="400">
            <Text variant="bodySm" as="p" tone="subdued" alignment="center">
              {t("home.help.label")}{" "}
              <Link url="mailto:support@feedplug.com">support@feedplug.com</Link>
            </Text>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

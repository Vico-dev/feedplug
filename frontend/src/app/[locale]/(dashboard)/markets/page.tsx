"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe2, Plus, RefreshCw } from "lucide-react";
import {
  DashboardSection,
  EmptyState,
  PageButtonPrimary,
  PageButtonSecondary,
  PageError,
  PageHeader,
  PageLayout,
  PageLoading,
} from "@/components/layout";
import { CreateMarketWizard } from "@/components/markets/create-market-wizard";
import { MarketCard } from "@/components/markets/market-card";
import { MarketReadinessPanel } from "@/components/markets/market-readiness-panel";
import { useAuth } from "@/hooks/use-auth";
import {
  createMarket,
  getMarkets,
  type CreateMarketPayload,
  type Market,
} from "@/lib/services/markets.service";

type ApiErrorMessage = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiErrorMessage;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
}

export default function MarketsPage() {
  const t = useTranslations("dashboard.markets");
  const common = useTranslations("dashboard.common");
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManageMarkets = user?.role === "OWNER" || user?.role === "MANAGER";

  const loadMarkets = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const items = await getMarkets();
      setMarkets(items);
      setError(null);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, t("loadError")));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMarkets(true);
  }, [loadMarkets]);

  async function handleCreateMarket(payload: CreateMarketPayload) {
    setSubmitting(true);
    setCreateError(null);
    try {
      await createMarket(payload);
      await loadMarkets(false);
      setCreateOpen(false);
    } catch (requestError: unknown) {
      setCreateError(getErrorMessage(requestError, t("createError")));
    } finally {
      setSubmitting(false);
    }
  }

  const sourceMarketNames = new Map(markets.map((market) => [market.id, market.name]));

  return (
    <PageLayout style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={Globe2}
        actions={(
          <>
            <PageButtonSecondary type="button" onClick={() => void loadMarkets(true)}>
              <RefreshCw size={16} />
              {common("refresh")}
            </PageButtonSecondary>
            {canManageMarkets && (
              <PageButtonPrimary
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen((current) => !current);
                }}
              >
                <Plus size={16} />
                {createOpen ? t("closeCreate") : t("create")}
              </PageButtonPrimary>
            )}
          </>
        )}
      />

      {error && <PageError message={error} onRetry={() => void loadMarkets(true)} />}

      {loading && markets.length === 0 ? (
        <PageLoading message={t("loading")} />
      ) : (
        <>
          <MarketReadinessPanel markets={markets} />

          {createOpen && canManageMarkets && (
            <CreateMarketWizard
              markets={markets}
              errorMessage={createError}
              isSubmitting={submitting}
              onCancel={() => {
                setCreateError(null);
                setCreateOpen(false);
              }}
              onCreate={handleCreateMarket}
            />
          )}

          <DashboardSection
            title={t("portfolioTitle")}
            description={t("portfolioDescription")}
            actions={canManageMarkets && markets.length > 0 && !createOpen ? (
              <PageButtonSecondary
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
              >
                <Plus size={16} />
                {t("create")}
              </PageButtonSecondary>
            ) : undefined}
          >
            {markets.length === 0 ? (
              <EmptyState
                icon={Globe2}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={canManageMarkets ? (
                  <PageButtonPrimary
                    type="button"
                    onClick={() => {
                      setCreateError(null);
                      setCreateOpen(true);
                    }}
                  >
                    <Plus size={16} />
                    {t("create")}
                  </PageButtonPrimary>
                ) : undefined}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
                {markets.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    sourceMarketName={market.sourceMarketId ? sourceMarketNames.get(market.sourceMarketId) ?? null : null}
                  />
                ))}
              </div>
            )}
          </DashboardSection>
        </>
      )}
    </PageLayout>
  );
}

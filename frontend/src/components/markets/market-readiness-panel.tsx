"use client";

import { AlertTriangle, Globe2, Layers3, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardStatCard, DashboardStatGrid, PageCard } from "@/components/layout";
import type { Market } from "@/lib/services/markets.service";

type MarketReadinessPanelProps = {
  markets: Market[];
};

export function MarketReadinessPanel({ markets }: MarketReadinessPanelProps) {
  const t = useTranslations("dashboard.markets");

  const totalMarkets = markets.length;
  const readyMarkets = markets.filter((market) => market.readiness.status === "ready").length;
  const actionRequiredMarkets = markets.filter((market) => market.readiness.status === "action_required").length;
  const totalDestinations = markets.reduce((sum, market) => sum + market.readiness.destinationCount, 0);
  const draftMarkets = markets.filter((market) => market.readiness.status === "draft" || market.readiness.status === "in_progress").length;

  let nextStep = t("summaryNoMarkets");
  if (actionRequiredMarkets > 0) {
    nextStep = t("summaryNextActionRequired");
  } else if (draftMarkets > 0) {
    nextStep = t("summaryNextDraft");
  } else if (totalMarkets > 0) {
    nextStep = t("summaryNextReady");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <DashboardStatGrid>
        <DashboardStatCard
          icon={<Globe2 size={18} />}
          label={t("summaryTotal")}
          value={totalMarkets}
          hint={t("summaryTotalHint")}
          accent="var(--ink)"
        />
        <DashboardStatCard
          icon={<Rocket size={18} />}
          label={t("summaryReady")}
          value={readyMarkets}
          hint={t("summaryReadyHint")}
          accent="var(--ink)"
        />
        <DashboardStatCard
          icon={<AlertTriangle size={18} />}
          label={t("summaryActionRequired")}
          value={actionRequiredMarkets}
          hint={t("summaryActionRequiredHint")}
          accent="var(--ink)"
        />
        <DashboardStatCard
          icon={<Layers3 size={18} />}
          label={t("summaryDestinations")}
          value={totalDestinations}
          hint={t("summaryDestinationsHint")}
          accent="var(--ink)"
        />
      </DashboardStatGrid>

      <PageCard style={{ padding: 20 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--app-accent)" }}>
          {t("summaryNextStepLabel")}
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 18, lineHeight: 1.4, color: "var(--app-text)", letterSpacing: "-0.02em" }}>
          {nextStep}
        </p>
      </PageCard>
    </div>
  );
}

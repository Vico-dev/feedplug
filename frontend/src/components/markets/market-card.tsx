"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe2, Languages, Rocket, Store } from "lucide-react";
import { PageCard, StatusBadge } from "@/components/layout";
import { formatLocaleLabel, getPlatformLabel, platformRequiresConnection } from "@/lib/markets";
import type { Market } from "@/lib/services/markets.service";

type MarketCardProps = {
  market: Market;
  sourceMarketName?: string | null;
};

function getReadinessVariant(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "ready") return "success";
  if (status === "action_required") return "warning";
  if (status === "in_progress") return "neutral";
  return "neutral";
}

export function MarketCard({ market, sourceMarketName }: MarketCardProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard.markets");
  const localeLabels = market.locales.map((entry) => formatLocaleLabel(locale, entry.localeCode));
  const readinessLabels: Record<string, string> = {
    draft: t("statusDraft"),
    in_progress: t("statusInProgress"),
    ready: t("statusReady"),
    action_required: t("statusActionRequired"),
  };
  const readinessLabel = readinessLabels[market.readiness.status] ?? market.readiness.status;

  return (
    <PageCard
      style={{
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--app-text)" }}>
              {market.name}
            </h3>
            <StatusBadge variant={getReadinessVariant(market.readiness.status)}>{readinessLabel}</StatusBadge>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--app-text-muted)" }}>
            {market.code} · {market.defaultCurrencyCode}
            {sourceMarketName ? ` · ${t("cardSource")}: ${sourceMarketName}` : ""}
          </p>
        </div>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: "rgba(14, 165, 233, 0.12)",
            color: "var(--accent-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Globe2 size={20} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 16, backgroundColor: "rgba(2,132,199,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent-2)" }}>
            <Languages size={16} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("cardLocales")}</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 24, fontWeight: 700, color: "var(--app-text)" }}>{market.readiness.localeCount}</p>
        </div>

        <div style={{ padding: 14, borderRadius: 16, backgroundColor: "rgba(16,185,129,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)" }}>
            <Store size={16} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("cardChannels")}</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 24, fontWeight: 700, color: "var(--app-text)" }}>{market.readiness.channelCount}</p>
        </div>

        <div style={{ padding: 14, borderRadius: 16, backgroundColor: "rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-2)" }}>
            <Rocket size={16} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("cardDestinations")}</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 24, fontWeight: 700, color: "var(--app-text)" }}>{market.readiness.destinationCount}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {localeLabels.map((label, index) => (
          <StatusBadge key={`${market.id}-locale-${index}`} variant={index === 0 ? "success" : "neutral"}>
            {label}
          </StatusBadge>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {market.channels.map((channel) => {
          const requiresConnection = platformRequiresConnection(channel.platformKey);
          const isConnected = !requiresConnection || Boolean(channel.platformAccountId);
          return (
            <div
              key={channel.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                padding: "13px 14px",
                borderRadius: 14,
                border: "1px solid var(--app-border)",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text)" }}>{getPlatformLabel(channel.platformKey)}</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: "var(--app-text-muted)" }}>
                  {isConnected
                    ? channel.platformAccountName || channel.platformAccountExternalId || t("cardAccountConnected")
                    : t("cardAccountMissing")}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <StatusBadge variant={isConnected ? "success" : "warning"}>
                  {isConnected ? t("cardAccountConnected") : t("cardNeedsAttention")}
                </StatusBadge>
                <StatusBadge variant="neutral">{channel.destinations.length}</StatusBadge>
              </div>
            </div>
          );
        })}
      </div>

      {market.readiness.status === "ready" ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: "rgba(16,185,129,0.1)",
            color: "var(--success)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t("cardLaunchReady")}
        </div>
      ) : market.readiness.missingConnections > 0 ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: "rgba(245,158,11,0.12)",
            color: "var(--warning)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t("cardMissingConnections", { count: market.readiness.missingConnections })}
        </div>
      ) : null}
    </PageCard>
  );
}

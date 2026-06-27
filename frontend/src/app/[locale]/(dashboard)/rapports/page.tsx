"use client";

import { BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import {
  EmptyState,
  PageHeader,
  PageLayout,
} from "@/components/layout";

/**
 * Rapports — état "Bientôt disponible".
 *
 * PRÉ-LAUNCH : l'ancienne page affichait 100 % de données fictives codées en dur
 * (flowPerformances / abTestResults, graphiques placeholder, tests A/B factices).
 * On ne ship PAS de fausses données. La page est donc remplacée par un état
 * coming-soon propre, qui renvoie l'utilisateur vers la page Performance (vraies
 * métriques par canal, alimentées par PerformanceChannel via la sync auto régies).
 *
 * Le backend complet des rapports (services, agrégations, tests A/B réels) reste
 * à construire ; les composants ReportBuilder / ReportTemplates et les types
 * associés sont conservés dans le repo (components/reports/*) pour ce build futur.
 */
export default function RapportsPage() {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const localePrefix = getLocalePrefixFromPathname(pathname);

  return (
    <PageLayout>
      <PageHeader
        title={t("rapports.title")}
        subtitle={t("rapports.subtitle")}
      />

      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <EmptyState
          icon={BarChart3}
          title={t("rapports.comingSoonTitle")}
          description={t("rapports.comingSoonBody")}
          style={{ maxWidth: 560 }}
          action={
            <Link
              href={`${localePrefix}/performance`}
              prefetch={false}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 40,
                padding: "0 16px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: "var(--app-text)",
                color: "#ffffff",
                textDecoration: "none",
              }}
            >
              {t("rapports.comingSoonCta")}
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          }
        />
      </div>
    </PageLayout>
  );
}

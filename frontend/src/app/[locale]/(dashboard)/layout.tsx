"use client";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-provider";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { OnboardingProvider, useOnboarding } from "@/contexts/onboarding-context";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { appendShopifyEmbeddedParams } from "@/lib/shopify-navigation";
import { readSessionApiCache, SESSION_API_CACHE_KEYS, writeSessionApiCache } from "@/lib/session-api-cache";
import { usePathname } from "next/navigation";
import "@/utils/debug-onboarding";

const DASHBOARD_BOOTSTRAP_CACHE_TTL_MS = 2 * 60 * 1000;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <SidebarProvider>
        <LayoutContent>{children}</LayoutContent>
      </SidebarProvider>
    </OnboardingProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const t = useTranslations("dashboard");
  const { isCollapsed, isMobile } = useSidebar();
  const {
    startOnboarding,
    dismissWelcomeBanner,
    setOnboardingFromServer,
    markServerWelcomeLoaded,
    registerPersistWelcomeBanner,
    registerPersistTourCompleted,
    shouldShowWelcomeBanner,
  } = useOnboarding();
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const pathname = usePathname();
  const [locationSearch, setLocationSearch] = useState("");
  const localePrefix = getLocalePrefixFromPathname(pathname);

  const replaceBrowserUrl = useCallback((nextUrl: string) => {
    if (typeof window === "undefined") return;
    const next = new URL(nextUrl, window.location.origin);
    const nextPathAndSearch = `${next.pathname}${next.search}`;
    const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
    if (currentPathAndSearch !== nextPathAndSearch) {
      window.history.replaceState(window.history.state, "", nextPathAndSearch);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncSearch = () => setLocationSearch(window.location.search);
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, []);

  // Synchroniser onboarding avec le backend (bannière + visite guidée terminée, une fois par compte)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const cachedProgress = readSessionApiCache<{ collectedData?: { hasSeenWelcomeBanner?: boolean; tourCompleted?: boolean } }>(
          SESSION_API_CACHE_KEYS.onboardingProgress,
          DASHBOARD_BOOTSTRAP_CACHE_TTL_MS
        );
        if (cachedProgress) {
          setOnboardingFromServer({
            hasSeenWelcomeBanner: !!cachedProgress.collectedData?.hasSeenWelcomeBanner,
            tourCompleted: !!cachedProgress.collectedData?.tourCompleted,
          });
          return;
        }
        const res = await apiClient.get<{ collectedData?: { hasSeenWelcomeBanner?: boolean; tourCompleted?: boolean } }>("/onboarding/progress");
        if (!cancelled && res.data) {
          writeSessionApiCache(SESSION_API_CACHE_KEYS.onboardingProgress, res.data);
          const cd = res.data.collectedData;
          setOnboardingFromServer({
            hasSeenWelcomeBanner: !!cd?.hasSeenWelcomeBanner,
            tourCompleted: !!cd?.tourCompleted,
          });
        }
      } catch {
        markServerWelcomeLoaded();
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, setOnboardingFromServer, markServerWelcomeLoaded]);

  useEffect(() => {
    registerPersistWelcomeBanner(() => {
      apiClient.put("/onboarding/progress", { collectedData: { hasSeenWelcomeBanner: true } }).then(() => {
        const current = readSessionApiCache<{ collectedData?: { hasSeenWelcomeBanner?: boolean; tourCompleted?: boolean } }>(
          SESSION_API_CACHE_KEYS.onboardingProgress,
          Number.MAX_SAFE_INTEGER
        ) || {};
        writeSessionApiCache(SESSION_API_CACHE_KEYS.onboardingProgress, {
          ...current,
          collectedData: {
            ...(current.collectedData || {}),
            hasSeenWelcomeBanner: true,
          },
        });
      }).catch(() => {});
    });
  }, [registerPersistWelcomeBanner]);

  useEffect(() => {
    registerPersistTourCompleted(() => {
      apiClient.put("/onboarding/progress", { collectedData: { tourCompleted: true } }).then(() => {
        const current = readSessionApiCache<{ collectedData?: { hasSeenWelcomeBanner?: boolean; tourCompleted?: boolean } }>(
          SESSION_API_CACHE_KEYS.onboardingProgress,
          Number.MAX_SAFE_INTEGER
        ) || {};
        writeSessionApiCache(SESSION_API_CACHE_KEYS.onboardingProgress, {
          ...current,
          collectedData: {
            ...(current.collectedData || {}),
            tourCompleted: true,
          },
        });
      }).catch(() => {});
    });
  }, [registerPersistTourCompleted]);

  // Lancer la visite guidée si l'utilisateur arrive depuis la page onboarding avec ?startTour=1
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    const currentSearchParams = new URLSearchParams(locationSearch);
    if (currentSearchParams.get("startTour") === "1") {
      startOnboarding();
      const basePath = pathname || `${localePrefix || ""}/dashboard`;
      replaceBrowserUrl(appendShopifyEmbeddedParams(basePath, currentSearchParams));
    }
  }, [isAuthenticated, isLoading, locationSearch, pathname, replaceBrowserUrl, startOnboarding, localePrefix]);

  // Track Stripe checkout success
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    const currentSearchParams = new URLSearchParams(locationSearch);
    if (currentSearchParams.get("checkout") === "success") {
      const basePath = pathname || `${localePrefix || ""}/dashboard`;
      refreshUser()
        .catch(() => {})
        .finally(() => {
          replaceBrowserUrl(appendShopifyEmbeddedParams(basePath, currentSearchParams));
        });
    }
  }, [isAuthenticated, isLoading, locationSearch, pathname, replaceBrowserUrl, localePrefix, refreshUser]);

  // Protection d'authentification
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentSearch = typeof window !== "undefined" ? window.location.search : locationSearch;
      window.location.replace(appendShopifyEmbeddedParams(`${localePrefix}/login`, currentSearch));
    }
  }, [isAuthenticated, isLoading, localePrefix, locationSearch]);

  useEffect(() => {
    if (!user || isLoading || !isAuthenticated || user.isStaff) return;
    const currentSearchParams = new URLSearchParams(locationSearch);
    if (currentSearchParams.get("checkout") === "success") return;
    const now = Date.now();
    const billingStatus = String(user.billingStatus || "").toLowerCase();
    const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const paymentGraceUntil = user.paymentGraceUntil ? new Date(user.paymentGraceUntil) : null;
    const graceStillActive = !!paymentGraceUntil && paymentGraceUntil.getTime() > now;
    const trialExpired = !!trialEndsAt && trialEndsAt.getTime() <= now;
    const paymentWindowExpired =
      (billingStatus === "pending" || billingStatus === "payment_failed") && !graceStillActive;

    if (paymentWindowExpired || (billingStatus !== "pending" && billingStatus !== "payment_failed" && trialExpired)) {
      const currentSearch = typeof window !== "undefined" ? window.location.search : locationSearch;
      window.location.replace(appendShopifyEmbeddedParams(`${localePrefix}/choose-plan`, currentSearch));
    }
  }, [user, isLoading, isAuthenticated, localePrefix, locationSearch]);

  // Warm the company info cache, but don't trigger hidden route transitions from the dashboard shell.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !pathname) return;
    const onOnboarding = pathname.includes('/onboarding');
    if (onOnboarding) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cachedCompanyInfoStatus = readSessionApiCache<{ hasCompletedCompanyInfo: boolean }>(
          SESSION_API_CACHE_KEYS.companyInfoStatus,
          DASHBOARD_BOOTSTRAP_CACHE_TTL_MS
        );
        if (cachedCompanyInfoStatus) return;
        const res = await apiClient.get<{ hasCompletedCompanyInfo: boolean }>('/account/company-info');
        if (!cancelled && res.data) {
          writeSessionApiCache(SESSION_API_CACHE_KEYS.companyInfoStatus, res.data);
        }
      } catch {
        // Ne pas bloquer si l'API échoue (ex. colonnes pas encore migrées)
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated, pathname]);

  // Afficher un loader pendant la vérification d'authentification
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fbf8 0%, var(--app-bg) 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--spinner-track)',
            borderTop: '4px solid var(--spinner-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Ne rien afficher si pas authentifié (redirection en cours)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className="dashboard-layout-root"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8faf7 0%, #f2f5f1 100%)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .dashboard-layout-main {
          flex: 1;
          transition: margin-left 0.3s ease;
          margin-left: 88px;
          min-height: 100vh;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .dashboard-layout-main.expanded { margin-left: 272px; }
        @media (max-width: 768px) {
          .dashboard-layout-main { margin-left: 0 !important; }
        }
      `}} />
      <Sidebar />
      <div
        className={`dashboard-layout-main ${!isMobile && !isCollapsed ? 'expanded' : ''}`}
      >
        <Header />
        <main style={{ 
          flex: 1, 
          overflow: 'auto',
          minWidth: 0,
          background: 'transparent',
          paddingBottom: '24px'
        }}>
          {children}
        </main>
      </div>

      {/* Onboarding Components */}
      {shouldShowWelcomeBanner() && (
        <WelcomeBanner
          onStartOnboarding={startOnboarding}
          onDismiss={dismissWelcomeBanner}
        />
      )}
      
          <OnboardingTour />
    </div>
  );
}

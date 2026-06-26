"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { useAuth } from "@/hooks/use-auth";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { useEffect } from "react";
import {
  getDashboardNavigation,
  getNormalizedDashboardPath,
  isDashboardItemActive,
} from "@/components/layout/dashboard-navigation";

const SIDEBAR_MOBILE_BREAKPOINT = 768;

function getInitials(name?: string, firstName?: string, lastName?: string, email?: string) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return (email?.slice(0, 2) ?? "FP").toUpperCase();
}

export function Sidebar() {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const { isCollapsed, toggle, mobileOpen, setMobileOpen, isMobile } = useSidebar();
  const { user } = useAuth();
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const normalizedPathname = getNormalizedDashboardPath(pathname, localePrefix);
  const filteredNavigation = getDashboardNavigation(user?.isStaff, t);
  const showExpanded = isMobile || !isCollapsed;
  const closeMobile = () => setMobileOpen(false);
  const navGroups = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "data", label: "Données" },
    { key: "preparation", label: "Préparation" },
    { key: "diffusion", label: "Diffusion" },
    { key: "analysis", label: "Analyse" },
    { key: "account", label: "Compte" },
    { key: "admin", label: "Administration" },
  ]
    .map((group) => ({ ...group, items: filteredNavigation.filter((item) => item.group === group.key) }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }, [pathname, mobileOpen, setMobileOpen]);

  const initials = getInitials(user?.account?.name, user?.firstName, user?.lastName, user?.email);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: ${SIDEBAR_MOBILE_BREAKPOINT}px) {
              .dashboard-sidebar {
                width: min(88vw, 304px) !important;
                transform: translateX(-105%);
                box-shadow: none;
                z-index: 70;
              }
              .dashboard-sidebar.mobile-open {
                transform: translateX(0);
                box-shadow: var(--app-shadow-lg);
              }
              .dashboard-sidebar-toggle-btn {
                display: none !important;
              }
            }
            @media (min-width: ${SIDEBAR_MOBILE_BREAKPOINT + 1}px) {
              .dashboard-sidebar-backdrop {
                display: none !important;
              }
            }
          `,
        }}
      />

      <div
        className="dashboard-sidebar-backdrop"
        aria-hidden="true"
        onClick={closeMobile}
        style={{
          display: isMobile && mobileOpen ? "block" : "none",
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(10, 10, 10, 0.32)",
          zIndex: 60,
        }}
      />

      <aside
        className={`dashboard-sidebar ${mobileOpen ? "mobile-open" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          width: showExpanded ? 272 : 88,
          padding: 14,
          background: "var(--surface)",
          borderRight: "1px solid var(--line)",
          transition: "width var(--d-base) var(--ease), transform var(--d-base) var(--ease), box-shadow var(--d-base) var(--ease)",
          overflow: "hidden",
          boxShadow: "none",
          zIndex: 70,
        }}
      >
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Fermer le menu"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 38,
              height: 38,
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              background: "var(--surface)",
              color: "var(--ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: showExpanded ? "stretch" : "center",
            minHeight: 76,
            padding: showExpanded ? "6px 6px 18px" : "6px 0 18px",
            gap: 12,
          }}
        >
          <a
            href={`${localePrefix}/dashboard`}
            onClick={closeMobile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              textDecoration: "none",
              minWidth: 0,
              width: "100%",
              justifyContent: showExpanded ? "flex-start" : "center",
              padding: showExpanded ? "8px 10px" : "8px 0",
              borderRadius: 16,
            }}
            aria-label="FeedPlug — retour au dashboard"
          >
            {showExpanded && (
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--ink)",
                  letterSpacing: "-0.025em",
                }}
              >
                FeedPlug
              </p>
            )}
          </a>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: showExpanded ? 4 : 0,
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {navGroups.map((group) => (
              <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {showExpanded && (
                  <p
                    style={{
                      margin: "0 10px 4px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--ink-3)",
                    }}
                  >
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const isActive = isDashboardItemActive(normalizedPathname, item.href);

                  return (
                    <a
                      key={item.nameKey}
                      href={`${localePrefix}${item.href}`}
                      onClick={closeMobile}
                      title={!showExpanded ? item.label : undefined}
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: showExpanded ? "space-between" : "center",
                        gap: 12,
                        minHeight: 44,
                        padding: showExpanded ? "0 14px 0 16px" : "0",
                        borderRadius: "var(--r-lg)",
                        textDecoration: "none",
                        color: isActive ? "var(--ink)" : "var(--ink-3)",
                        background: isActive ? "var(--paper-2)" : "transparent",
                        border: "1px solid transparent",
                        boxShadow: "none",
                        fontFamily: "var(--font-sans)",
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        letterSpacing: "-0.005em",
                        transition: "background var(--d-fast) var(--ease), color var(--d-fast) var(--ease)",
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: 6,
                            top: 10,
                            bottom: 10,
                            width: 3,
                            borderRadius: 999,
                            backgroundColor: "var(--accent)",
                          }}
                        />
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <item.icon
                          style={{
                            width: 17,
                            height: 17,
                            color: isActive ? "var(--ink)" : "var(--ink-3)",
                            flexShrink: 0,
                          }}
                        />
                        {showExpanded && (
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                      </div>

                      {showExpanded && item.badge && (
                        <span
                          style={{
                            minWidth: 22,
                            height: 22,
                            padding: "0 7px",
                            borderRadius: 999,
                            backgroundColor: isActive ? "var(--accent)" : "var(--paper-3)",
                            color: isActive ? "#ffffff" : "var(--ink-3)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div
          style={{
            marginTop: 12,
            padding: showExpanded ? "12px 14px" : "10px 0",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
            backgroundColor: "var(--paper-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: showExpanded ? "space-between" : "center",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--r-md)",
                backgroundColor: "var(--ink)",
                color: "var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            {showExpanded && (
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                  }}
                >
                  Session
                </p>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 160,
                  }}
                >
                  {user?.email ?? ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Toggle de rétraction — HORS de l'aside (qui a overflow:hidden, ce qui
          rognait le bouton en deux). En position fixed, calé sur le bord droit
          de la sidebar selon sa largeur. Masqué en mobile via la classe. */}
      <button
        type="button"
        className="dashboard-sidebar-toggle-btn feedplug-focus-ring"
        onClick={toggle}
        aria-label={isCollapsed ? "Etendre la navigation" : "Reduire la navigation"}
        style={{
          position: "fixed",
          top: 28,
          left: (showExpanded ? 272 : 88) - 14,
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "1px solid var(--line)",
          backgroundColor: "var(--surface)",
          boxShadow: "var(--sh-md)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 71,
          transition: "left var(--d-base) var(--ease)",
        }}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </>
  );
}

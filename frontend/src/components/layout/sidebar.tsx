"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Image from "next/image";
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
  const workspaceItems = filteredNavigation.filter((item) => item.section === "workspace");
  const adminItems = filteredNavigation.filter((item) => item.section === "admin");

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
          backgroundColor: "rgba(15, 23, 42, 0.36)",
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
          background: "#ffffff",
          borderRight: "1px solid rgba(15, 23, 42, 0.08)",
          transition: "width 0.28s ease, transform 0.24s ease, box-shadow 0.24s ease",
          overflow: "hidden",
          boxShadow: "6px 0 24px rgba(15, 23, 42, 0.04)",
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
              border: "1px solid var(--app-border)",
              borderRadius: 12,
              background: "#fff",
              color: "var(--app-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        )}

        <button
          type="button"
          className="dashboard-sidebar-toggle-btn feedplug-focus-ring"
          onClick={toggle}
          aria-label={isCollapsed ? "Etendre la navigation" : "Reduire la navigation"}
          style={{
            position: "absolute",
            right: -14,
            top: 28,
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid rgba(15, 23, 42, 0.08)",
            backgroundColor: "#ffffff",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
            color: "var(--app-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 5,
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

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
              gap: showExpanded ? 12 : 0,
              textDecoration: "none",
              minWidth: 0,
              width: "100%",
              justifyContent: showExpanded ? "flex-start" : "center",
              padding: showExpanded ? "8px 10px" : "8px 0",
              borderRadius: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: "var(--app-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--app-shadow-sm)",
                flexShrink: 0,
              }}
            >
              <Image src="/icon" alt="FeedPlug" width={22} height={22} style={{ display: "block" }} />
            </div>

            {showExpanded && (
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--app-text)",
                    letterSpacing: "-0.03em",
                  }}
                >
                  FeedPlug
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--app-text-muted)" }}>
                  Navigation
                </p>
              </div>
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
            {[
              { key: "workspace", label: "Workspace", items: workspaceItems },
              ...(adminItems.length ? [{ key: "admin", label: "Administration", items: adminItems }] : []),
            ].map((group) => (
              <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {showExpanded && (
                  <p
                    style={{
                      margin: "0 10px 4px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--app-text-soft)",
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
                        minHeight: 48,
                        padding: showExpanded ? "0 14px 0 16px" : "0",
                        borderRadius: 16,
                        textDecoration: "none",
                        color: isActive ? "var(--app-text)" : "var(--app-text-muted)",
                        background: isActive ? "rgba(15, 118, 110, 0.10)" : "transparent",
                        border: isActive ? "1px solid rgba(15, 118, 110, 0.14)" : "1px solid transparent",
                        boxShadow: "none",
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: 8,
                            top: 10,
                            bottom: 10,
                            width: 3,
                            borderRadius: 999,
                            backgroundColor: "var(--app-accent-strong)",
                          }}
                        />
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <item.icon
                          style={{
                            width: 17,
                            height: 17,
                            color: isActive ? "var(--app-accent-strong)" : "var(--app-text-muted)",
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
                            backgroundColor: isActive ? "var(--app-accent-strong)" : "#eef2ef",
                            color: isActive ? "#fff" : "var(--app-text-muted)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
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
            borderRadius: 18,
            border: "1px solid rgba(15, 23, 42, 0.06)",
            backgroundColor: "#f7f9f6",
            display: "flex",
            alignItems: "center",
            justifyContent: showExpanded ? "space-between" : "center",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                backgroundColor: "var(--app-text)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            {showExpanded && (
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--app-text)" }}>
                  Session active
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: "var(--app-text-muted)",
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
    </>
  );
}

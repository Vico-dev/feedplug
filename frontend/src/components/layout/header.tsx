"use client";

import { ChevronDown, CircleHelp, CreditCard, LogOut, Menu, PlayCircle, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/contexts/onboarding-context";
import { usePathname } from "next/navigation";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";

const HEADER_MOBILE_BREAKPOINT = 768;

const iconButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "var(--r-lg)",
  border: "1px solid var(--line)",
  backgroundColor: "var(--surface)",
  color: "var(--ink-3)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "border-color var(--d-fast) var(--ease), color var(--d-fast) var(--ease)",
};

function getInitials(firstName?: string, lastName?: string, email?: string) {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return (email?.slice(0, 2) ?? "U").toUpperCase();
}

export function Header() {
  const { toggleMobile } = useSidebar();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const { startOnboarding } = useOnboarding();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const localePrefix = getLocalePrefixFromPathname(pathname);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const accountLabel =
    user?.account?.name?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Mon compte";

  return (
    <header
      className="dashboard-shell-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 45,
        width: "100%",
        padding: "12px 18px 0",
        background: "transparent",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .dashboard-header-inner {
              display: flex;
              align-items: center;
              justify-content: flex-end;
              gap: 12px;
              min-height: 52px;
              padding: 0;
            }
            .dashboard-header-desktop {
              display: none;
            }
            @media (min-width: ${HEADER_MOBILE_BREAKPOINT + 1}px) {
              .dashboard-shell-header {
                display: none !important;
              }
            }
            @media (max-width: ${HEADER_MOBILE_BREAKPOINT}px) {
              .dashboard-shell-header {
                padding: 12px 14px 0 !important;
              }
              .dashboard-header-desktop {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-left: auto;
              }
              .dashboard-header-account-name {
                max-width: 108px;
              }
            }
          `,
        }}
      />

      <div className="dashboard-header-inner">
        <button
          type="button"
          className="feedplug-focus-ring"
          aria-label="Ouvrir le menu"
          onClick={toggleMobile}
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--line-strong)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--line)";
            e.currentTarget.style.color = "var(--ink-3)";
          }}
        >
          <Menu style={{ width: 18, height: 18 }} />
        </button>

        <div className="dashboard-header-desktop">
          <NotificationCenter />

          <button
            type="button"
            onClick={startOnboarding}
            aria-label="Relancer le guide"
            className="feedplug-focus-ring"
            style={iconButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "var(--app-border-strong)";
              e.currentTarget.style.color = "var(--app-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "var(--app-border)";
              e.currentTarget.style.color = "var(--app-text-muted)";
            }}
          >
            <CircleHelp style={{ width: 18, height: 18 }} />
          </button>

          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowUserMenu((current) => !current)}
              className="feedplug-focus-ring"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 42,
                padding: "4px 10px 4px 4px",
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--line)",
                backgroundColor: "var(--surface)",
                color: "var(--ink)",
                cursor: "pointer",
                transition: "border-color var(--d-fast) var(--ease)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--line-strong)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--line)";
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--r-md)",
                  backgroundColor: "var(--ink)",
                  color: "var(--paper)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  flexShrink: 0,
                }}
              >
                {getInitials(user?.firstName, user?.lastName, user?.email)}
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                <span
                  className="dashboard-header-account-name"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 180,
                  }}
                >
                  {accountLabel}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 180,
                  }}
                >
                  {user?.email ?? ""}
                </span>
              </div>

              <ChevronDown style={{ width: 16, height: 16, color: "var(--ink-4)", flexShrink: 0 }} />
            </button>

            {showUserMenu && (
              <div
                className="feedplug-shell-card"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 10px)",
                  width: 260,
                  padding: 10,
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-xl)",
                  boxShadow: "var(--sh-lg)",
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: "var(--r-md)",
                    backgroundColor: "var(--paper-2)",
                    marginBottom: 8,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
                    {user?.email ?? ""}
                  </p>
                </div>

                {[
                  { href: "/parametres", label: "Parametres", icon: Settings },
                  { href: "/facturation", label: "Facturation", icon: CreditCard },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={`${localePrefix}${item.href}`}
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 42,
                      padding: "0 12px",
                      borderRadius: "var(--r-md)",
                      textDecoration: "none",
                      color: "var(--ink)",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    <item.icon style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
                    {item.label}
                  </a>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    startOnboarding();
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 42,
                    padding: "0 12px",
                    borderRadius: "var(--r-md)",
                    border: "none",
                    background: "transparent",
                    color: "var(--ink)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <PlayCircle style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
                  Revoir le guide
                </button>

                <button
                  type="button"
                  onClick={logout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 42,
                    padding: "0 12px",
                    borderRadius: "var(--r-md)",
                    border: "none",
                    background: "transparent",
                    color: "var(--danger)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <LogOut style={{ width: 16, height: 16 }} />
                  Deconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

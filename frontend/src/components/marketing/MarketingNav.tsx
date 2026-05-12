"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Lock, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_SOLUTIONS, NAV_FONCTIONNALITES } from "@/lib/nav-marketing";

const NAV_SOLUTION_KEYS: Record<string, string> = {
  "google-shopping": "solutionsGoogleShopping",
  amazon: "solutionsAmazon",
  cdiscount: "solutionsCdiscount",
  rakuten: "solutionsRakuten",
  "assistants-ia": "solutionsAssistantsIa",
};
const NAV_FEATURE_KEYS: Record<string, string> = {
  "enrichissement-ia": "featuresEnrichissementIa",
  "diffusion-canaux": "featuresDiffusionCanaux",
  "traduction-flux": "featuresTraductionFlux",
  analytics: "featuresAnalytics",
  "ab-testing": "featuresAbTesting",
};

function getFonctionnaliteHref(hash: string, locale: string): string {
  const base = locale === "fr" ? "/fr" : `/${locale}`;
  return `${base}#${hash}`;
}

const navLinkLight = {
  textDecoration: "none",
  color: "var(--ink-2)",
  fontSize: 14,
  fontWeight: 400,
  letterSpacing: "0.01em",
} as const;

const navLinkDark = {
  textDecoration: "none",
  color: "rgba(255,255,255,0.7)",
  fontSize: 14,
  fontWeight: 400,
  letterSpacing: "0.01em",
} as const;

type MarketingNavProps = {
  /** Sur les LP, on masque "Accueil" si false pour éviter redondance avec le logo */
  showHome?: boolean;
  /** Locale pour les liens Fonctionnalités et Accueil (défaut: fr). LP pages n'ont pas [locale]. */
  locale?: string;
  /** Dark mode (transparent header on hero) */
  dark?: boolean;
};

export default function MarketingNav({ showHome = true, locale = "fr", dark = false }: MarketingNavProps) {
  const t = useTranslations("nav");
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [fonctionnalitesOpen, setFonctionnalitesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const homeHref = `/${locale === "fr" ? "fr" : locale}`;
  const demoHref = `${locale === "fr" ? "" : `/${locale}`}/demo`;

  // Fermer les dropdowns au clic extérieur (mobile + desktop)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setSolutionsOpen(false);
        setFonctionnalitesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fermer le menu mobile au resize desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) setMobileOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Bloquer le scroll du body quand le menu mobile est ouvert
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .marketing-nav-link {
          position: relative;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .marketing-nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 1px;
          background: #0a0a0a;
          transition: width 0.2s ease;
        }
        .marketing-nav-link:hover { color: #0a0a0a; }
        .marketing-nav-link:hover::after { width: 100%; }
        .marketing-nav-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 0;
          padding-top: 8px;
          min-width: 240px;
          z-index: 1001;
        }
        .marketing-nav-dropdown > div {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          padding: 8px 0;
        }
        .marketing-nav-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          font-size: 14px;
          color: var(--ink-2);
          text-decoration: none;
          transition: background 0.15s;
        }
        .marketing-nav-dropdown-item:hover {
          background: var(--paper-2);
          color: #0a0a0a;
        }
        .marketing-nav-dropdown-item.disabled {
          color: var(--ink-4);
          cursor: not-allowed;
          pointer-events: none;
        }
        .marketing-nav-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 400;
          color: var(--ink-2);
          cursor: pointer;
          transition: color 0.2s;
        }
        .marketing-nav-trigger:hover { color: #0a0a0a; }
        @media (max-width: 768px) {
          .marketing-nav-desktop { display: none !important; }
          .marketing-nav-mobile-toggle {
            display: flex !important;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            min-width: 48px;
            min-height: 48px;
            padding: 12px;
            border-radius: 10px;
            -webkit-tap-highlight-color: transparent;
          }
          .marketing-nav-mobile-toggle:active { background: var(--paper-2); }
        }
        @media (min-width: 769px) {
          .marketing-nav-mobile-toggle { display: none !important; }
          .marketing-nav-overlay { display: none !important; }
        }
        .marketing-nav-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #fff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .marketing-nav-overlay-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          padding: 0 16px 0 20px;
          border-bottom: 1px solid var(--line);
          background: #fff;
        }
        .marketing-nav-overlay-close {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          color: #0a0a0a;
          cursor: pointer;
          border-radius: 10px;
          -webkit-tap-highlight-color: transparent;
        }
        .marketing-nav-overlay-close:active { background: var(--paper-2); }
        .marketing-nav-overlay-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 20px 32px;
          -webkit-overflow-scrolling: touch;
        }
        .marketing-nav-overlay-section {
          margin-bottom: 28px;
        }
        .marketing-nav-overlay-section-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .marketing-nav-overlay-link {
          display: flex;
          align-items: center;
          min-height: 52px;
          padding: 14px 16px;
          font-size: 16px;
          font-weight: 500;
          color: #0a0a0a;
          text-decoration: none;
          border-radius: 10px;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s;
        }
        .marketing-nav-overlay-link:active { background: var(--paper-2); }
        .marketing-nav-overlay-link-sub {
          font-size: 15px;
          font-weight: 400;
          color: var(--ink-2);
          padding-left: 20px;
          min-height: 48px;
        }
        .marketing-nav-overlay-link-sub:active { background: var(--paper-2); color: #0a0a0a; }
        .marketing-nav-overlay-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          padding: 16px 24px;
          margin-top: 24px;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          background: #0a0a0a;
          border-radius: 12px;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 0.2s;
        }
        .marketing-nav-overlay-cta:active { opacity: 0.9; }
        .marketing-nav-overlay-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 52px;
          padding: 14px 16px;
          font-size: 16px;
          font-weight: 500;
          color: #0a0a0a;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 10px;
          text-align: left;
          -webkit-tap-highlight-color: transparent;
        }
        .marketing-nav-overlay-trigger:active { background: var(--paper-2); }
        .marketing-nav-overlay-trigger svg {
          transition: transform 0.2s ease;
        }
        .marketing-nav-overlay-trigger[aria-expanded="true"] svg { transform: rotate(180deg); }
        .marketing-nav-overlay-sublist {
          padding: 4px 0 8px 8px;
          border-left: 2px solid var(--line);
          margin-left: 16px;
          margin-bottom: 8px;
        }
      `}} />
      <div ref={navRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {/* Bouton hamburger (visible mobile uniquement) */}
      <button
        type="button"
        className="marketing-nav-mobile-toggle"
        aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#0a0a0a",
        }}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {/* Overlay menu mobile (plein écran) */}
      {mobileOpen && (
        <div className="marketing-nav-overlay" role="dialog" aria-modal="true" aria-label={t("menuLabel")}>
          <div className="marketing-nav-overlay-header">
            <span style={{ fontSize: 18, fontWeight: 600, color: "#0a0a0a", letterSpacing: "-0.02em" }}>FeedPlug</span>
            <button
              type="button"
              className="marketing-nav-overlay-close"
              aria-label={t("closeMenu")}
              onClick={() => setMobileOpen(false)}
            >
              <X size={24} />
            </button>
          </div>
          <div className="marketing-nav-overlay-body">
            {showHome && (
              <div className="marketing-nav-overlay-section">
                <Link href={homeHref} className="marketing-nav-overlay-link" onClick={() => setMobileOpen(false)}>
                  {t("home")}
                </Link>
              </div>
            )}
            <div className="marketing-nav-overlay-section">
              <button
                type="button"
                className="marketing-nav-overlay-trigger"
                aria-expanded={solutionsOpen}
                onClick={() => setSolutionsOpen((v) => !v)}
              >
                {t("solutions")}
                <ChevronDown size={20} />
              </button>
              {solutionsOpen && (
                <div className="marketing-nav-overlay-sublist">
                  {NAV_SOLUTIONS.map((item) => {
                    const label = NAV_SOLUTION_KEYS[item.id] ? t(NAV_SOLUTION_KEYS[item.id]) : item.label;
                    return item.available ? (
                      <Link key={item.id} href={item.href} className="marketing-nav-overlay-link marketing-nav-overlay-link-sub" onClick={() => setMobileOpen(false)}>
                        {label}
                      </Link>
                    ) : (
                      <div key={item.id} className="marketing-nav-overlay-link marketing-nav-overlay-link-sub" style={{ color: "var(--ink-4)", cursor: "default" }}>
                        <Lock size={14} style={{ marginRight: 8, flexShrink: 0 }} /> {label} <span style={{ fontSize: 12 }}>{t("comingSoon")}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="marketing-nav-overlay-section">
              <button
                type="button"
                className="marketing-nav-overlay-trigger"
                aria-expanded={fonctionnalitesOpen}
                onClick={() => setFonctionnalitesOpen((v) => !v)}
              >
                {t("features")}
                <ChevronDown size={20} />
              </button>
              {fonctionnalitesOpen && (
                <div className="marketing-nav-overlay-sublist">
                  {NAV_FONCTIONNALITES.map((item) => {
                    const href = "page" in item && item.page ? item.page : getFonctionnaliteHref(item.id, locale);
                    const label = NAV_FEATURE_KEYS[item.id] ? t(NAV_FEATURE_KEYS[item.id]) : item.label;
                    return (
                      <Link key={item.id} href={href} className="marketing-nav-overlay-link marketing-nav-overlay-link-sub" onClick={() => setMobileOpen(false)}>
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="marketing-nav-overlay-section">
              <Link href={`${homeHref}/tarifs`} className="marketing-nav-overlay-link" onClick={() => setMobileOpen(false)}>
                {t("tarifs")}
              </Link>
              <Link href={demoHref} className="marketing-nav-overlay-link" onClick={() => setMobileOpen(false)}>
                {t("contact")}
              </Link>
              <Link href="/docs" className="marketing-nav-overlay-link" onClick={() => setMobileOpen(false)}>
                {t("documentation")}
              </Link>
            </div>
            <a href="https://app.feedplug.com/login" className="marketing-nav-overlay-cta" onClick={() => setMobileOpen(false)}>
              {t("clientAccess")}
            </a>
          </div>
        </div>
      )}
      {/* Nav desktop */}
      <div className="marketing-nav-desktop marketing-nav-links" style={{ display: "flex", alignItems: "center", gap: 48 }}>
        {showHome && (
          <Link href={homeHref} className={`marketing-nav-link ${dark ? 'nav-dark' : ''}`} style={dark ? navLinkDark : navLinkLight}>
            {t("home")}
          </Link>
        )}

        {/* Solutions — dropdown canaux */}
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => { setSolutionsOpen(true); setFonctionnalitesOpen(false); }}
          onMouseLeave={() => setSolutionsOpen(false)}
        >
          <button
            type="button"
            className="marketing-nav-trigger"
            style={dark ? { color: "rgba(255,255,255,0.7)" } : undefined}
            onClick={() => { setSolutionsOpen((v) => !v); setFonctionnalitesOpen(false); }}
          >
            {t("solutions")}
            <ChevronDown style={{ width: 16, height: 16, transform: solutionsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {solutionsOpen && (
            <div className="marketing-nav-dropdown">
              <div>
              {NAV_SOLUTIONS.map((item) => {
                const label = NAV_SOLUTION_KEYS[item.id] ? t(NAV_SOLUTION_KEYS[item.id]) : item.label;
                return item.available ? (
                  <Link key={item.id} href={item.href} className="marketing-nav-dropdown-item">
                    {label}
                  </Link>
                ) : (
                  <div key={item.id} className="marketing-nav-dropdown-item disabled">
                    <Lock style={{ width: 14, height: 14, flexShrink: 0 }} />
                    {label}
                    <span style={{ fontSize: 11, color: "var(--ink-4)", marginLeft: "auto" }}>{t("comingSoon")}</span>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Fonctionnalités — dropdown */}
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => { setFonctionnalitesOpen(true); setSolutionsOpen(false); }}
          onMouseLeave={() => setFonctionnalitesOpen(false)}
        >
          <button
            type="button"
            className="marketing-nav-trigger"
            style={dark ? { color: "rgba(255,255,255,0.7)" } : undefined}
            onClick={() => { setFonctionnalitesOpen((v) => !v); setSolutionsOpen(false); }}
          >
            {t("features")}
            <ChevronDown style={{ width: 16, height: 16, transform: fonctionnalitesOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {fonctionnalitesOpen && (
            <div className="marketing-nav-dropdown">
              <div>
              {NAV_FONCTIONNALITES.map((item) => {
                const href = "page" in item && item.page ? item.page : getFonctionnaliteHref(item.id, locale);
                const label = NAV_FEATURE_KEYS[item.id] ? t(NAV_FEATURE_KEYS[item.id]) : item.label;
                return (
                  <Link key={item.id} href={href} className="marketing-nav-dropdown-item">
                    {label}
                  </Link>
                );
              })}
              </div>
            </div>
          )}
        </div>

        <Link href={`${homeHref}/tarifs`} className={`marketing-nav-link ${dark ? 'nav-dark' : ''}`} style={dark ? navLinkDark : navLinkLight}>
          {t("tarifs")}
        </Link>
        <Link href={demoHref} className={`marketing-nav-link ${dark ? 'nav-dark' : ''}`} style={dark ? navLinkDark : navLinkLight}>
          {t("contact")}
        </Link>
        <Link href="/docs" className={`marketing-nav-link ${dark ? 'nav-dark' : ''}`} style={dark ? navLinkDark : navLinkLight}>
          {t("documentation")}
        </Link>
        <a
          href="https://app.feedplug.com/login"
          style={{
            color: dark ? "#ffffff" : "#0a0a0a",
            fontSize: 14,
            fontWeight: 400,
            textDecoration: "none",
            borderBottom: dark ? "1px solid rgba(255,255,255,0.5)" : "1px solid #0a0a0a",
            paddingBottom: 2,
            transition: "opacity 0.2s, color 0.3s, border-color 0.3s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          {t("clientAccess")}
        </a>
      </div>
      </div>
    </>
  );
}

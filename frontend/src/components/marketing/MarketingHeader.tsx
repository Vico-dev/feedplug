"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import MarketingNav from "@/components/marketing/MarketingNav";

export default function MarketingHeader() {
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const homeHref = locale === "fr" ? "/" : `/${locale}`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll(); // check initial position
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="marketing-header-root"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: scrolled ? "rgba(250,250,250,0.85)" : "rgba(250,250,250,0.65)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: scrolled ? "1px solid var(--line)" : "1px solid rgba(229,229,229,0.5)",
        zIndex: 1000,
        transition: "background-color var(--d-base) var(--ease), border-color var(--d-base) var(--ease)",
        boxShadow: scrolled ? "var(--sh-xs)" : "none",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .marketing-header-root { padding: 14px 0; }
        @media (min-width: 769px) {
          .marketing-header-root { padding: 18px 0; }
        }
      `}} />
      <div
        className="marketing-header-inner"
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "nowrap",
          gap: "16px",
          minHeight: "44px",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .marketing-header-inner { padding: 0 16px; }
          @media (min-width: 769px) {
            .marketing-header-inner { padding: 0 48px; gap: 24px; }
          }
        `}} />
        <Link
          href={homeHref}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "6px",
            textDecoration: "none",
            flexShrink: 0,
            fontFamily: "var(--font-display)",
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--ink)",
            transition: "color var(--d-base) var(--ease)",
          }}
        >
          FeedPlug
        </Link>
        <MarketingNav showHome={true} locale={locale} dark={false} />
      </div>
    </nav>
  );
}

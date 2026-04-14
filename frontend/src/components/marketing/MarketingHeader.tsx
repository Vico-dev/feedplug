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
        backgroundColor: scrolled ? "rgba(255,255,255,0.9)" : "rgba(248,250,252,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: scrolled ? "1px solid rgba(226,232,240,0.95)" : "1px solid rgba(226,232,240,0.5)",
        zIndex: 1000,
        transition: "background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
        boxShadow: scrolled ? "0 10px 30px rgba(15,23,42,0.06)" : "none",
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
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              boxShadow: "0 8px 20px rgba(15,23,42,0.14)",
            }}
          >
            FP
          </span>
          <span
            style={{
              fontSize: "17px",
              fontWeight: 650,
              letterSpacing: "-0.03em",
              color: "#111827",
              transition: "color 0.3s ease",
            }}
          >
            FeedPlug
          </span>
        </Link>
        <MarketingNav showHome={true} locale={locale} dark={false} />
      </div>
    </nav>
  );
}

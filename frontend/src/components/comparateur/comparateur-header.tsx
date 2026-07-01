"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search, Menu, X, ChevronDown, User, Flame,
  Laptop, Smartphone, Tv, WashingMachine, Gamepad2, Sofa, Shirt, Sparkles, Dumbbell, ToyBrick,
} from "lucide-react";

// Rayons du comparateur (taxonomie maison). slug = id de catégorie (ComparatorCategory)
// → vraies pages rayon /rayon/<slug>.
const RAYONS = [
  { label: "Informatique", slug: "informatique", Icon: Laptop },
  { label: "Téléphonie", slug: "telephonie", Icon: Smartphone },
  { label: "TV & Son", slug: "tv-son", Icon: Tv },
  { label: "Électroménager", slug: "electromenager", Icon: WashingMachine },
  { label: "Jeux vidéo", slug: "jeux-video", Icon: Gamepad2 },
  { label: "Maison & Déco", slug: "maison-deco", Icon: Sofa },
  { label: "Mode", slug: "mode", Icon: Shirt },
  { label: "Beauté & Parfums", slug: "beaute-parfums", Icon: Sparkles },
  { label: "Sport", slug: "sport", Icon: Dumbbell },
  { label: "Jouets", slug: "jouets", Icon: ToyBrick },
];

const rayonHref = (slug: string) => `/rayon/${slug}`;

export default function ComparateurHeader() {
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        backgroundColor: scrolled ? "rgba(250,250,250,0.9)" : "rgba(250,250,250,0.7)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: `1px solid ${scrolled ? "var(--line)" : "rgba(229,229,229,0.5)"}`,
        zIndex: 1000,
        transition: "background-color var(--d-base) var(--ease), border-color var(--d-base) var(--ease)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .cmp-hd-inner { max-width: 1400px; margin: 0 auto; padding: 12px 16px; display: flex; align-items: center; gap: 16px; }
        @media (min-width: 769px) { .cmp-hd-inner { padding: 14px 32px; gap: 24px; } }
        .cmp-hd-search { flex: 1; max-width: 560px; display: none; }
        @media (min-width: 769px) { .cmp-hd-search { display: flex; } }
        .cmp-hd-desktop { display: none; align-items: center; gap: 18px; }
        @media (min-width: 769px) { .cmp-hd-desktop { display: flex; } }
        .cmp-hd-burger { display: inline-flex; }
        @media (min-width: 769px) { .cmp-hd-burger { display: none; } }
        .cmp-hd-link { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: var(--ink-2); font-family: var(--font-sans); font-size: 14px; font-weight: 500; transition: color var(--d-fast) var(--ease); white-space: nowrap; }
        .cmp-hd-link:hover { color: var(--ink); }
        .cmp-mega { position: absolute; top: 100%; left: 0; right: 0; padding-top: 8px; }
        .cmp-mega-panel { max-width: 1400px; margin: 0 auto; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-xl); box-shadow: var(--sh-lg); padding: 20px; }
        .cmp-mega-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px; }
        @media (min-width: 769px) { .cmp-mega-grid { grid-template-columns: repeat(5, minmax(0,1fr)); } }
        .cmp-mega-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--r-lg); text-decoration: none; color: var(--ink); transition: background var(--d-fast) var(--ease); }
        .cmp-mega-item:hover { background: var(--paper-2); }
        .cmp-rayon-trigger { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-family: var(--font-sans); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .cmp-rayon-trigger:hover { background: var(--paper-2); }
      `}} />

      <div className="cmp-hd-inner">
        {/* Logo */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "baseline", gap: "6px", textDecoration: "none", flexShrink: 0, fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>
          Feedplug
        </Link>

        {/* Rayons (mega-menu) — desktop */}
        <div className="cmp-hd-desktop" ref={megaRef} style={{ position: "static" }}>
          <button
            type="button"
            className="cmp-rayon-trigger"
            aria-expanded={megaOpen}
            onClick={() => setMegaOpen((v) => !v)}
            onMouseEnter={() => setMegaOpen(true)}
          >
            <Menu size={16} /> Rayons
            <ChevronDown size={15} style={{ transform: megaOpen ? "rotate(180deg)" : "none", transition: "transform var(--d-fast)" }} />
          </button>
        </div>

        {/* Recherche */}
        <form action="/comparateur" method="get" className="cmp-hd-search" role="search" style={{ position: "relative", alignItems: "center" }}>
          <Search size={17} aria-hidden="true" style={{ position: "absolute", left: "12px", color: "var(--ink-4)", pointerEvents: "none" }} />
          <input
            name="q"
            placeholder="Rechercher un produit, une marque…"
            aria-label="Rechercher"
            className="input-field"
            style={{ width: "100%", height: "40px", padding: "0 14px 0 36px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--surface)", fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--ink)", outline: "none" }}
          />
        </form>

        {/* Actions droite — desktop */}
        <div className="cmp-hd-desktop" style={{ marginLeft: "auto" }}>
          <Link href="/deals" className="cmp-hd-link" style={{ color: "var(--accent-2)" }}>
            <Flame size={16} /> Bons plans
          </Link>
          <Link href="/compte" className="cmp-hd-link">
            <User size={16} /> Mon compte
          </Link>
        </div>

        {/* Burger — mobile */}
        <button
          type="button"
          className="cmp-hd-burger"
          aria-label="Menu"
          onClick={() => setMobileOpen(true)}
          style={{ marginLeft: "auto", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", border: "none", background: "none", color: "var(--ink)", cursor: "pointer" }}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mega-menu panel (desktop) */}
      {megaOpen && (
        <div className="cmp-mega" onMouseLeave={() => setMegaOpen(false)}>
          <div className="cmp-mega-panel">
            <Link href="/deals" onClick={() => setMegaOpen(false)} className="cmp-mega-item" style={{ background: "var(--accent-bg)", marginBottom: "12px" }}>
              <Flame size={20} style={{ color: "var(--accent-2)" }} />
              <span style={{ fontWeight: 700, color: "var(--accent-2)" }}>Bons plans — les meilleures baisses</span>
            </Link>
            <div className="cmp-mega-grid">
              {RAYONS.map(({ label, slug, Icon }) => (
                <Link key={slug} href={rayonHref(slug)} onClick={() => setMegaOpen(false)} className="cmp-mega-item">
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "var(--r-md)", background: "var(--paper-2)", color: "var(--ink-2)", flexShrink: 0 }}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 500 }}>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overlay mobile */}
      {mobileOpen && (
        <div role="dialog" aria-modal="true" aria-label="Menu" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--surface)", display: "flex", flexDirection: "column" }}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", padding: "0 16px 0 20px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>Feedplug</span>
            <button type="button" aria-label="Fermer" onClick={() => setMobileOpen(false)} style={{ width: "44px", height: "44px", border: "none", background: "none", color: "var(--ink)", cursor: "pointer" }}><X size={24} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <form action="/comparateur" method="get" role="search" style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: "24px" }}>
              <Search size={17} aria-hidden="true" style={{ position: "absolute", left: "12px", color: "var(--ink-4)" }} />
              <input name="q" placeholder="Rechercher…" aria-label="Rechercher" className="input-field" style={{ width: "100%", height: "44px", padding: "0 14px 0 36px", borderRadius: "var(--r-pill)", border: "1px solid var(--line)", background: "var(--surface)", fontSize: "15px", color: "var(--ink)", outline: "none" }} />
            </form>
            <Link href="/deals" onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "var(--r-lg)", background: "var(--accent-bg)", color: "var(--accent-2)", fontWeight: 700, textDecoration: "none", marginBottom: "12px" }}>
              <Flame size={20} /> Bons plans
            </Link>
            <p style={{ margin: "0 0 8px", fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)" }}>Rayons</p>
            {RAYONS.map(({ label, slug, Icon }) => (
              <Link key={slug} href={rayonHref(slug)} onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "52px", padding: "12px", borderRadius: "var(--r-lg)", color: "var(--ink)", textDecoration: "none" }}>
                <Icon size={20} aria-hidden="true" style={{ color: "var(--ink-3)" }} /> <span style={{ fontSize: "16px", fontWeight: 500 }}>{label}</span>
              </Link>
            ))}
            <Link href="/compte" onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", padding: "16px", borderRadius: "var(--r-lg)", background: "var(--ink)", color: "var(--paper)", fontWeight: 600, textDecoration: "none", justifyContent: "center" }}>
              <User size={18} /> Mon compte
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

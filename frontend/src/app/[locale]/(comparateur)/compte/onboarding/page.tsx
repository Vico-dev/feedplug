"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";
import {
  getCategories,
  getInterests,
  setInterests,
  type ComparatorCategory,
} from "@/lib/comparator-api";

const eyebrowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "9px",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};
const dotStyle: CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "999px",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 0 4px var(--accent-bg)",
  display: "inline-block",
};

function CategoryIcon({ name }: { name: string | null }) {
  const lib = Icons as unknown as Record<string, React.ComponentType<{ style?: CSSProperties; "aria-hidden"?: boolean }>>;
  const Cmp = (name && lib[name]) || Icons.Tag;
  return <Cmp style={{ width: "22px", height: "22px" }} aria-hidden={true} />;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ComparatorCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, mine] = await Promise.all([getCategories(), getInterests()]);
        if (!active) return;
        setCategories(cats.categories || []);
        setSelected(new Set(mine.categoryIds || []));
      } catch (e) {
        if (!active) return;
        if ((e as { status?: number }).status === 401) setAuthError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await setInterests(Array.from(selected));
      router.replace("/compte/feed");
    } catch (e) {
      if ((e as { status?: number }).status === 401) setAuthError(true);
    } finally {
      setSaving(false);
    }
  }

  if (authError) {
    return (
      <main style={{ maxWidth: "520px", margin: "0 auto", padding: "96px var(--page-padding-x)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Connexion requise
        </p>
        <p style={{ margin: "10px 0 22px", fontSize: "15px", color: "var(--ink-3)" }}>
          Connectez-vous pour choisir vos centres d&apos;intérêt.
        </p>
        <Link href="/compte" className="cta-btn" style={{ display: "inline-flex", padding: "13px 22px", borderRadius: "var(--r-lg)", fontWeight: 600, textDecoration: "none" }}>
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "56px var(--page-padding-x) 96px" }}>
      <div style={eyebrowStyle}>
        <span style={dotStyle} />
        Personnalisation
      </div>

      <h1
        className="hero-h"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(32px, 4.6vw, 48px)",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1.0,
          color: "var(--ink)",
          margin: "22px 0 0",
          maxWidth: "640px",
          textWrap: "balance",
        }}
      >
        Qu&apos;est-ce qui vous{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)", letterSpacing: "-0.02em" }}>
          intéresse ?
        </em>
      </h1>

      <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", lineHeight: 1.55, color: "var(--ink-2)", margin: "16px 0 0", maxWidth: "560px" }}>
        Choisissez vos catégories. On vous remontera les meilleures baisses de prix dans votre feed.
      </p>

      {loading ? (
        <p style={{ margin: "40px 0 0", fontSize: "15px", color: "var(--ink-3)" }}>Chargement…</p>
      ) : (
        <>
          <div
            className="rg3"
            style={{
              margin: "36px 0 0",
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            {categories.map((c) => {
              const active = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={active}
                  className="card-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "18px 20px",
                    textAlign: "left",
                    cursor: "pointer",
                    background: active ? "var(--accent-bg)" : "var(--surface)",
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: "var(--r-xl)",
                    boxShadow: "var(--sh-xs)",
                    color: "inherit",
                    transition: "background 120ms ease, border-color 120ms ease",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "44px",
                      height: "44px",
                      borderRadius: "var(--r-lg)",
                      background: active ? "var(--accent)" : "var(--accent-bg)",
                      color: active ? "var(--paper)" : "var(--accent-2)",
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon name={c.icon} />
                  </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>
                    {c.labelfr}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "32px 0 0", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="cta-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 24px",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "var(--r-lg)",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Enregistrement…" : "Voir mon feed"}
            </button>
            <span style={{ fontSize: "13px", color: "var(--ink-4)" }}>
              {selected.size} catégorie{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
            </span>
          </div>
        </>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCashback, type CashbackResponse } from "@/lib/comparator-api";

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

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "En attente", bg: "var(--paper-2)", color: "var(--ink-3)" },
  validated: { label: "Validé", bg: "var(--success-bg)", color: "var(--success)" },
  payable: { label: "Disponible", bg: "var(--success-bg)", color: "var(--success)" },
  paid: { label: "Payé", bg: "var(--accent-bg)", color: "var(--accent-2)" },
  rejected: { label: "Annulé", bg: "var(--danger-bg)", color: "var(--danger)" },
};

function euro(n: number | null | undefined) {
  return `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
}

function StatCard({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", padding: "20px", boxShadow: "var(--sh-xs)" }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-3)" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: strong ? "34px" : "24px", fontWeight: 700, letterSpacing: "-0.03em", color: strong ? "var(--ink)" : "var(--ink-2)" }}>
        {value}
      </p>
    </div>
  );
}

export default function CashbackPage() {
  const router = useRouter();
  const [data, setData] = useState<CashbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCashback()
      .then((d) => { if (active) setData(d); })
      .catch((e) => {
        if ((e as { status?: number }).status === 401) { router.push("/compte"); return; }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const w = data?.wallet;

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "40px var(--page-padding-x) 80px" }}>
      <div style={eyebrowStyle}><span style={dotStyle} /> Cashback</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, color: "var(--ink)", margin: "16px 0 0" }}>
        Ton cashback,{" "}
        <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>en vrai.</em>
      </h1>
      <p style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "560px" }}>
        Tu gagnes du cashback en achetant via une offre du comparateur. Il devient «&nbsp;disponible&nbsp;» une fois
        la commande validée par le marchand (sous 30 à 90 jours).
      </p>

      {loading ? (
        <p style={{ margin: "32px 0", fontSize: "14px", color: "var(--ink-3)" }}>Chargement…</p>
      ) : (
        <>
          {/* Soldes */}
          <div className="rg3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", margin: "28px 0 0" }}>
            <StatCard label="Disponible" value={euro(w?.available)} strong />
            <StatCard label="En attente" value={euro(w?.pending)} />
            <StatCard label="Gagné au total" value={euro(w?.lifetime)} />
          </div>

          {/* Retrait */}
          <div style={{ margin: "16px 0 0", padding: "20px 24px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-xs)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>Retirer en bon d&apos;achat</p>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ink-3)" }}>
                {data && data.wallet.available >= data.payoutThreshold
                  ? "Tu as atteint le seuil — le retrait arrive très bientôt."
                  : `Atteins ${euro(data?.payoutThreshold)} de disponible pour retirer (Amazon, Fnac…).`}
              </p>
            </div>
            <button
              type="button"
              disabled
              className="card-hover"
              style={{ height: "40px", padding: "0 18px", borderRadius: "var(--r-lg)", background: "var(--paper-2)", color: "var(--ink-4)", border: "1px solid var(--line)", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, cursor: "not-allowed", whiteSpace: "nowrap" }}
            >
              Bientôt
            </button>
          </div>

          {/* Historique */}
          <h2 style={{ margin: "36px 0 14px", fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>Historique</h2>
          {data && data.transactions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.transactions.map((t) => {
                const s = STATUS[t.status] || STATUS.pending;
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-xs)" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchantname || "Marchand"}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--ink-4)" }}>{(t.occurredat || t.createdat || "").slice(0, 10)}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", background: s.bg, color: s.color, fontSize: "12px", fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>{euro(t.cashbackamount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", boxShadow: "var(--sh-xs)" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>Pas encore de cashback</p>
              <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--ink-3)" }}>
                Tes achats validés via le comparateur apparaîtront ici.{" "}
                <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>Commencer à comparer</Link>
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

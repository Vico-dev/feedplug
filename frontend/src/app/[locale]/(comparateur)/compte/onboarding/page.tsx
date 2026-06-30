"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";
import {
  getCategories,
  getInterests,
  setInterests,
  getFavoriteBrands,
  setFavoriteBrands,
  getDemographics,
  setDemographics,
  type ComparatorCategory,
  type ComparatorDemographicsInput,
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

const STEP_COUNT = 3;

// Listes blanches (miroir du backend personalization.js).
const AGE_OPTIONS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "f", label: "Femme" },
  { value: "h", label: "Homme" },
  { value: "autre", label: "Autre" },
  { value: "nsp", label: "Je préfère ne pas dire" },
];
const HOUSEHOLD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "seul", label: "Seul·e" },
  { value: "couple", label: "En couple" },
  { value: "famille", label: "Avec enfants" },
  { value: "coloc", label: "Colocation" },
  { value: "autre", label: "Autre" },
];
const BUDGET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "eco", label: "Économe" },
  { value: "moyen", label: "Équilibré" },
  { value: "premium", label: "Premium" },
];

function CategoryIcon({ name }: { name: string | null }) {
  const lib = Icons as unknown as Record<string, React.ComponentType<{ style?: CSSProperties; "aria-hidden"?: boolean }>>;
  const Cmp = (name && lib[name]) || Icons.Tag;
  return <Cmp style={{ width: "22px", height: "22px" }} aria-hidden={true} />;
}

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(28px, 4.2vw, 44px)",
  fontWeight: 700,
  letterSpacing: "-0.035em",
  lineHeight: 1.02,
  color: "var(--ink)",
  margin: "22px 0 0",
  maxWidth: "640px",
  textWrap: "balance",
};
const emStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontWeight: 400,
  color: "var(--ink-2)",
  letterSpacing: "-0.02em",
};
const subStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "17px",
  lineHeight: 1.55,
  color: "var(--ink-2)",
  margin: "16px 0 0",
  maxWidth: "560px",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Étape 1 — catégories.
  const [categories, setCategories] = useState<ComparatorCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Étape 2 — marques favorites.
  const [brands, setBrands] = useState<string[]>([]);
  const [brandInput, setBrandInput] = useState("");

  // Étape 3 — socio-démo (RGPD : optionnel + consenti).
  const [demo, setDemo] = useState<ComparatorDemographicsInput>({});
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, mine, myBrands, myDemo] = await Promise.all([
          getCategories(),
          getInterests(),
          getFavoriteBrands(),
          getDemographics(),
        ]);
        if (!active) return;
        setCategories(cats.categories || []);
        setSelected(new Set(mine.categoryIds || []));
        setBrands(myBrands.brands || []);
        const d = myDemo.demographics;
        setDemo({
          agerange: d.agerange ?? undefined,
          gender: d.gender ?? undefined,
          region: d.region ?? undefined,
          household: d.household ?? undefined,
          budgetrange: d.budgetrange ?? undefined,
        });
        setConsent(Boolean(d.consentAt));
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

  function toggleCategory(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addBrand() {
    const b = brandInput.trim();
    if (!b) return;
    setBrands((prev) => (prev.some((x) => x.toLowerCase() === b.toLowerCase()) ? prev : [...prev, b].slice(0, 30)));
    setBrandInput("");
  }
  function removeBrand(b: string) {
    setBrands((prev) => prev.filter((x) => x !== b));
  }

  // Persiste l'étape courante puis avance. `skip` n'enregistre pas l'étape (on passe outre).
  async function next(skip = false) {
    if (saving) return;
    setSaving(true);
    try {
      if (!skip) {
        if (step === 0) await setInterests(Array.from(selected));
        else if (step === 1) await setFavoriteBrands(brands);
        else if (step === 2) await setDemographics({ ...demo, consent });
      }
      if (step >= STEP_COUNT - 1) {
        router.replace("/compte/feed");
        return;
      }
      setStep((s) => s + 1);
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
          Connectez-vous pour personnaliser vos recommandations.
        </p>
        <Link href="/compte" className="cta-btn" style={{ display: "inline-flex", padding: "13px 22px", borderRadius: "var(--r-lg)", fontWeight: 600, textDecoration: "none" }}>
          Se connecter
        </Link>
      </main>
    );
  }

  const isLast = step === STEP_COUNT - 1;

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "56px var(--page-padding-x) 96px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={eyebrowStyle}>
          <span style={dotStyle} />
          Personnalisation — étape {step + 1}/{STEP_COUNT}
        </div>
        {/* Stepper visuel. */}
        <div style={{ display: "flex", gap: "6px" }} aria-hidden={true}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? "28px" : "16px",
                height: "6px",
                borderRadius: "999px",
                background: i <= step ? "var(--accent)" : "var(--line)",
                transition: "width 160ms ease, background 160ms ease",
              }}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ margin: "40px 0 0", fontSize: "15px", color: "var(--ink-3)" }}>Chargement…</p>
      ) : (
        <>
          {step === 0 && (
            <StepCategories categories={categories} selected={selected} toggle={toggleCategory} />
          )}
          {step === 1 && (
            <StepBrands
              brands={brands}
              brandInput={brandInput}
              setBrandInput={setBrandInput}
              addBrand={addBrand}
              removeBrand={removeBrand}
            />
          )}
          {step === 2 && (
            <StepDemographics demo={demo} setDemo={setDemo} consent={consent} setConsent={setConsent} />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "36px 0 0", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => next(false)}
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
              {saving ? "Enregistrement…" : isLast ? "Terminer" : "Continuer"}
            </button>
            <button
              type="button"
              onClick={() => next(true)}
              disabled={saving}
              style={{
                background: "none",
                border: "none",
                cursor: saving ? "default" : "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--ink-3)",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                padding: "8px 4px",
              }}
            >
              {isLast ? "Passer et voir mon feed" : "Passer cette étape"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function StepCategories({
  categories,
  selected,
  toggle,
}: {
  categories: ComparatorCategory[];
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <>
      <h1 className="hero-h" style={titleStyle}>
        Qu&apos;est-ce qui vous <em style={emStyle}>intéresse ?</em>
      </h1>
      <p style={subStyle}>
        Choisissez vos catégories. On vous remontera les meilleures baisses de prix dans votre feed.
      </p>
      <div
        className="rg3"
        style={{ margin: "36px 0 0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}
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
      <p style={{ fontSize: "13px", color: "var(--ink-4)", margin: "18px 0 0" }}>
        {selected.size} catégorie{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
      </p>
    </>
  );
}

function StepBrands({
  brands,
  brandInput,
  setBrandInput,
  addBrand,
  removeBrand,
}: {
  brands: string[];
  brandInput: string;
  setBrandInput: (v: string) => void;
  addBrand: () => void;
  removeBrand: (b: string) => void;
}) {
  return (
    <>
      <h1 className="hero-h" style={titleStyle}>
        Vos marques <em style={emStyle}>préférées ?</em>
      </h1>
      <p style={subStyle}>
        Ajoutez les marques que vous suivez. On les fera remonter dans vos recommandations.{" "}
        <span style={{ color: "var(--ink-4)" }}>Facultatif.</span>
      </p>
      <div style={{ display: "flex", gap: "10px", margin: "32px 0 0", maxWidth: "440px" }}>
        <input
          type="text"
          value={brandInput}
          onChange={(e) => setBrandInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addBrand();
            }
          }}
          placeholder="Ex. Apple, Nike, Dyson…"
          className="input-field"
          style={{ flex: 1, padding: "12px 14px", borderRadius: "var(--r-lg)", fontSize: "15px" }}
        />
        <button
          type="button"
          onClick={addBrand}
          className="card-hover"
          style={{
            padding: "12px 18px",
            borderRadius: "var(--r-lg)",
            border: "1.5px solid var(--line)",
            background: "var(--surface)",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          Ajouter
        </button>
      </div>
      {brands.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "20px 0 0" }}>
          {brands.map((b) => (
            <span
              key={b}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px 8px 14px",
                borderRadius: "var(--r-pill)",
                background: "var(--accent-bg)",
                color: "var(--accent-2)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {b}
              <button
                type="button"
                onClick={() => removeBrand(b)}
                aria-label={`Retirer ${b}`}
                style={{ display: "inline-flex", background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
              >
                <Icons.X style={{ width: "15px", height: "15px" }} aria-hidden={true} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function ChoiceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string | null | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div style={{ margin: "26px 0 0" }}>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, color: "var(--ink-2)", margin: "0 0 12px" }}>
        {label}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(active ? undefined : o.value)}
              aria-pressed={active}
              style={{
                padding: "10px 16px",
                borderRadius: "var(--r-pill)",
                border: `1.5px solid ${active ? "var(--accent)" : "var(--line)"}`,
                background: active ? "var(--accent-bg)" : "var(--surface)",
                color: active ? "var(--accent-2)" : "var(--ink-2)",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepDemographics({
  demo,
  setDemo,
  consent,
  setConsent,
}: {
  demo: ComparatorDemographicsInput;
  setDemo: (updater: (d: ComparatorDemographicsInput) => ComparatorDemographicsInput) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
}) {
  const set = (k: keyof ComparatorDemographicsInput) => (v: string | undefined) =>
    setDemo((d) => ({ ...d, [k]: v }));

  return (
    <>
      <h1 className="hero-h" style={titleStyle}>
        Pour mieux vous <em style={emStyle}>recommander.</em>
      </h1>
      <p style={subStyle}>
        Quelques infos, <strong style={{ fontWeight: 600, color: "var(--ink)" }}>facultatives</strong>, pour
        personnaliser vos recommandations. Vous restez anonyme et pouvez tout passer.
      </p>

      <ChoiceRow
        label="Tranche d'âge"
        options={AGE_OPTIONS.map((a) => ({ value: a, label: a }))}
        value={demo.agerange}
        onChange={set("agerange")}
      />
      <ChoiceRow label="Genre" options={GENDER_OPTIONS} value={demo.gender} onChange={set("gender")} />
      <ChoiceRow label="Foyer" options={HOUSEHOLD_OPTIONS} value={demo.household} onChange={set("household")} />
      <ChoiceRow label="Budget habituel" options={BUDGET_OPTIONS} value={demo.budgetrange} onChange={set("budgetrange")} />

      <div style={{ margin: "26px 0 0", maxWidth: "320px" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, color: "var(--ink-2)", margin: "0 0 12px" }}>
          Région (optionnel)
        </p>
        <input
          type="text"
          value={demo.region ?? ""}
          onChange={(e) => set("region")(e.target.value || undefined)}
          placeholder="Ex. IDF, 75…"
          className="input-field"
          style={{ width: "100%", padding: "12px 14px", borderRadius: "var(--r-lg)", fontSize: "15px" }}
        />
      </div>

      {/* Consentement RGPD explicite. */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          margin: "30px 0 0",
          padding: "16px 18px",
          borderRadius: "var(--r-xl)",
          border: "1.5px solid var(--line)",
          background: "var(--surface)",
          maxWidth: "560px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "var(--accent)", flexShrink: 0 }}
        />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: 1.55, color: "var(--ink-2)" }}>
          J&apos;autorise Feedplug à utiliser ces informations pour personnaliser mes recommandations. Données
          facultatives, conservées de façon anonyme et supprimables à tout moment depuis mon compte.
        </span>
      </label>
    </>
  );
}

"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyMagicLink, getInterests } from "@/lib/comparator-api";

const centered: CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "96px var(--page-padding-x)",
  textAlign: "center",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(26px, 4vw, 36px)",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: "var(--ink)",
  margin: 0,
};

function ErrorView() {
  return (
    <main style={centered}>
      <h1 style={titleStyle}>Lien invalide ou expiré</h1>
      <p style={{ margin: "12px 0 24px", fontSize: "15px", color: "var(--ink-3)" }}>
        Ce lien de connexion n&apos;est plus valable. Demandez-en un nouveau.
      </p>
      <Link
        href="/compte"
        className="cta-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "13px 22px",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          fontWeight: 600,
          borderRadius: "var(--r-lg)",
          textDecoration: "none",
        }}
      >
        Recevoir un nouveau lien
      </Link>
    </main>
  );
}

function VerifyRunner({ token, country }: { token: string; country: string }) {
  const router = useRouter();
  const [errored, setErrored] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { user } = await verifyMagicLink(token, country, "fr");

        let returnTo: string | null = null;
        try {
          returnTo = sessionStorage.getItem("cmp_return_to");
          sessionStorage.removeItem("cmp_return_to");
        } catch {
          returnTo = null;
        }

        let hasInterests = false;
        try {
          const r = await getInterests();
          hasInterests = (r.categoryIds || []).length > 0;
        } catch {
          hasInterests = false;
        }
        const destination =
          returnTo && returnTo.startsWith("/")
            ? returnTo
            : hasInterests
              ? "/compte/feed"
              : "/compte/onboarding";

        // Premier passage sans prénom connu : on propose « Comment on t'appelle ? »
        // avant de poursuivre. Étape optionnelle (skippable), elle relaie la destination.
        if (!user.firstName) {
          router.replace(`/compte/bienvenue?next=${encodeURIComponent(destination)}`);
          return;
        }
        router.replace(destination);
      } catch {
        setErrored(true);
      }
    })();
  }, [token, country, router]);

  if (errored) return <ErrorView />;

  return (
    <main style={centered}>
      <h1 style={titleStyle}>Connexion en cours…</h1>
      <p style={{ margin: "12px 0 0", fontSize: "15px", color: "var(--ink-3)" }}>
        On vérifie votre lien, un instant.
      </p>
    </main>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const country = (params.get("country") || "FR").toUpperCase();

  if (!token) return <ErrorView />;
  return <VerifyRunner token={token} country={country} />;
}

export default function VerifierPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}

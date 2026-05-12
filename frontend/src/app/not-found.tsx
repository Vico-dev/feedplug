import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        backgroundColor: "#fafafa",
        color: "#0a0a0a",
      }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid var(--line)",
          padding: "24px 48px",
        }}
      >
        <nav
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "#0a0a0a",
              textDecoration: "none",
            }}
          >
            FeedPlug
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <Link href="/" style={{ fontSize: 14, color: "var(--ink-2)", textDecoration: "none" }}>
              Accueil
            </Link>
            <Link href="/optimiser-flux-google-shopping" style={{ fontSize: 14, color: "var(--ink-2)", textDecoration: "none" }}>
              Optimiser flux Google
            </Link>
            <Link href="/docs" style={{ fontSize: 14, color: "var(--ink-2)", textDecoration: "none" }}>
              Documentation
            </Link>
          </div>
        </nav>
      </header>

      {/* Contenu 404 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: 18, color: "var(--ink-3)", marginBottom: 32, textAlign: "center" }}>
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              padding: "12px 24px",
              backgroundColor: "#0a0a0a",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Accueil
          </Link>
          <Link
            href="/optimiser-flux-google-shopping"
            style={{
              padding: "12px 24px",
              backgroundColor: "#fff",
              color: "#0a0a0a",
              borderRadius: 8,
              border: "1px solid var(--line)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Optimiser flux Google
          </Link>
          <Link
            href="/docs"
            style={{
              padding: "12px 24px",
              backgroundColor: "#fff",
              color: "#0a0a0a",
              borderRadius: 8,
              border: "1px solid var(--line)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}

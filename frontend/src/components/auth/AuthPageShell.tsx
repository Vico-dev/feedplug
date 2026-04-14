import type { ReactNode } from "react";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  children: ReactNode;
};

export default function AuthPageShell({
  eyebrow,
  title,
  description,
  highlights,
  children,
}: AuthPageShellProps) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .auth-shell-grid {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(380px, 430px);
              gap: 28px;
              align-items: stretch;
            }
            @media (max-width: 980px) {
              .auth-shell-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
      <div
        style={{
          minHeight: "calc(100vh - 84px)",
          background:
            "radial-gradient(circle at top left, rgba(148,163,184,0.12), transparent 22%), linear-gradient(180deg, #f8fafc 0%, #ffffff 30%)",
          padding: "44px 24px 80px",
        }}
      >
        <div className="auth-shell-grid" style={{ maxWidth: 1160, margin: "0 auto" }}>
          <section
            style={{
              borderRadius: 30,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(226,232,240,0.9)",
              boxShadow: "0 24px 70px rgba(15,23,42,0.06)",
              padding: "42px 36px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#475569",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 18,
              }}
            >
              {eyebrow}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2.2rem, 4vw, 4rem)",
                lineHeight: 0.97,
                letterSpacing: "-0.055em",
                color: "#0f172a",
                maxWidth: 640,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: "22px 0 0",
                color: "#475569",
                fontSize: 17,
                lineHeight: 1.75,
                maxWidth: 640,
              }}
            >
              {description}
            </p>
            <div
              style={{
                marginTop: 28,
                display: "grid",
                gap: 14,
              }}
            >
              {highlights.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "15px 16px",
                    borderRadius: 18,
                    background: "#fbfdff",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                    lineHeight: 1.65,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#111827",
                      marginTop: 10,
                      flexShrink: 0,
                    }}
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              borderRadius: 30,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(226,232,240,0.95)",
              boxShadow: "0 24px 70px rgba(15,23,42,0.06)",
              padding: "32px 28px",
              alignSelf: "start",
            }}
          >
            {children}
          </section>
        </div>
      </div>
    </>
  );
}

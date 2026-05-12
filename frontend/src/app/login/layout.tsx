import type { Metadata } from "next";
import AuthPageHeader from "@/components/auth/AuthPageHeader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", fontFamily: "var(--font-sans)" }}>
      <AuthPageHeader />
      {children}
    </div>
  );
}

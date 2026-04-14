import type { Metadata } from "next";
import AuthPageHeader from "@/components/auth/AuthPageHeader";

export const metadata: Metadata = {
  title: "Créer un compte | FeedPlug",
  description: "30 jours d'essai gratuit. Créez votre compte FeedPlug.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", fontFamily: "Inter, system-ui, sans-serif" }}>
      <AuthPageHeader />
      {children}
    </div>
  );
}

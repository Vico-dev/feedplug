import type { Metadata } from "next";
import AuthPageHeader from "@/components/auth/AuthPageHeader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({
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

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { 
  AlertTriangle, 
  CheckCircle, 
  CreditCard, 
  Download, 
  ExternalLink, 
  Mail, 
  Receipt,
  ShieldCheck,
  Clock,
  XCircle
} from "lucide-react";
import {
  DashboardSection,
  PageButtonPrimary,
  PageButtonSecondary,
  PageHeader,
  PageLayout,
  PageLoading,
} from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api";
import { getLocalePrefixFromPathname } from "@/lib/locale-navigation";

const BILLING_EMAIL = "billing@feedplug.com";

interface AccountInfo {
  id: string;
  name: string;
  plan?: string;
}

interface BillingProfile {
  companyName: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  billingEmail: string | null;
}

interface BillingInvoice {
  id: string;
  number: string | null;
  status: string | null;
  currency: string | null;
  amountDueCents: number | null;
  amountPaidCents: number | null;
  createdAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

interface BillingSubscription {
  id: string;
  status: string | null;
  currentPeriodEnd: string | null;
  amountCents: number | null;
  currency: string | null;
  defaultPaymentMethod: {
    brand: string | null;
    last4: string | null;
  } | null;
}

interface BillingSummaryResponse {
  stripeConfigured: boolean;
  portalAvailable: boolean;
  accountBillingState: {
    billingStatus: string | null;
    trialEndsAt: string | null;
    paymentGraceUntil: string | null;
  };
  billing: BillingProfile | null;
  subscription: BillingSubscription | null;
  invoices: BillingInvoice[];
  upcomingInvoice: {
    amountDueCents: number | null;
    dueDate: string | null;
    periodEnd: string | null;
  } | null;
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "—";
  return new Date(dateValue).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amountCents: number | null | undefined, currency = "EUR") {
  if (amountCents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatInvoiceStatus(status: string | null | undefined) {
  switch (String(status || "").toLowerCase()) {
    case "paid": return "Payée";
    case "open": return "Ouverte";
    case "draft": return "Brouillon";
    case "void": return "Annulée";
    default: return status || "—";
  }
}

function StatusBadge({ status }: { status: string | null }) {
  const statusConfig: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
    active: { bg: "var(--success-bg)", color: "var(--success)", icon: <CheckCircle size={16} />, label: "Abonnement actif" },
    pending: { bg: "var(--warning-bg)", color: "#854d0e", icon: <Clock size={16} />, label: "En attente" },
    payment_failed: { bg: "var(--danger-bg)", color: "var(--danger)", icon: <XCircle size={16} />, label: "À régulariser" },
    trial: { bg: "var(--accent-bg)", color: "var(--accent-2)", icon: <ShieldCheck size={16} />, label: "Essai actif" },
  };
  
  const config = statusConfig[status || ""] || statusConfig.pending;
  
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 20,
      backgroundColor: config.bg,
      color: config.color,
      fontSize: 13,
      fontWeight: 500,
    }}>
      {config.icon}
      {config.label}
    </div>
  );
}

export default function FacturationPage() {
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const localePrefix = getLocalePrefixFromPathname(pathname);

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      apiClient.get<AccountInfo>("/accounts"),
      apiClient.get<BillingSummaryResponse>("/billing/summary"),
    ])
      .then(([accountResult, billingResult]) => {
        if (!isMounted) return;
        if (accountResult.status === "fulfilled") {
          setAccount(accountResult.value.data ?? null);
        }
        if (billingResult.status === "fulfilled") {
          setBillingDetails(billingResult.value.data ?? null);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const billingStatus = String(user?.billingStatus || "").toLowerCase();
  const subscription = billingDetails?.subscription;
  const invoices = billingDetails?.invoices ?? [];
  const upcomingInvoice = billingDetails?.upcomingInvoice;
  const portalAvailable = !!billingDetails?.portalAvailable;

  const handleOpenPortal = async () => {
    setPortalError("");
    setPortalLoading(true);
    try {
      const appUrl = typeof window !== "undefined" ? window.location.origin : "";
      const response = await apiClient.post<{ url: string }>("/billing/create-portal-session", {
        returnUrl: `${appUrl}${localePrefix}/facturation`,
      });
      if (response.data?.url && typeof window !== "undefined") {
        window.location.href = response.data.url;
      }
    } catch {
      setPortalError("Impossible d'ouvrir le portail Stripe.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <PageLoading message="Chargement..." style={{ minHeight: "40vh" }} />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title={t("facturation.title")} subtitle="Gérez votre abonnement et vos factures" />

      {/* Status Banner */}
      <div style={{
        background: billingStatus === "active" 
          ? "linear-gradient(135deg, var(--success) 0%, var(--success) 100%)"
          : billingStatus === "payment_failed"
            ? "linear-gradient(135deg, var(--danger) 0%, var(--danger) 100%)"
            : "linear-gradient(135deg, var(--accent) 0%, var(--accent) 100%)",
        borderRadius: 16,
        padding: "24px 28px",
        color: "white",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {billingStatus === "active" ? (
              <CheckCircle size={32} />
            ) : billingStatus === "payment_failed" ? (
              <AlertTriangle size={32} />
            ) : (
              <Clock size={32} />
            )}
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {billingStatus === "active" && "Votre abonnement est actif"}
                {billingStatus === "pending" && "Paiement en attente"}
                {billingStatus === "payment_failed" && "Paiement à régulariser"}
                {!["active", "pending", "payment_failed"].includes(billingStatus) && "Gérez votre abonnement"}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                {billingStatus === "active" && "Accès complet à FeedPlug"}
                {billingStatus === "pending" && "Votre paiement est en cours de validation"}
                {billingStatus === "payment_failed" && "Régularisez pour conserver l'accès"}
                {!["active", "pending", "payment_failed"].includes(billingStatus) && user?.trialEndsAt 
                  ? `Essai gratuit jusqu'au ${formatDate(user.trialEndsAt)}`
                  : "Choisissez votre plan pour commencer"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {portalAvailable && (
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "white",
                  color: billingStatus === "active" ? "var(--success)" : billingStatus === "payment_failed" ? "var(--danger)" : "var(--accent)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: portalLoading ? "wait" : "pointer",
                }}
              >
                <CreditCard size={16} />
                {portalLoading ? "Chargement..." : "Gérer dans Stripe"}
              </button>
            )}
            {!portalAvailable && (
              <Link href={`${localePrefix}/choose-plan`} style={{ textDecoration: "none" }}>
                <button style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "white",
                  color: "var(--accent)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}>
                  <CreditCard size={16} />
                  {billingStatus === "trial" ? "Choisir un plan" : "Voir les plans"}
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          icon={<CreditCard size={18} />}
          label="Plan"
          value={account?.plan || "—"}
          color="var(--accent)"
        />
        <StatCard
          icon={<Receipt size={18} />}
          label="Prochaine échéance"
          value={subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : upcomingInvoice?.dueDate ? formatDate(upcomingInvoice.dueDate) : "—"}
          subvalue={upcomingInvoice?.amountDueCents ? formatAmount(upcomingInvoice.amountDueCents) : undefined}
          color="var(--accent)"
        />
        <StatCard
          icon={<CreditCard size={18} />}
          label="Paiement"
          value={subscription?.defaultPaymentMethod?.last4 
            ? `•••• ${subscription.defaultPaymentMethod.last4}` 
            : subscription?.amountCents 
              ? formatAmount(subscription.amountCents) 
              : "—"}
          subvalue={subscription?.amountCents ? "/ mois" : undefined}
          color="var(--success)"
        />
      </div>

      {portalError && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: "var(--danger-bg)",
          color: "var(--danger)",
          marginBottom: 24,
          fontSize: 14,
        }}>
          {portalError}
        </div>
      )}

      {/* Factures */}
      <DashboardSection
        title="Dernières factures"
        description={invoices.length > 0 ? `${invoices.length} facture${invoices.length > 1 ? "s" : ""}` : undefined}
      >
        {invoices.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 16,
                  alignItems: "center",
                  padding: "16px 20px",
                  backgroundColor: "var(--shell-background)",
                  borderRadius: 12,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {invoice.number || `Facture ${invoice.id.slice(-8)}`}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    {formatDate(invoice.createdAt)} · {formatInvoiceStatus(invoice.status)}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {formatAmount(invoice.amountPaidCents ?? invoice.amountDueCents, invoice.currency || "EUR")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {invoice.hostedInvoiceUrl && (
                    <a 
                      href={invoice.hostedInvoiceUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 12px",
                        borderRadius: 6,
                        backgroundColor: "var(--background)",
                        color: "var(--accent)",
                        fontSize: 13,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={14} />
                      Voir
                    </a>
                  )}
                  {invoice.invoicePdf && (
                    <a 
                      href={invoice.invoicePdf} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 12px",
                        borderRadius: 6,
                        backgroundColor: "var(--background)",
                        color: "var(--accent)",
                        fontSize: 13,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      <Download size={14} />
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
            backgroundColor: "var(--shell-background)",
            borderRadius: 12,
          }}>
            <Receipt size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>Aucune facture pour le moment</div>
          </div>
        )}
      </DashboardSection>

      {/* Profil de facturation */}
      {billingDetails?.billing && (
        <DashboardSection title="Profil de facturation">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
            padding: 20,
            backgroundColor: "var(--shell-background)",
            borderRadius: 12,
            border: "1px solid var(--border-subtle)",
          }}>
            {billingDetails.billing.companyName && (
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 4 }}>Société</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{billingDetails.billing.companyName}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{billingDetails.billing.billingEmail || BILLING_EMAIL}</div>
            </div>
            {billingDetails.billing.addressLine1 && (
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 4 }}>Adresse</div>
                <div style={{ fontSize: 14 }}>
                  {billingDetails.billing.addressLine1}
                  {billingDetails.billing.postalCode && `, ${billingDetails.billing.postalCode}`}
                  {billingDetails.billing.city && ` ${billingDetails.billing.city}`}
                </div>
              </div>
            )}
          </div>
        </DashboardSection>
      )}

      {/* Contact */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 24px",
        backgroundColor: "var(--shell-background)",
        borderRadius: 12,
        border: "1px solid var(--border-subtle)",
        marginTop: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
          }}>
            <Mail size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Question sur votre facture ?</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Notre équipe billing vous répond sous 24h</div>
          </div>
        </div>
        <a 
          href={`mailto:${BILLING_EMAIL}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            backgroundColor: "var(--accent)",
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          <Mail size={14} />
          {BILLING_EMAIL}
        </a>
      </div>
    </PageLayout>
  );
}

function StatCard({ icon, label, value, subvalue, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue?: string;
  color: string;
}) {
  return (
    <div style={{
      padding: 20,
      backgroundColor: "var(--shell-background)",
      borderRadius: 12,
      border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
      {subvalue && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subvalue}</div>}
    </div>
  );
}

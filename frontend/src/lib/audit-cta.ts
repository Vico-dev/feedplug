// Copy unifié du CTA "audit gratuit" partagé par les LP marketing et comparatifs.
// Source unique pour éviter de dupliquer la map de locales dans chaque page LP.
export type AuditCtaCopy = {
  label: string;
  reassurance: string;
  href: string;
};

const AUDIT_CTA_COPY: Record<string, AuditCtaCopy> = {
  fr: {
    label: "Auditer mon flux gratuitement",
    reassurance: "Sans carte bancaire · Sans engagement · 5 min",
    href: "/audit-flux",
  },
  en: {
    label: "Audit my feed for free",
    reassurance: "No credit card · No commitment · 5 min",
    href: "/audit-flux",
  },
  es: {
    label: "Auditar mi feed gratis",
    reassurance: "Sin tarjeta · Sin compromiso · 5 min",
    href: "/audit-flux",
  },
};

export function getAuditCta(locale: string): AuditCtaCopy {
  const base = AUDIT_CTA_COPY[locale] ?? AUDIT_CTA_COPY.fr;
  return {
    ...base,
    href: locale === "fr" ? base.href : `/${locale}${base.href}`,
  };
}

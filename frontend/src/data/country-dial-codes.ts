/** Indicatifs téléphoniques (E.164) pour le formulaire entreprise */
export const COUNTRY_DIAL_CODES: { code: string; dial: string; label: string }[] = [
  { code: "FR", dial: "+33", label: "France" },
  { code: "BE", dial: "+32", label: "Belgique" },
  { code: "CH", dial: "+41", label: "Suisse" },
  { code: "LU", dial: "+352", label: "Luxembourg" },
  { code: "GB", dial: "+44", label: "Royaume-Uni" },
  { code: "US", dial: "+1", label: "États-Unis" },
  { code: "CA", dial: "+1", label: "Canada" },
  { code: "ES", dial: "+34", label: "Espagne" },
  { code: "IT", dial: "+39", label: "Italie" },
  { code: "DE", dial: "+49", label: "Allemagne" },
  { code: "NL", dial: "+31", label: "Pays-Bas" },
  { code: "PT", dial: "+351", label: "Portugal" },
  { code: "MA", dial: "+212", label: "Maroc" },
  { code: "TN", dial: "+216", label: "Tunisie" },
  { code: "DZ", dial: "+213", label: "Algérie" },
  { code: "SN", dial: "+221", label: "Sénégal" },
  { code: "CI", dial: "+225", label: "Côte d'Ivoire" },
  { code: "PL", dial: "+48", label: "Pologne" },
  { code: "SE", dial: "+46", label: "Suède" },
  { code: "OTHER", dial: "OTHER", label: "Autre (saisir indicatif)" },
];

/** Construit un numéro E.164 à partir de l'indicatif et du numéro national (sans espaces, sans 0 initial pour FR). */
export function buildE164(dial: string, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D/g, "");
  if (!dial) return digits ? `+${digits}` : "";
  if (dial === "+") return "";
  const prefix = dial.startsWith("+") ? dial : `+${dial}`;
  return `${prefix}${digits}`;
}

'use strict';
// Client minimal de la Publisher API AWIN (transactions). Token = Bearer (OAuth2).
const AWIN_BASE = 'https://api.awin.com';

/** Récupère les transactions d'un publisher sur une fenêtre. Retourne un tableau (vide si aucune). */
async function fetchTransactions({ token, publisherId, startDate, endDate, dateType = 'transaction', timezone = 'Europe/Paris' }) {
  if (!token || !publisherId) throw new Error('token et publisherId requis');
  const url = `${AWIN_BASE}/publishers/${encodeURIComponent(publisherId)}/transactions/`
    + `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    + `&timezone=${encodeURIComponent(timezone)}&dateType=${encodeURIComponent(dateType)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AWIN ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

module.exports = { fetchTransactions, AWIN_BASE };

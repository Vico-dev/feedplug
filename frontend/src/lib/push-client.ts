/**
 * push-client.ts — Client Web Push du comparateur B2C (alertes baisse de prix).
 *
 * Orchestration côté navigateur : permission → service worker prêt →
 * PushManager.subscribe (clé VAPID publique récupérée au backend) → POST de
 * l'abonnement. Le SW (/sw.js) affiche la notification à réception du payload
 * { title, body, url } et ouvre l'URL au clic.
 *
 * Toutes les fonctions sont client-only (window/navigator) : à n'appeler que
 * depuis des composants "use client" (ex: push-opt-in.tsx).
 */

import { getPushPublicKey, subscribePush, unsubscribePush } from "@/lib/comparator-api";

export type PushPermissionState = NotificationPermission | "unsupported";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "error" };

/** Web Push disponible sur ce navigateur ? (SW + PushManager + Notification) */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** État courant de la permission notifications ("unsupported" si pas de Web Push). */
export function getPermissionState(): PushPermissionState {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Convertit une clé VAPID base64url en Uint8Array (format attendu par
 * PushManager.subscribe / applicationServerKey).
 */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** L'abonnement push actif de ce navigateur, s'il existe (null sinon). */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Active les alertes push : demande la permission, attend le SW, s'abonne
 * auprès du push service avec la clé VAPID du backend, puis enregistre
 * l'abonnement côté serveur (cookie cmp_session requis).
 */
export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  // Clé publique VAPID — 503 si le push n'est pas configuré côté backend.
  let publicKey: string;
  try {
    ({ publicKey } = await getPushPublicKey());
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));
    await subscribePush(subscription.toJSON());
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Désactive les alertes push : désabonne localement puis retire l'endpoint
 * côté serveur (best-effort : le backend purge de toute façon les endpoints morts).
 */
export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return { ok: true };

  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    // On tente quand même le retrait serveur.
  }
  try {
    await unsubscribePush(endpoint);
  } catch {
    // Best-effort : l'endpoint mort sera purgé au prochain envoi backend.
  }
  return { ok: true };
}

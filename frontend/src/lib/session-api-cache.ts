type SessionCacheEnvelope<T> = {
  createdAt: number;
  value: T;
};

export const SESSION_API_CACHE_KEYS = {
  onboardingProgress: "session-api-cache:onboarding-progress",
  companyInfo: "session-api-cache:company-info",
  companyInfoStatus: "session-api-cache:company-info-status",
} as const;

export function readSessionApiCache<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as SessionCacheEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.createdAt !== "number") {
      window.sessionStorage.removeItem(key);
      return null;
    }
    if (Date.now() - parsed.createdAt > maxAgeMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writeSessionApiCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SessionCacheEnvelope<T> = {
      createdAt: Date.now(),
      value,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

export function clearSessionApiCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

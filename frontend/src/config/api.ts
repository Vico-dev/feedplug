const DEFAULT_BACKEND_ORIGIN = "https://feedplug-backend-marketing-771607738477.europe-west1.run.app";

export const FEEDPLUG_PROXY_PATH = "/feedplug-api";
export const FEEDPLUG_API_V1_PATH = "/api/v1";

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeBackendOrigin(value: string): string {
  return stripTrailingSlashes(value).replace(/\/api\/v1$/i, "");
}

export function getConfiguredBackendOrigin(): string {
  return normalizeBackendOrigin(
    process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
      DEFAULT_BACKEND_ORIGIN
  );
}

export function getBackendApiBaseUrl(): string {
  return `${getConfiguredBackendOrigin()}${FEEDPLUG_API_V1_PATH}`;
}

export function getProxyApiBaseUrl(origin: string): string {
  return `${stripTrailingSlashes(origin)}${FEEDPLUG_PROXY_PATH}`;
}

export function getFeedplugApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return getProxyApiBaseUrl(window.location.origin || "");
  }
  return getBackendApiBaseUrl();
}

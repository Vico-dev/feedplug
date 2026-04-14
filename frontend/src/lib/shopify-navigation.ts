const SHOPIFY_EMBEDDED_PARAM_KEYS = ["host", "embedded", "shop"] as const;

type SearchParamSource =
  | string
  | URLSearchParams
  | { toString(): string }
  | null
  | undefined;

function toSearchParams(source: SearchParamSource): URLSearchParams {
  if (!source) return new URLSearchParams();
  if (typeof source === "string") {
    return new URLSearchParams(source.startsWith("?") ? source.slice(1) : source);
  }
  return new URLSearchParams(source.toString());
}

export function getShopifyEmbeddedParams(source: SearchParamSource): URLSearchParams {
  const incoming = toSearchParams(source);
  const nextParams = new URLSearchParams();

  SHOPIFY_EMBEDDED_PARAM_KEYS.forEach((key) => {
    const value = incoming.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });

  if (nextParams.has("host") && !nextParams.has("embedded")) {
    nextParams.set("embedded", "1");
  }

  return nextParams;
}

export function appendShopifyEmbeddedParams(path: string, source: SearchParamSource): string {
  const embeddedParams = getShopifyEmbeddedParams(source);
  if (!embeddedParams.toString()) {
    return path;
  }

  const [pathAndQuery, hash = ""] = path.split("#", 2);
  const [pathname, rawQuery = ""] = pathAndQuery.split("?", 2);
  const nextParams = new URLSearchParams(rawQuery);

  embeddedParams.forEach((value, key) => {
    if (!nextParams.has(key)) {
      nextParams.set(key, value);
    }
  });

  const query = nextParams.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

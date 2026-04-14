export type OptimizedPlatformKey = "gmc" | "meta" | "amazon" | "chatgpt";

export interface OptimizedPlatformContent {
  title?: string;
  description?: string;
  highlights: string[];
}

export interface PreferredOptimizedPlatformContent extends OptimizedPlatformContent {
  platform: OptimizedPlatformKey;
}

export function parseProductCustomFields(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof input === "object" && input !== null ? { ...(input as Record<string, unknown>) } : {};
}

export function getOptimizedPlatformContent(
  customfieldsInput: unknown,
  platform: OptimizedPlatformKey
): OptimizedPlatformContent {
  const customfields = parseProductCustomFields(customfieldsInput);
  const optimized = customfields.optimized;
  if (!optimized || typeof optimized !== "object") {
    return { highlights: [] };
  }

  const platformContent = (optimized as Record<string, unknown>)[platform];
  if (!platformContent || typeof platformContent !== "object") {
    return { highlights: [] };
  }

  const record = platformContent as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    highlights: Array.isArray(record.highlights)
      ? record.highlights.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
  };
}

export function getPreferredOptimizedPlatformContent(
  customfieldsInput: unknown,
  preferredPlatform: OptimizedPlatformKey = "gmc"
): PreferredOptimizedPlatformContent | null {
  const platforms: OptimizedPlatformKey[] = [preferredPlatform, "meta", "amazon", "chatgpt"].filter(
    (value, index, arr): value is OptimizedPlatformKey => arr.indexOf(value) === index
  );

  for (const platform of platforms) {
    const content = getOptimizedPlatformContent(customfieldsInput, platform);
    if (content.title || content.description || content.highlights.length > 0) {
      return {
        platform,
        ...content,
      };
    }
  }

  return null;
}

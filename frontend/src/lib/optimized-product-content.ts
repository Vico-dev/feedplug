export type OptimizedPlatformKey = "gmc" | "meta" | "amazon" | "chatgpt";

export interface OptimizedPlatformContent {
  title?: string;
  description?: string;
  highlights: string[];
}

export interface PreferredOptimizedPlatformContent extends OptimizedPlatformContent {
  platform: OptimizedPlatformKey;
}

interface OptimizedContentOptions {
  destinationId?: string | null;
  allowPlatformFallback?: boolean;
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

function getDestinationScopedContent(
  customfieldsInput: unknown,
  destinationId?: string | null,
  expectedPlatform?: OptimizedPlatformKey
): Record<string, unknown> | null {
  const normalizedDestinationId = String(destinationId || "").trim();
  if (!normalizedDestinationId) return null;

  const customfields = parseProductCustomFields(customfieldsInput);
  const scoped = customfields.optimizedDestinations;
  if (!scoped || typeof scoped !== "object") return null;

  const destinationScoped = (scoped as Record<string, unknown>)[normalizedDestinationId];
  if (!destinationScoped || typeof destinationScoped !== "object") return null;

  if (expectedPlatform) {
    const storedPlatform = typeof (destinationScoped as Record<string, unknown>).platform === "string"
      ? ((destinationScoped as Record<string, unknown>).platform as string)
      : null;
    if (storedPlatform && storedPlatform !== expectedPlatform) return null;
  }

  return destinationScoped as Record<string, unknown>;
}

export function getOptimizedPlatformContent(
  customfieldsInput: unknown,
  platform: OptimizedPlatformKey,
  options: OptimizedContentOptions = {}
): OptimizedPlatformContent {
  const customfields = parseProductCustomFields(customfieldsInput);
  const destinationScoped = getDestinationScopedContent(customfields, options.destinationId, platform);
  if (destinationScoped) {
    return {
      title: typeof destinationScoped.title === "string" ? destinationScoped.title : undefined,
      description: typeof destinationScoped.description === "string" ? destinationScoped.description : undefined,
      highlights: Array.isArray(destinationScoped.highlights)
        ? destinationScoped.highlights.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [],
    };
  }

  if (options.destinationId && options.allowPlatformFallback === false) {
    return { highlights: [] };
  }

  const optimized = customfields.optimized;
  if (!optimized || typeof optimized !== "object") {
    return {
      title: typeof customfields.optimized_title === "string" ? customfields.optimized_title : undefined,
      description: typeof customfields.optimized_description === "string" ? customfields.optimized_description : undefined,
      highlights: [],
    };
  }

  const platformContent = (optimized as Record<string, unknown>)[platform];
  if (!platformContent || typeof platformContent !== "object") {
    return {
      title: typeof customfields.optimized_title === "string" ? customfields.optimized_title : undefined,
      description: typeof customfields.optimized_description === "string" ? customfields.optimized_description : undefined,
      highlights: [],
    };
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

export function hasStoredOptimizedContent(
  customfieldsInput: unknown,
  platform: OptimizedPlatformKey,
  options: OptimizedContentOptions = {}
): boolean {
  const destinationScoped = getDestinationScopedContent(customfieldsInput, options.destinationId, platform);
  if (destinationScoped) {
    if (typeof destinationScoped.title === "string" && destinationScoped.title.trim().length > 0) return true;
    if (typeof destinationScoped.description === "string" && destinationScoped.description.trim().length > 0) return true;
    if (Array.isArray(destinationScoped.highlights) && destinationScoped.highlights.some((entry) => typeof entry === "string" && entry.trim().length > 0)) return true;
  }

  if (options.destinationId && options.allowPlatformFallback === false) {
    return false;
  }

  const content = getOptimizedPlatformContent(customfieldsInput, platform);
  return Boolean(content.title || content.description || content.highlights.length > 0);
}

export function getPreferredOptimizedPlatformContent(
  customfieldsInput: unknown,
  preferredPlatform: OptimizedPlatformKey = "gmc",
  options: OptimizedContentOptions = {}
): PreferredOptimizedPlatformContent | null {
  const platforms: OptimizedPlatformKey[] = [preferredPlatform, "meta", "amazon", "chatgpt"].filter(
    (value, index, arr): value is OptimizedPlatformKey => arr.indexOf(value) === index
  );

  for (const platform of platforms) {
    const content = getOptimizedPlatformContent(customfieldsInput, platform, options);
    if (content.title || content.description || content.highlights.length > 0) {
      return {
        platform,
        ...content,
      };
    }
  }

  return null;
}

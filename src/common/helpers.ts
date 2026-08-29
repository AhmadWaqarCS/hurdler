/**
 * Masks an API key for safe logging and metrics.
 * Example: 'sk-ant-api03-abcdef123456' -> 'sk-ant...3456'
 */
export function maskApiKey(key: string, visiblePrefix = 6, visibleSuffix = 4): string {
  if (!key || typeof key !== 'string') {
    return '***';
  }
  const trimmed = key.trim();
  if (trimmed.length <= visiblePrefix + visibleSuffix) {
    return '***';
  }
  const start = trimmed.slice(0, visiblePrefix);
  const end = trimmed.slice(-visibleSuffix);
  return `${start}...${end}`;
}

/**
 * Rounds a floating-point number to a specified number of decimal places (default: 6).
 */
export function roundToDecimals(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Parses a comma-separated string or array into a clean array of non-empty strings.
 */
export function parseCommaSeparatedList(input?: string | string[] | null): string[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Sleep helper for asynchronous backoff / retry.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deeply freezes an object to make it completely immutable.
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as Record<string, unknown>)[prop];
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  });
  return obj;
}

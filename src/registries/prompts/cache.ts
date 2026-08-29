import type { PromptCacheStats } from './types.js';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * In-memory cache for rendered and composed prompt outputs with TTL and stats tracking.
 */
export class PromptCacheEngine {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  /**
   * Generates a deterministic cache key from a prefix and payload object.
   */
  generateKey(prefix: string, payload: unknown): string {
    try {
      const serialized = JSON.stringify(payload, Object.keys(payload as object || {}).sort());
      return `${prefix}:${serialized}`;
    } catch {
      return `${prefix}:${String(payload)}`;
    }
  }

  /**
   * Retrieves a cached value if present and not expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.invalidations++;
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Checks if an unexpired key exists in cache.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.invalidations++;
      return false;
    }
    return true;
  }

  /**
   * Sets a value in cache with optional TTL in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Deletes a specific key from cache.
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.invalidations++;
    }
    return existed;
  }

  /**
   * Clears all cached entries.
   */
  clear(): void {
    this.invalidations += this.cache.size;
    this.cache.clear();
  }

  /**
   * Returns cache metrics.
   */
  getStats(): PromptCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
      size: this.cache.size,
    };
  }

  /**
   * Resets hit/miss/invalidation counters.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }
}

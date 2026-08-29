import { maskApiKey } from '../../common/helpers.js';
import { getProviderApiKeys } from '../../core/config/env.js';
import { devDebug, devError, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import { HurdlerError } from '../../core/errors/base-error.js';
import type {
  ActiveKeyInfo,
  KeyManagerOptions,
  KeyState,
  KeyStatus,
  ProviderKeyPool,
} from './types.js';

export class AllKeysExhaustedError extends HurdlerError {
  constructor(providerId: string, keysStatus: Array<{ maskedKey: string; status: KeyStatus; lastFailureReason?: string }>) {
    const reasons = keysStatus
      .filter((k) => k.lastFailureReason)
      .map((k) => `[Key ${k.maskedKey} (${k.status}): ${k.lastFailureReason}]`)
      .join(', ');
    const reasonSuffix = reasons ? ` Details: ${reasons}` : '';
    super(
      `All API keys for provider '${providerId}' are currently exhausted, rate-limited, or invalid.${reasonSuffix}`,
      {
        code: 'ALL_KEYS_EXHAUSTED',
        details: { providerId, keysStatus },
      }
    );
  }
}

export class NoKeysConfiguredError extends HurdlerError {
  constructor(providerId: string) {
    super(
      `No API keys configured for provider '${providerId}'. Please set the corresponding API key in your .env file (e.g. ${providerId.toUpperCase()}_API_KEY or ${providerId.toUpperCase()}_API_KEYS).`,
      {
        code: 'NO_KEYS_CONFIGURED',
        details: { providerId },
      }
    );
  }
}

/**
 * Manages pools of API keys for each provider, supporting automatic failover,
 * rate limit cooldown, and usage tracking.
 */
export class KeyManager {
  private readonly pools = new Map<string, ProviderKeyPool>();
  private readonly rateLimitCooldownMs: number;
  private readonly quotaExhaustionCooldownMs: number;

  constructor(options: KeyManagerOptions = {}) {
    this.rateLimitCooldownMs = options.rateLimitCooldownMs ?? 60_000; // 1 minute
    this.quotaExhaustionCooldownMs = options.quotaExhaustionCooldownMs ?? 3_600_000; // 1 hour
  }

  /**
   * Initializes or refreshes key pool for a provider with explicit keys or from environment.
   */
  initializeProviderKeys(providerId: string, explicitKeys?: string[]): ProviderKeyPool {
    const normalized = providerId.toLowerCase().trim();
    const rawKeys = explicitKeys ?? getProviderApiKeys(normalized);

    const keys: KeyState[] = rawKeys.map((key) => ({
      key,
      maskedKey: maskApiKey(key),
      status: 'active',
      usageCount: 0,
    }));

    const pool: ProviderKeyPool = {
      providerId: normalized,
      keys,
      currentIndex: 0,
    };

    this.pools.set(normalized, pool);
    devDebug('KEY_MGR', `Initialized key pool for provider '${normalized}' with ${keys.length} key(s)`, {
      provider: normalized,
      totalKeys: keys.length,
      keys: keys.map((k) => k.maskedKey),
    });
    return pool;
  }

  /**
   * Ensures provider pool is loaded, pulling from env if not already populated.
   */
  private getOrCreatePool(providerId: string): ProviderKeyPool {
    const normalized = providerId.toLowerCase().trim();
    let pool = this.pools.get(normalized);
    if (!pool) {
      pool = this.initializeProviderKeys(normalized);
    }
    return pool;
  }

  /**
   * Returns true if there are keys configured for the provider.
   */
  hasKeys(providerId: string): boolean {
    const pool = this.getOrCreatePool(providerId);
    return pool.keys.length > 0;
  }

  /**
   * Sets explicit keys for a provider at runtime.
   */
  setExplicitKeys(providerId: string, keys: string[]): void {
    this.initializeProviderKeys(providerId, keys);
  }

  /**
   * Returns the currently active non-exhausted key for a provider.
   * Auto-refreshes keys whose cooldown period has expired.
   */
  getActiveKey(providerId: string): ActiveKeyInfo {
    const pool = this.getOrCreatePool(providerId);

    if (pool.keys.length === 0) {
      devError('KEY_MGR', `No keys configured for provider '${providerId}'`, undefined, { providerId });
      throw new NoKeysConfiguredError(providerId);
    }

    const now = Date.now();

    // Check if cooldowns expired for any rate_limited / exhausted keys
    for (const keyState of pool.keys) {
      if (keyState.status !== 'invalid' && keyState.cooldownUntil && keyState.cooldownUntil <= now) {
        devInfo('KEY_MGR', `Cooldown expired for key ${keyState.maskedKey} ('${providerId}'), restored to active`);
        keyState.status = 'active';
        keyState.cooldownUntil = undefined;
      }
    }

    // Try starting from current index, then loop through entire pool
    const startIndex = pool.currentIndex;
    for (let offset = 0; offset < pool.keys.length; offset++) {
      const idx = (startIndex + offset) % pool.keys.length;
      const candidate = pool.keys[idx];
      if (candidate.status === 'active') {
        pool.currentIndex = idx;
        devDebug('KEY_MGR', `Active key resolved for '${providerId}' (index: ${idx}, maskedKey: ${candidate.maskedKey})`);
        return {
          key: candidate.key,
          index: idx,
          maskedKey: candidate.maskedKey,
          totalKeys: pool.keys.length,
        };
      }
    }

    // If no active key is available
    const statuses = pool.keys.map((k) => ({
      maskedKey: k.maskedKey,
      status: k.status,
      lastFailureReason: k.lastFailureReason,
    }));
    devError('KEY_MGR', `All API keys for provider '${providerId}' are currently exhausted`, undefined, {
      providerId,
      statuses,
    });
    throw new AllKeysExhaustedError(providerId, statuses);
  }

  /**
   * Marks a key as failed when an API call encounters an error (e.g. rate limit, quota, invalid key).
   * Automatically updates its status, schedules cooldown, and advances to the next key.
   * Returns true if another active key is immediately available.
   */
  markKeyFailure(providerId: string, key: string, error: unknown): boolean {
    const pool = this.getOrCreatePool(providerId);
    const keyState = pool.keys.find((k) => k.key === key);
    if (!keyState) {
      return false;
    }

    const errorStr = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errorStr.includes('429') ||
      errorStr.toLowerCase().includes('rate limit') ||
      errorStr.toLowerCase().includes('resource_exhausted') ||
      errorStr.toLowerCase().includes('too many requests');

    const isQuotaExhausted =
      errorStr.toLowerCase().includes('quota') ||
      errorStr.toLowerCase().includes('insufficient_quota') ||
      errorStr.toLowerCase().includes('billing') ||
      errorStr.toLowerCase().includes('credit');

    const isInvalidKey =
      errorStr.includes('401') ||
      errorStr.includes('403') ||
      errorStr.toLowerCase().includes('invalid api key') ||
      errorStr.toLowerCase().includes('unauthorized') ||
      errorStr.toLowerCase().includes('api_key_invalid');

    keyState.lastFailureTime = Date.now();
    keyState.lastFailureReason = errorStr;

    if (isInvalidKey) {
      keyState.status = 'invalid';
      keyState.cooldownUntil = undefined;
    } else if (isQuotaExhausted) {
      keyState.status = 'exhausted';
      keyState.cooldownUntil = Date.now() + this.quotaExhaustionCooldownMs;
    } else if (isRateLimit) {
      keyState.status = 'rate_limited';
      keyState.cooldownUntil = Date.now() + this.rateLimitCooldownMs;
    } else {
      // General error / transient failure -> shorter cooldown
      keyState.status = 'rate_limited';
      keyState.cooldownUntil = Date.now() + this.rateLimitCooldownMs;
    }

    // Advance current index to the next key
    pool.currentIndex = (pool.currentIndex + 1) % pool.keys.length;

    // Check if any other key is active
    const hasNextActive = pool.keys.some((k) => k.status === 'active');

    const cooldownDesc = keyState.cooldownUntil
      ? `${Math.round((keyState.cooldownUntil - Date.now()) / 1000)}s`
      : 'indefinite';

    devWarn(
      'KEY_MGR',
      `Key ${keyState.maskedKey} for '${providerId}' marked '${keyState.status}' (cooldown: ${cooldownDesc}). Failover available: ${hasNextActive}`,
      {
        provider: providerId,
        key: keyState.maskedKey,
        status: keyState.status,
        failureReason: errorStr,
        nextIndex: pool.currentIndex,
      }
    );

    return hasNextActive;
  }

  /**
   * Increments usage count when a key succeeds.
   */
  markKeySuccess(providerId: string, key: string): void {
    const pool = this.getOrCreatePool(providerId);
    const keyState = pool.keys.find((k) => k.key === key);
    if (keyState) {
      keyState.usageCount++;
      keyState.status = 'active';
      keyState.cooldownUntil = undefined;
      devDebug('KEY_MGR', `Key ${keyState.maskedKey} for '${providerId}' succeeded (usage count: ${keyState.usageCount})`);
    }
  }

  /**
   * Returns current health and usage status of all keys for a provider.
   */
  getKeysStatus(providerId: string): KeyState[] {
    const pool = this.getOrCreatePool(providerId);
    return pool.keys.map((k) => ({
      ...k,
      key: k.maskedKey, // Safe sanitize for status inspections
    }));
  }

  /**
   * Resets all key states for a provider back to active.
   */
  resetProviderKeyStates(providerId: string): void {
    const pool = this.getOrCreatePool(providerId);
    for (const key of pool.keys) {
      key.status = 'active';
      key.cooldownUntil = undefined;
      key.lastFailureReason = undefined;
    }
    pool.currentIndex = 0;
    devInfo('KEY_MGR', `Reset all key states to active for provider '${providerId}'`);
  }
}

/** Default singleton instance of the KeyManager */
export const defaultKeyManager = new KeyManager();


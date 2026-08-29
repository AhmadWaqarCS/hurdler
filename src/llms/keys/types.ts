export type KeyStatus = 'active' | 'rate_limited' | 'exhausted' | 'invalid';

export interface KeyState {
  key: string;
  maskedKey: string;
  status: KeyStatus;
  lastFailureTime?: number;
  lastFailureReason?: string;
  cooldownUntil?: number;
  usageCount: number;
}

export interface ProviderKeyPool {
  providerId: string;
  keys: KeyState[];
  currentIndex: number;
}

export interface KeyManagerOptions {
  /** Cooldown time in milliseconds after a 429 rate limit error (default: 60,000 ms / 1 minute) */
  rateLimitCooldownMs?: number;
  /** Cooldown time in milliseconds after a quota exhaustion error (default: 3,600,000 ms / 1 hour) */
  quotaExhaustionCooldownMs?: number;
}

export interface ActiveKeyInfo {
  key: string;
  index: number;
  maskedKey: string;
  totalKeys: number;
}

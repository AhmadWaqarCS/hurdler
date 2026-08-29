import type { ApiTier } from '../../registries/llms/types.js';

export interface TokenUsage {
  /** Uncached or total prompt/input tokens */
  promptTokens: number;
  /** Tokens generated in response/completion */
  completionTokens: number;
  /** Tokens read from prompt cache */
  cachedPromptTokens: number;
  /** Tokens written to cache (if applicable) */
  cachedWriteTokens: number;
  /** Total tokens (prompt + completion) */
  totalTokens: number;
}

export interface CostBreakdown {
  /** Cost in USD for uncached input tokens */
  inputCost: number;
  /** Cost in USD for output tokens */
  outputCost: number;
  /** Cost in USD for cached input read tokens */
  cachedReadCost: number;
  /** Cost in USD for cached input write tokens */
  cachedWriteCost: number;
  /** Total cost in USD */
  totalCost: number;
  /** Estimated USD savings achieved via prompt caching */
  savingsFromCaching: number;
  /** Billing currency (USD) */
  currency: 'USD';
}

export interface CallBillingRecord {
  id: string;
  timestamp: number;
  providerId: string;
  modelId: string;
  tier: ApiTier;
  usage: TokenUsage;
  cost: CostBreakdown;
}

export interface SessionSummary {
  totalCalls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens: number;
  totalCost: number;
  totalSavings: number;
  currency: 'USD';
  byProvider: Record<string, { totalCalls: number; totalTokens: number; totalCost: number }>;
  byModel: Record<string, { totalCalls: number; totalTokens: number; totalCost: number }>;
}

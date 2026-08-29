import { roundToDecimals } from '../../common/helpers.js';
import { getTierPricing } from '../../registries/llms/service.js';
import type { ApiTier, TierPricing } from '../../registries/llms/types.js';
import type { CostBreakdown, TokenUsage } from './types.js';

/**
 * Calculates exact billing costs and caching savings for a model invocation based on pricing.
 *
 * @param usage - Normalized token usage statistics.
 * @param pricing - Tier pricing details for the model.
 * @returns CostBreakdown containing input, output, cached read/write, total cost, and savings.
 */
export function calculateCost(usage: TokenUsage, pricing: TierPricing): CostBreakdown {
  const cachedReadTokens = Math.max(0, usage.cachedPromptTokens || 0);
  const cachedWriteTokens = Math.max(0, usage.cachedWriteTokens || 0);
  const uncachedPromptTokens = Math.max(0, (usage.promptTokens || 0) - cachedReadTokens);
  const completionTokens = Math.max(0, usage.completionTokens || 0);

  // Input cost for uncached tokens
  const inputCost = (uncachedPromptTokens / 1_000_000) * pricing.inputCostPerMillion;

  // Cached read cost
  const cachedReadRate = pricing.cachedReadCostPerMillion ?? pricing.inputCostPerMillion;
  const cachedReadCost = (cachedReadTokens / 1_000_000) * cachedReadRate;

  // Cached write/creation cost
  const cachedWriteRate = pricing.cachedWriteCostPerMillion ?? pricing.inputCostPerMillion;
  const cachedWriteCost = (cachedWriteTokens / 1_000_000) * cachedWriteRate;

  // Output completion cost
  const outputCost = (completionTokens / 1_000_000) * pricing.outputCostPerMillion;

  // Total cost
  const totalCost = inputCost + cachedReadCost + cachedWriteCost + outputCost;

  // Savings computation: what it would have cost without caching
  const hypotheticalUncachedCost =
    ((uncachedPromptTokens + cachedReadTokens) / 1_000_000) * pricing.inputCostPerMillion +
    outputCost;
  const savings = Math.max(0, hypotheticalUncachedCost - totalCost);

  return {
    inputCost: roundToDecimals(inputCost, 6),
    outputCost: roundToDecimals(outputCost, 6),
    cachedReadCost: roundToDecimals(cachedReadCost, 6),
    cachedWriteCost: roundToDecimals(cachedWriteCost, 6),
    totalCost: roundToDecimals(totalCost, 6),
    savingsFromCaching: roundToDecimals(savings, 6),
    currency: 'USD',
  };
}

/**
 * Normalizes raw usage data from AI SDK into structured TokenUsage,
 * supporting both v7 (inputTokens/outputTokens) and legacy (promptTokens/completionTokens) formats.
 */
export function normalizeUsage(rawUsage?: {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedPromptTokens?: number;
  cachedWriteTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    textTokens?: number;
    reasoningTokens?: number;
  };
  [key: string]: unknown;
}): TokenUsage {
  const prompt = rawUsage?.inputTokens ?? rawUsage?.promptTokens ?? 0;
  const completion = rawUsage?.outputTokens ?? rawUsage?.completionTokens ?? 0;
  const cachedPrompt =
    rawUsage?.inputTokenDetails?.cacheReadTokens ?? rawUsage?.cachedPromptTokens ?? 0;
  const cachedWrite =
    rawUsage?.inputTokenDetails?.cacheWriteTokens ?? rawUsage?.cachedWriteTokens ?? 0;
  const total = rawUsage?.totalTokens ?? prompt + completion;

  return {
    promptTokens: prompt,
    completionTokens: completion,
    cachedPromptTokens: cachedPrompt,
    cachedWriteTokens: cachedWrite,
    totalTokens: total,
  };
}

/**
 * Estimates prospective cost for a provider, model, and expected token counts.
 * Useful before running large workflows or batch inferences.
 *
 * @example
 * ```ts
 * const estimate = estimateCost('google', 'gemini-3.7-flash', {
 *   promptTokens: 100_000,
 *   completionTokens: 2_000,
 *   cachedPromptTokens: 80_000
 * });
 * console.log(`Estimated cost: $${estimate.totalCost}`);
 * ```
 */
export function estimateCost(
  providerId: string,
  modelId: string,
  estimatedTokens: {
    promptTokens: number;
    completionTokens?: number;
    cachedPromptTokens?: number;
    cachedWriteTokens?: number;
  },
  tier?: ApiTier
): CostBreakdown {
  const pricing = getTierPricing(providerId, modelId, tier);
  const usage: TokenUsage = {
    promptTokens: estimatedTokens.promptTokens,
    completionTokens: estimatedTokens.completionTokens ?? 0,
    cachedPromptTokens: estimatedTokens.cachedPromptTokens ?? 0,
    cachedWriteTokens: estimatedTokens.cachedWriteTokens ?? 0,
    totalTokens: estimatedTokens.promptTokens + (estimatedTokens.completionTokens ?? 0),
  };
  return calculateCost(usage, pricing);
}

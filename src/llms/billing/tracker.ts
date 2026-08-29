import { roundToDecimals } from '../../common/helpers.js';
import { devDebug } from '../../core/dev-mode/dev-mode.js';
import type { ApiTier } from '../../registries/llms/types.js';
import type { CallBillingRecord, CostBreakdown, SessionSummary, TokenUsage } from './types.js';

/**
 * Tracks and aggregates LLM token usage and billing statistics across sessions.
 */
export class SessionCostTracker {
  private records: CallBillingRecord[] = [];
  private nextId = 1;

  /**
   * Records a completed LLM invocation.
   */
  recordCall(params: {
    providerId: string;
    modelId: string;
    tier: ApiTier;
    usage: TokenUsage;
    cost: CostBreakdown;
  }): CallBillingRecord {
    const record: CallBillingRecord = {
      id: `call_${this.nextId++}_${Date.now()}`,
      timestamp: Date.now(),
      providerId: params.providerId,
      modelId: params.modelId,
      tier: params.tier,
      usage: params.usage,
      cost: params.cost,
    };
    this.records.push(record);
    devDebug(
      'BILLING',
      `Recorded call billing record '${record.id}' for ${params.providerId}:${params.modelId} (Tokens: ${params.usage.totalTokens}, Cost: $${params.cost.totalCost.toFixed(6)})`,
      {
        recordId: record.id,
        provider: params.providerId,
        model: params.modelId,
        tier: params.tier,
        usage: params.usage,
        cost: params.cost,
      }
    );
    return record;
  }

  /**
   * Returns all recorded call logs.
   */
  getRecords(): ReadonlyArray<CallBillingRecord> {
    return [...this.records];
  }

  /**
   * Computes a full summary of session usage, costs, savings, and per-provider/model breakdowns.
   */
  getSessionSummary(): SessionSummary {
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedPromptTokens = 0;
    let totalCost = 0;
    let totalSavings = 0;

    const byProvider: Record<string, { totalCalls: number; totalTokens: number; totalCost: number }> = {};
    const byModel: Record<string, { totalCalls: number; totalTokens: number; totalCost: number }> = {};

    for (const rec of this.records) {
      totalTokens += rec.usage.totalTokens;
      promptTokens += rec.usage.promptTokens;
      completionTokens += rec.usage.completionTokens;
      cachedPromptTokens += rec.usage.cachedPromptTokens;
      totalCost += rec.cost.totalCost;
      totalSavings += rec.cost.savingsFromCaching;

      // Provider breakdown
      if (!byProvider[rec.providerId]) {
        byProvider[rec.providerId] = { totalCalls: 0, totalTokens: 0, totalCost: 0 };
      }
      byProvider[rec.providerId].totalCalls++;
      byProvider[rec.providerId].totalTokens += rec.usage.totalTokens;
      byProvider[rec.providerId].totalCost = roundToDecimals(
        byProvider[rec.providerId].totalCost + rec.cost.totalCost,
        6
      );

      // Model breakdown
      if (!byModel[rec.modelId]) {
        byModel[rec.modelId] = { totalCalls: 0, totalTokens: 0, totalCost: 0 };
      }
      byModel[rec.modelId].totalCalls++;
      byModel[rec.modelId].totalTokens += rec.usage.totalTokens;
      byModel[rec.modelId].totalCost = roundToDecimals(
        byModel[rec.modelId].totalCost + rec.cost.totalCost,
        6
      );
    }

    return {
      totalCalls: this.records.length,
      totalTokens,
      promptTokens,
      completionTokens,
      cachedPromptTokens,
      totalCost: roundToDecimals(totalCost, 6),
      totalSavings: roundToDecimals(totalSavings, 6),
      currency: 'USD',
      byProvider,
      byModel,
    };
  }

  /**
   * Resets recorded session history.
   */
  reset(): void {
    this.records = [];
    this.nextId = 1;
  }
}

/** Default singleton instance of the SessionCostTracker */
export const defaultCostTracker = new SessionCostTracker();

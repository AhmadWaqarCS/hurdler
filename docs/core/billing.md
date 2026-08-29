# Billing & Token Economics

The **Billing Subsystem** tracks LLM token consumption, estimates prompt and completion costs based on exact provider pricing tables, and prevents budget overruns.

---

## 📊 Overview

- **Granular Token Accounting**: Tracks prompt tokens, completion tokens, cached tokens, and reasoning tokens.
- **Provider Pricing Engine**: Accurate per-model cost calculations for Google Gemini, Google Vertex AI, Anthropic Claude, and OpenAI.
- **Budget Alerts & Quotas**: Configurable hard and soft spending limits in `.hurdler/config.json`.
- **Dynamic Ledger**: Session and historical usage recorded in `.hurdler/billing/usage.json`.

---

## 💻 CLI Commands

```bash
# View current billing & token consumption stats
hurdler billing stats

# Estimate costs for a prompt length with a given model
hurdler billing estimate --model gemini-2.5-flash --prompt-tokens 5000 --completion-tokens 1000

# Reset session usage counter
hurdler billing reset
```

---

## 📑 Programmatic API Reference

### `recordUsage(record: TokenUsageRecord): Promise<BillingSummary>`

Records token usage from an LLM invocation into the billing ledger.

```typescript
import { recordUsage } from 'hurdler';

const summary = await recordUsage({
  modelId: 'gemini-2.5-flash',
  promptTokens: 1250,
  completionTokens: 350,
  costUsd: 0.000375,
  agentId: 'coder'
});
```

### `getBillingSummary(): Promise<BillingSummary>`

Retrieves aggregated token metrics, total USD spend, and remaining budget.

```typescript
import { getBillingSummary } from 'hurdler';

const stats = await getBillingSummary();
console.log(`Total Spend: $${stats.totalCostUsd.toFixed(4)}`);
```

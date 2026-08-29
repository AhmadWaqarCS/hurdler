/**
 * Hurdler CLI Subsystem - Billing & Cost Tracking Command
 */

import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  getSessionCostSummary,
  resetSessionCost,
} from '../../llms/billing/tracker.js';
import { estimateCost } from '../../llms/billing/calculator.js';
import { getOptionString, getOptionNumber } from '../parser.js';
import type { ApiTier } from '../../registries/llms/types.js';

export const handleBillingStats: CliCommandHandler = async (args, ctx) => {
  const summary = getSessionCostSummary();

  const providerRows = Object.entries(summary.byProvider || {}).map(([prov, data]) => ({
    provider: prov,
    calls: data.totalCalls,
    totalTokens: data.totalTokens.toLocaleString(),
    cost: `$${data.totalCost.toFixed(6)}`,
  }));

  const modelRows = Object.entries(summary.byModel || {}).map(([model, data]) => ({
    model,
    calls: data.totalCalls,
    totalTokens: data.totalTokens.toLocaleString(),
    cost: `$${data.totalCost.toFixed(6)}`,
  }));

  if (!ctx.isJson) {
    printHeader('LLM Session Token Usage & Billing Statistics');
    printKeyValues({
      'Total LLM Calls': summary.totalCalls,
      'Total Tokens': summary.totalTokens.toLocaleString(),
      'Prompt Tokens': summary.promptTokens.toLocaleString(),
      'Completion Tokens': summary.completionTokens.toLocaleString(),
      'Cached Read Tokens': summary.cachedPromptTokens.toLocaleString(),
      'Total Session Cost': `$${summary.totalCost.toFixed(6)} ${summary.currency}`,
      'Caching Savings': `$${summary.totalSavings.toFixed(6)}`,
    });

    if (providerRows.length > 0) {
      console.log('\n📊 Usage by Provider:');
      console.log(
        formatTable(
          providerRows,
          [
            { key: 'provider', label: 'Provider', minWidth: 15 },
            { key: 'calls', label: 'Calls', align: 'right', minWidth: 8 },
            { key: 'totalTokens', label: 'Total Tokens', align: 'right', minWidth: 14 },
            { key: 'cost', label: 'Cost (USD)', align: 'right', minWidth: 12 },
          ],
          { indent: '  ' }
        )
      );
    }

    if (modelRows.length > 0) {
      console.log('\n🤖 Usage by Model:');
      console.log(
        formatTable(
          modelRows,
          [
            { key: 'model', label: 'Model', minWidth: 25 },
            { key: 'calls', label: 'Calls', align: 'right', minWidth: 8 },
            { key: 'totalTokens', label: 'Total Tokens', align: 'right', minWidth: 14 },
            { key: 'cost', label: 'Cost (USD)', align: 'right', minWidth: 12 },
          ],
          { indent: '  ' }
        )
      );
    }
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: summary,
  };
};

export const handleBillingEstimate: CliCommandHandler = async (args, ctx) => {
  const provider = getOptionString(args.options, 'provider', 'p') || 'anthropic';
  const model = getOptionString(args.options, 'model', 'm') || 'claude-3-7-sonnet';
  const promptTokens = getOptionNumber(args.options, 'prompt-tokens', 'in', 1000) ?? 1000;
  const completionTokens = getOptionNumber(args.options, 'completion-tokens', 'out', 500) ?? 500;
  const cachedTokens = getOptionNumber(args.options, 'cached-tokens', 'c', 0) ?? 0;
  const tier = getOptionString(args.options, 'tier', 't') as ApiTier | undefined;

  try {
    const cost = estimateCost(
      provider,
      model,
      {
        promptTokens,
        completionTokens,
        cachedPromptTokens: cachedTokens,
      },
      tier
    );

    if (!ctx.isJson) {
      printHeader(`Cost Estimation for ${provider}:${model}`);
      printKeyValues({
        'Input / Prompt Tokens': promptTokens.toLocaleString(),
        'Output / Completion Tokens': completionTokens.toLocaleString(),
        'Cached Prompt Tokens': cachedTokens.toLocaleString(),
        'Input Cost': `$${cost.inputCost.toFixed(6)}`,
        'Output Cost': `$${cost.outputCost.toFixed(6)}`,
        'Cached Read Cost': `$${cost.cachedReadCost.toFixed(6)}`,
        'Projected Total Cost': `$${cost.totalCost.toFixed(6)} USD`,
        'Estimated Caching Savings': `$${cost.savingsFromCaching.toFixed(6)}`,
      });
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: {
        provider,
        model,
        tokens: { promptTokens, completionTokens, cachedTokens },
        cost,
      },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to calculate estimate: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleBillingReset: CliCommandHandler = async (args, ctx) => {
  resetSessionCost();
  if (!ctx.isJson) {
    printSuccess('Billing session metrics have been reset to zero.');
  }
  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    message: 'Billing metrics reset.',
  };
};

export const billingCommandDefinition: CliCommandDefinition = {
  name: 'billing',
  summary: 'Track token metrics, calculate model costs, and view savings',
  description: 'Inspect live token usage, cost breakdowns per provider/model, and estimate inference prices.',
  usage: 'hurdler billing <stats|estimate|reset> [options]',
  handler: handleBillingStats,
  subcommands: {
    stats: {
      name: 'stats',
      summary: 'Display current session token usage and billing statistics',
      usage: 'hurdler billing stats [options]',
      handler: handleBillingStats,
    },
    estimate: {
      name: 'estimate',
      summary: 'Calculate prospective cost for token inputs/outputs',
      usage: 'hurdler billing estimate [--provider <p>] [--model <m>] [--prompt-tokens <n>] [--completion-tokens <n>]',
      options: [
        { name: 'provider', alias: 'p', description: 'Provider ID (anthropic, google, etc.)', type: 'string', defaultValue: 'anthropic' },
        { name: 'model', alias: 'm', description: 'Model ID', type: 'string', defaultValue: 'claude-3-7-sonnet' },
        { name: 'prompt-tokens', alias: 'in', description: 'Estimated input/prompt token count', type: 'number', defaultValue: 1000 },
        { name: 'completion-tokens', alias: 'out', description: 'Estimated output/completion token count', type: 'number', defaultValue: 500 },
        { name: 'cached-tokens', alias: 'c', description: 'Cached prompt token count', type: 'number', defaultValue: 0 },
        { name: 'tier', alias: 't', description: 'API tier (standard, flex, priority)', type: 'string' },
      ],
      handler: handleBillingEstimate,
    },
    reset: {
      name: 'reset',
      summary: 'Reset current session token and cost counters',
      usage: 'hurdler billing reset',
      handler: handleBillingReset,
    },
  },
  examples: [
    'hurdler billing stats',
    'hurdler billing estimate --provider anthropic --model claude-3-7-sonnet --prompt-tokens 50000 --completion-tokens 2000',
    'hurdler billing reset',
  ],
};

/**
 * Hurdler CLI Subsystem - LLMs Registry Command
 * Manage models registry, inspect capabilities/pricing, test inferences, and sync with disk.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printInfo, printCode } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  listModels,
  getModel,
  registerModel,
  unregisterModel,
  syncLLMRegistry,
} from '../../registries/llms/service.js';
import { callLLM } from '../../llms/engine/call-llm.js';
import { getOptionString } from '../parser.js';

export const handleLLMsList: CliCommandHandler = async (args, ctx) => {
  const providerFilter = getOptionString(args.options, 'provider', 'p');
  const tierFilter = getOptionString(args.options, 'tier', 't');

  let allModels = listModels(providerFilter);

  if (tierFilter) {
    allModels = allModels.filter((m) => m.pricing && tierFilter in m.pricing);
  }

  const rows = allModels.map((m) => {
    const defaultTier = m.defaultTier || 'standard';
    const tierPricing = m.pricing?.[defaultTier] ?? { inputCostPerMillion: 0, outputCostPerMillion: 0 };
    const priceStr = `$${tierPricing.inputCostPerMillion}/$${tierPricing.outputCostPerMillion}`;

    return {
      id: m.id,
      name: m.name,
      provider: m.providerId,
      contextWindow: (m.capabilities?.maxContextTokens || 0).toLocaleString(),
      maxOutput: (m.capabilities?.maxOutputTokens || 0).toLocaleString(),
      pricing: priceStr,
      tier: defaultTier,
    };
  });

  if (!ctx.isJson) {
    printHeader(`Registered LLM Models (${rows.length} total)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'id', label: 'Model ID', minWidth: 24 },
          { key: 'name', label: 'Display Name', minWidth: 22 },
          { key: 'provider', label: 'Provider', minWidth: 14 },
          { key: 'contextWindow', label: 'Context', align: 'right', minWidth: 10 },
          { key: 'maxOutput', label: 'Max Out', align: 'right', minWidth: 10 },
          { key: 'pricing', label: 'In/Out ($/M)', align: 'right', minWidth: 14 },
          { key: 'tier', label: 'Default Tier', minWidth: 12 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: allModels,
  };
};

export const handleLLMsGet: CliCommandHandler = async (args, ctx) => {
  const modelId = args.positionals[0];
  const providerId = getOptionString(args.options, 'provider', 'p') || (modelId?.includes('/') ? modelId.split('/')[0] : 'anthropic');
  const pureModelId = modelId?.includes('/') ? modelId.split('/')[1] : modelId;

  if (!pureModelId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing model ID.',
      suggestion: 'Usage: hurdler llms get <modelId> [--provider <provider>]',
    };
  }

  try {
    const model = getModel(providerId, pureModelId);

    if (!ctx.isJson) {
      printHeader(`Model: ${model.name} (${model.id})`);
      printKeyValues({
        'Model ID': model.id,
        'Name': model.name,
        'Provider': model.providerId,
        'Context Window': (model.capabilities?.maxContextTokens || 0).toLocaleString(),
        'Max Output Tokens': (model.capabilities?.maxOutputTokens || 0).toLocaleString(),
        'Default Tier': model.defaultTier || 'standard',
        'Supports Flex': model.capabilities?.supportsFlex ? 'Yes' : 'No',
        'Supports Priority': model.capabilities?.supportsPriority ? 'Yes' : 'No',
      });

      if (model.pricing) {
        console.log('\n💰 Pricing Breakdown (USD per Million Tokens):');
        for (const [tier, p] of Object.entries(model.pricing)) {
          console.log(`  - Tier: ${tier.toUpperCase()}`);
          console.log(`      Input: $${p.inputCostPerMillion}`);
          console.log(`      Output: $${p.outputCostPerMillion}`);
          if (p.cachedReadCostPerMillion !== undefined) {
            console.log(`      Cached Read: $${p.cachedReadCostPerMillion}`);
          }
        }
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: model,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: `Model '${pureModelId}' not found under provider '${providerId}'.`,
      suggestion: `Run 'hurdler llms list' to view available models.`,
    };
  }
};

export const handleLLMsAdd: CliCommandHandler = async (args, ctx) => {
  const filePath = getOptionString(args.options, 'file', 'f');
  const providerId = getOptionString(args.options, 'provider', 'p') || 'anthropic';

  if (!filePath) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --file option.',
      suggestion: 'Usage: hurdler llms add --file <model.json> [--provider <provider>]',
    };
  }

  try {
    const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(content);
    registerModel(providerId, parsed);

    if (!ctx.isJson) {
      printSuccess(`Registered custom LLM model '${parsed.id}' under provider '${providerId}'.`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: `Model '${parsed.id}' registered successfully.`,
      data: parsed,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to register model: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleLLMsRemove: CliCommandHandler = async (args, ctx) => {
  const modelId = args.positionals[0];
  const providerId = getOptionString(args.options, 'provider', 'p') || (modelId?.includes('/') ? modelId.split('/')[0] : 'anthropic');
  const pureModelId = modelId?.includes('/') ? modelId.split('/')[1] : modelId;

  if (!pureModelId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing model ID.',
      suggestion: 'Usage: hurdler llms remove <modelId> [--provider <provider>]',
    };
  }

  try {
    const removed = unregisterModel(providerId, pureModelId);
    if (!ctx.isJson) {
      if (removed) {
        printSuccess(`Unregistered model '${pureModelId}' from provider '${providerId}'.`);
      } else {
        console.log(`Model '${pureModelId}' was not found.`);
      }
    }
    return {
      success: removed,
      exitCode: removed ? ExitCode.SUCCESS : ExitCode.NOT_FOUND,
      data: { modelId: pureModelId, providerId, removed },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to remove model: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleLLMsTest: CliCommandHandler = async (args, ctx) => {
  const rawModel = args.positionals[0] || getOptionString(args.options, 'model', 'm') || 'anthropic/claude-3-7-sonnet';
  const provider = getOptionString(args.options, 'provider', 'p') || (rawModel.includes('/') ? rawModel.split('/')[0] : 'anthropic');
  const model = rawModel.includes('/') ? rawModel.split('/')[1] : rawModel;
  const prompt = getOptionString(args.options, 'prompt') || 'Hello! Please summarize your capabilities in 2 sentences.';

  if (!ctx.isJson) {
    printHeader(`Testing Model Invocation: ${provider}:${model}`);
    printInfo(`Prompt: "${prompt}"`);
  }

  try {
    const response = await callLLM({
      provider,
      model,
      prompt,
    });

    if (!ctx.isJson) {
      printSuccess(`Response received from ${response.model} (${response.provider}):`);
      printCode(response.text);
      printKeyValues({
        'Prompt Tokens': response.usage?.promptTokens ?? 0,
        'Completion Tokens': response.usage?.completionTokens ?? 0,
        'Total Cost': `$${(response.cost?.totalCost ?? 0).toFixed(6)}`,
      });
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: response,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Inference test failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleLLMsSync: CliCommandHandler = async (args, ctx) => {
  const syncPath = getOptionString(args.options, 'path');
  try {
    await syncLLMRegistry({
      projectRoot: ctx.projectRoot,
      targetPath: syncPath,
    });

    if (!ctx.isJson) {
      printSuccess('LLM models registry synchronized with disk.');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: 'LLM models registry synchronized with disk.',
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to sync LLMs registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const llmsCommandDefinition: CliCommandDefinition = {
  name: 'llms',
  summary: 'Manage LLM models, inspect pricing/context, test prompts, and sync with disk',
  description: 'Manage static and custom LLM model definitions, inspect capabilities and pricing tiers, and test model responses.',
  usage: 'hurdler llms <list|get|add|remove|test|sync> [args] [options]',
  handler: handleLLMsList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List all registered LLM models',
      usage: 'hurdler llms list [--provider <p>] [--tier <t>] [options]',
      options: [
        { name: 'provider', alias: 'p', description: 'Filter by provider (anthropic, google, etc.)', type: 'string' },
        { name: 'tier', alias: 't', description: 'Filter by API tier', type: 'string' },
      ],
      handler: handleLLMsList,
    },
    get: {
      name: 'get',
      summary: 'Inspect detailed specification and pricing for a model',
      usage: 'hurdler llms get <modelId> [--provider <provider>]',
      arguments: [{ name: 'modelId', description: 'Model ID (e.g. claude-3-7-sonnet)', required: true }],
      options: [{ name: 'provider', alias: 'p', description: 'Provider ID (anthropic, google, etc.)', type: 'string' }],
      handler: handleLLMsGet,
    },
    add: {
      name: 'add',
      summary: 'Register a custom model from a JSON file',
      usage: 'hurdler llms add --file <path.json> [--provider <provider>]',
      options: [
        { name: 'file', alias: 'f', description: 'Path to model JSON definition', type: 'string', required: true },
        { name: 'provider', alias: 'p', description: 'Target provider ID', type: 'string' },
      ],
      handler: handleLLMsAdd,
    },
    remove: {
      name: 'remove',
      summary: 'Unregister a custom model',
      usage: 'hurdler llms remove <modelId> [--provider <provider>]',
      arguments: [{ name: 'modelId', description: 'Model ID to unregister', required: true }],
      options: [{ name: 'provider', alias: 'p', description: 'Provider ID', type: 'string' }],
      handler: handleLLMsRemove,
    },
    test: {
      name: 'test',
      summary: 'Send a test prompt to an LLM model and display output',
      usage: 'hurdler llms test [modelId] [--prompt "<text>"] [--provider <p>]',
      arguments: [{ name: 'modelId', description: 'Model ID to test', required: false }],
      options: [
        { name: 'prompt', description: 'Prompt text to send', type: 'string' },
        { name: 'provider', alias: 'p', description: 'Provider ID', type: 'string' },
      ],
      handler: handleLLMsTest,
    },
    sync: {
      name: 'sync',
      summary: 'Synchronize models registry with .hurdler/registries/llms.json',
      usage: 'hurdler llms sync [--path <path>]',
      options: [{ name: 'path', description: 'Custom file path override', type: 'string' }],
      handler: handleLLMsSync,
    },
  },
  examples: [
    'hurdler llms list',
    'hurdler llms list --provider google',
    'hurdler llms get claude-3-7-sonnet --provider anthropic',
    'hurdler llms test gemini-2.5-flash --provider google --prompt "Explain ASTs in one sentence"',
    'hurdler llms sync',
  ],
};

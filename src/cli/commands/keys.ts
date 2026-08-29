/**
 * Hurdler CLI Subsystem - Keys Command
 * Manage and check provider API keys and rotation pools.
 */

import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printWarning, printInfo } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  getProviderKeysStatus,
  hasProviderKeys,
  configureProviderKeys,
  resetProviderKeys,
} from '../../llms/keys/key-manager.js';

const KNOWN_PROVIDERS = ['anthropic', 'google', 'google-vertex', 'openai'];

export const handleKeysList: CliCommandHandler = async (args, ctx) => {
  const rows = KNOWN_PROVIDERS.map((provider) => {
    const hasKeys = hasProviderKeys(provider);
    const statuses = getProviderKeysStatus(provider);
    const totalKeys = statuses.length;
    const activeCount = statuses.filter((k) => k.status === 'active').length;
    const cooldownCount = statuses.filter((k) => k.status === 'rate_limited' || k.status === 'exhausted').length;

    return {
      provider,
      status: hasKeys ? (cooldownCount > 0 ? 'PARTIAL' : 'ACTIVE') : 'MISSING',
      totalKeys,
      activeKeys: activeCount,
      inCooldown: cooldownCount,
      sampleKey: statuses[0]?.maskedKey || 'None configured',
    };
  });

  if (!ctx.isJson) {
    printHeader('Provider API Keys & Key Pools');
    console.log(
      formatTable(
        rows,
        [
          { key: 'provider', label: 'Provider', minWidth: 15 },
          { key: 'status', label: 'Pool Status', minWidth: 12 },
          { key: 'totalKeys', label: 'Total', align: 'right', minWidth: 6 },
          { key: 'activeKeys', label: 'Active', align: 'right', minWidth: 8 },
          { key: 'inCooldown', label: 'Cooldown', align: 'right', minWidth: 10 },
          { key: 'sampleKey', label: 'Key Sample', minWidth: 20 },
        ],
        { indent: '  ' }
      )
    );
    console.log('');
    printInfo('Note: All API keys are automatically masked for security.');
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: rows,
  };
};

export const handleKeysCheck: CliCommandHandler = async (args, ctx) => {
  const provider = args.positionals[0];
  const targetProviders = provider ? [provider] : KNOWN_PROVIDERS;

  const results: Record<string, unknown> = {};

  for (const prov of targetProviders) {
    const hasKeys = hasProviderKeys(prov);
    const statuses = getProviderKeysStatus(prov);
    results[prov] = {
      configured: hasKeys,
      totalKeys: statuses.length,
      keys: statuses.map((s) => ({
        maskedKey: s.maskedKey,
        status: s.status,
        usageCount: s.usageCount,
        lastFailureReason: s.lastFailureReason,
      })),
    };
  }

  if (!ctx.isJson) {
    printHeader('API Keys Verification Check');
    for (const [prov, info] of Object.entries(results as Record<string, { configured: boolean; keys: { maskedKey: string; status: string }[] }>)) {
      if (info.configured) {
        printSuccess(`Provider '${prov}': ${info.keys.length} key(s) loaded.`);
      } else {
        printWarning(`Provider '${prov}': No keys detected in environment.`);
      }
    }
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: results,
  };
};

export const handleKeysSet: CliCommandHandler = async (args, ctx) => {
  const provider = args.positionals[0];
  const key = args.positionals[1];

  if (!provider || !key) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing provider or key argument.',
      suggestion: 'Usage: hurdler keys set <provider> <key1,key2...>',
    };
  }

  const keyList = key.includes(',') ? key.split(',').map((k) => k.trim()).filter(Boolean) : [key.trim()];
  configureProviderKeys(provider, keyList);

  if (!ctx.isJson) {
    printSuccess(`Configured ${keyList.length} in-memory key(s) for provider '${provider}'.`);
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    message: `Keys configured for provider '${provider}'.`,
    data: { provider, totalConfigured: keyList.length },
  };
};

export const handleKeysReset: CliCommandHandler = async (args, ctx) => {
  const provider = args.positionals[0];
  if (!provider) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing provider argument.',
      suggestion: 'Usage: hurdler keys reset <provider>',
    };
  }

  resetProviderKeys(provider);

  if (!ctx.isJson) {
    printSuccess(`Reset cooldowns and status for provider '${provider}' key pool.`);
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    message: `Key pool reset for provider '${provider}'.`,
    data: { provider },
  };
};

export const keysCommandDefinition: CliCommandDefinition = {
  name: 'keys',
  summary: 'Manage provider API keys, rotation pools, and quota cooldowns',
  description: 'View active API key pools, check provider credentials, dynamically assign keys, and reset cooldowns.',
  usage: 'hurdler keys <list|check|set|reset> [args] [options]',
  handler: handleKeysList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List supported LLM providers and key pool status',
      usage: 'hurdler keys list [options]',
      handler: handleKeysList,
    },
    check: {
      name: 'check',
      summary: 'Verify presence and health of configured provider keys',
      usage: 'hurdler keys check [provider] [options]',
      arguments: [{ name: 'provider', description: 'Provider ID to check', required: false }],
      handler: handleKeysCheck,
    },
    set: {
      name: 'set',
      summary: 'Configure in-memory API keys for a provider',
      usage: 'hurdler keys set <provider> <key1,key2...>',
      arguments: [
        { name: 'provider', description: 'Provider ID (e.g. google, anthropic)', required: true },
        { name: 'key', description: 'API Key or comma-separated list of keys', required: true },
      ],
      handler: handleKeysSet,
    },
    reset: {
      name: 'reset',
      summary: 'Reset cooldowns and errors for a provider key pool',
      usage: 'hurdler keys reset <provider>',
      arguments: [{ name: 'provider', description: 'Provider ID to reset', required: true }],
      handler: handleKeysReset,
    },
  },
  examples: [
    'hurdler keys list',
    'hurdler keys check anthropic',
    'hurdler keys set anthropic sk-ant-api03-...',
    'hurdler keys reset google',
  ],
};

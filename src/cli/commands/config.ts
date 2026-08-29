/**
 * Hurdler CLI Subsystem - Config Command
 * View, query, and modify Hurdler configuration settings.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printKeyValue } from '../formatters/output.js';
import { getEnvConfig } from '../../core/config/env.js';
import { maskApiKey } from '../../common/helpers.js';

export async function readLocalConfig(projectRoot: string): Promise<Record<string, unknown>> {
  const configPath = path.join(projectRoot, '.hurdler', 'config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeLocalConfig(
  projectRoot: string,
  config: Record<string, unknown>
): Promise<void> {
  const configDir = path.join(projectRoot, '.hurdler');
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export const handleConfigShow: CliCommandHandler = async (args, ctx) => {
  const projectRoot = ctx.projectRoot || process.cwd();
  const localConfig = await readLocalConfig(projectRoot);
  const envConfig = getEnvConfig();

  // Mask sensitive env config values
  const safeEnvConfig: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === 'string' && (k.includes('KEY') || k.includes('SECRET') || k.includes('TOKEN'))) {
      safeEnvConfig[k] = maskApiKey(v);
    } else {
      safeEnvConfig[k] = v;
    }
  }

  const data = {
    localConfig,
    environment: safeEnvConfig,
  };

  if (!ctx.isJson) {
    printHeader('Active Hurdler Configuration');
    console.log('\n📁 Local Settings (.hurdler/config.json):');
    if (Object.keys(localConfig).length === 0) {
      console.log('  (No local configuration set. Run `hurdler init` to scaffold.)');
    } else {
      printKeyValues(localConfig);
    }

    console.log('\n🌐 Environment Variables:');
    printKeyValues(safeEnvConfig);
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data,
  };
};

export const handleConfigGet: CliCommandHandler = async (args, ctx) => {
  const key = args.positionals[0];
  if (!key) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing config key name.',
      suggestion: 'Usage: hurdler config get <key>',
    };
  }

  const projectRoot = ctx.projectRoot || process.cwd();
  const localConfig = await readLocalConfig(projectRoot);
  const value = localConfig[key];

  if (!ctx.isJson) {
    if (value !== undefined) {
      printKeyValue(key, value);
    } else {
      console.log(`Key '${key}' is not set.`);
    }
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: { key, value },
  };
};

export const handleConfigSet: CliCommandHandler = async (args, ctx) => {
  const key = args.positionals[0];
  const rawValue = args.positionals[1];

  if (!key || rawValue === undefined) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing config key or value.',
      suggestion: 'Usage: hurdler config set <key> <value>',
    };
  }

  // Parse boolean or number if applicable
  let value: string | boolean | number = rawValue;
  if (rawValue.toLowerCase() === 'true') value = true;
  else if (rawValue.toLowerCase() === 'false') value = false;
  else if (/^-?\d+(\.\d+)?$/.test(rawValue)) value = Number(rawValue);

  const projectRoot = ctx.projectRoot || process.cwd();
  const localConfig = await readLocalConfig(projectRoot);
  localConfig[key] = value;
  await writeLocalConfig(projectRoot, localConfig);

  if (!ctx.isJson) {
    printSuccess(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    message: `Configuration key '${key}' set successfully.`,
    data: { key, value },
  };
};

export const handleConfigPath: CliCommandHandler = async (args, ctx) => {
  const projectRoot = ctx.projectRoot || process.cwd();
  const configPath = path.join(projectRoot, '.hurdler', 'config.json');

  if (!ctx.isJson) {
    printKeyValue('Config File Path', configPath);
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: { configPath },
  };
};

export const configCommandDefinition: CliCommandDefinition = {
  name: 'config',
  summary: 'View, query, and modify Hurdler configuration settings',
  description: 'Manage project-level configurations (.hurdler/config.json) and inspect environment variables.',
  usage: 'hurdler config <show|get|set|path> [args] [options]',
  handler: handleConfigShow,
  subcommands: {
    show: {
      name: 'show',
      summary: 'Display all local and environment configuration settings',
      usage: 'hurdler config show [options]',
      handler: handleConfigShow,
    },
    get: {
      name: 'get',
      summary: 'Get the value of a configuration key',
      usage: 'hurdler config get <key>',
      arguments: [{ name: 'key', description: 'Configuration key name', required: true }],
      handler: handleConfigGet,
    },
    set: {
      name: 'set',
      summary: 'Set the value of a configuration key',
      usage: 'hurdler config set <key> <value>',
      arguments: [
        { name: 'key', description: 'Configuration key name', required: true },
        { name: 'value', description: 'Value to assign', required: true },
      ],
      handler: handleConfigSet,
    },
    path: {
      name: 'path',
      summary: 'Display the path to the local config.json file',
      usage: 'hurdler config path',
      handler: handleConfigPath,
    },
  },
  examples: [
    'hurdler config show',
    'hurdler config get defaultModel',
    'hurdler config set defaultModel anthropic/claude-3-7-sonnet',
    'hurdler config path',
  ],
};

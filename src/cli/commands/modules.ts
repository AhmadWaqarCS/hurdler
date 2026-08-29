/**
 * Hurdler CLI Subsystem - Modules Registry Command
 * Manage external library recommendations, documentation, imports, and prompt context.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printCode } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  listModules,
  getModule,
  formatModulesPromptContext,
  registerModule,
  unregisterModule,
} from '../../registries/modules/service.js';
import { syncModuleRegistryWithDisk } from '../../registries/modules/storage.js';
import { getOptionString } from '../parser.js';
import type { ModuleCategory } from '../../registries/modules/types.js';

export const handleModulesList: CliCommandHandler = async (args, ctx) => {
  const category = getOptionString(args.options, 'category', 'c') as ModuleCategory | undefined;

  let allModules = listModules(category ? { categories: [category] } : undefined);

  const rows = allModules.map((m) => ({
    name: m.name,
    displayName: m.displayName || m.name,
    category: m.category || 'general',
    version: m.recommendedVersion || m.pinnedVersion || 'latest',
    description: m.description,
  }));

  if (!ctx.isJson) {
    printHeader(`Registered Recommended Modules (${rows.length} total)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'name', label: 'Package Name', minWidth: 20 },
          { key: 'displayName', label: 'Display Name', minWidth: 18 },
          { key: 'category', label: 'Category', minWidth: 16 },
          { key: 'version', label: 'Version', minWidth: 12 },
          { key: 'description', label: 'Description', maxWidth: 40, minWidth: 20 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: allModules,
  };
};

export const handleModulesGet: CliCommandHandler = async (args, ctx) => {
  const name = args.positionals[0];
  if (!name) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing module name.',
      suggestion: 'Usage: hurdler modules get <name>',
    };
  }

  try {
    const mod = getModule(name);

    if (!ctx.isJson) {
      printHeader(`Module: ${mod.displayName} (${mod.name})`);
      printKeyValues({
        'Name': mod.name,
        'Display Name': mod.displayName,
        'Category': mod.category || 'general',
        'Recommended Version': mod.recommendedVersion,
        'Pinned Version': mod.pinnedVersion,
        'Doc URL': mod.docUrl || 'None',
        'Install (npm)': mod.installCommands?.npm || `npm i ${mod.name}`,
        'Description': mod.description,
      });

      if (mod.bestPractices && mod.bestPractices.length > 0) {
        console.log('\n💡 Best Practices:');
        for (const bp of mod.bestPractices) {
          console.log(`  - ${bp}`);
        }
      }

      if (mod.exampleUsage) {
        console.log('\n📝 Usage Example:');
        printCode(mod.exampleUsage, 'typescript');
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: mod,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: `Module '${name}' not found.`,
      suggestion: `Run 'hurdler modules list' to view registered modules.`,
    };
  }
};

export const handleModulesSearch: CliCommandHandler = async (args, ctx) => {
  const query = args.positionals[0] || getOptionString(args.options, 'query', 'q');
  if (!query) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing search query.',
      suggestion: 'Usage: hurdler modules search <query>',
    };
  }

  const allModules = listModules();
  const q = query.toLowerCase();
  const results = allModules.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.displayName.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      (m.tags || []).some((t) => t.toLowerCase().includes(q))
  );

  const rows = results.map((m) => ({
    name: m.name,
    displayName: m.displayName || m.name,
    category: m.category || 'general',
    description: m.description,
  }));

  if (!ctx.isJson) {
    printHeader(`Search Results for "${query}" (${results.length} found)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'name', label: 'Package Name', minWidth: 20 },
          { key: 'displayName', label: 'Display Name', minWidth: 18 },
          { key: 'category', label: 'Category', minWidth: 16 },
          { key: 'description', label: 'Description', maxWidth: 45, minWidth: 20 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: results,
  };
};

export const handleModulesFormat: CliCommandHandler = async (args, ctx) => {
  const category = getOptionString(args.options, 'category', 'c') as ModuleCategory | undefined;
  const formatted = formatModulesPromptContext(category ? { categories: [category] } : undefined);

  if (!ctx.isJson) {
    printHeader('Formatted Modules Prompt Context');
    console.log(formatted);
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: { formatted },
  };
};

export const handleModulesAdd: CliCommandHandler = async (args, ctx) => {
  const filePath = getOptionString(args.options, 'file', 'f');
  if (!filePath) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --file option.',
      suggestion: 'Usage: hurdler modules add --file <module.json>',
    };
  }

  try {
    const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(content);
    registerModule(parsed);

    if (!ctx.isJson) {
      printSuccess(`Registered module '${parsed.name}'.`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: `Module '${parsed.name}' registered.`,
      data: parsed,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to register module: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleModulesRemove: CliCommandHandler = async (args, ctx) => {
  const name = args.positionals[0];
  if (!name) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing module name.',
      suggestion: 'Usage: hurdler modules remove <name>',
    };
  }

  try {
    const removed = unregisterModule(name);
    if (!ctx.isJson) {
      if (removed) {
        printSuccess(`Unregistered module '${name}'.`);
      } else {
        console.log(`Module '${name}' was not found.`);
      }
    }
    return {
      success: removed,
      exitCode: removed ? ExitCode.SUCCESS : ExitCode.NOT_FOUND,
      data: { name, removed },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to remove module: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleModulesSync: CliCommandHandler = async (args, ctx) => {
  const syncPath = getOptionString(args.options, 'path');
  try {
    const result = await syncModuleRegistryWithDisk({
      projectRoot: ctx.projectRoot,
      targetPath: syncPath,
    });

    if (!ctx.isJson) {
      printSuccess('Modules registry synchronized with disk.');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to sync modules registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const modulesCommandDefinition: CliCommandDefinition = {
  name: 'modules',
  summary: 'Manage recommended modules & libraries, search use cases, and generate prompt docs',
  description: 'Manage static and custom library modules (zod, tailwind, lucide, etc.), search capabilities, and format prompt context.',
  usage: 'hurdler modules <list|get|search|format|add|remove|sync> [args] [options]',
  handler: handleModulesList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List all recommended library modules',
      usage: 'hurdler modules list [--category <c>] [options]',
      options: [{ name: 'category', alias: 'c', description: 'Filter by category (validation, styling, db, etc.)', type: 'string' }],
      handler: handleModulesList,
    },
    get: {
      name: 'get',
      summary: 'Inspect module documentation and example usage',
      usage: 'hurdler modules get <name>',
      arguments: [{ name: 'name', description: 'Module name', required: true }],
      handler: handleModulesGet,
    },
    search: {
      name: 'search',
      summary: 'Search modules by keyword, feature, or use case',
      usage: 'hurdler modules search <query>',
      arguments: [{ name: 'query', description: 'Search query', required: true }],
      handler: handleModulesSearch,
    },
    format: {
      name: 'format',
      summary: 'Format modules documentation as LLM prompt context',
      usage: 'hurdler modules format [--category <c>]',
      options: [{ name: 'category', alias: 'c', description: 'Filter category', type: 'string' }],
      handler: handleModulesFormat,
    },
    add: {
      name: 'add',
      summary: 'Register custom module from JSON file',
      usage: 'hurdler modules add --file <module.json>',
      options: [{ name: 'file', alias: 'f', description: 'JSON definition file', type: 'string', required: true }],
      handler: handleModulesAdd,
    },
    remove: {
      name: 'remove',
      summary: 'Unregister a custom module',
      usage: 'hurdler modules remove <name>',
      arguments: [{ name: 'name', description: 'Module name', required: true }],
      handler: handleModulesRemove,
    },
    sync: {
      name: 'sync',
      summary: 'Synchronize modules with .hurdler/registries/modules.json',
      usage: 'hurdler modules sync [--path <path>]',
      options: [{ name: 'path', description: 'Custom path override', type: 'string' }],
      handler: handleModulesSync,
    },
  },
  examples: [
    'hurdler modules list',
    'hurdler modules search "validation"',
    'hurdler modules get zod',
    'hurdler modules format',
    'hurdler modules sync',
  ],
};

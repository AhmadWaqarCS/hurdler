/**
 * Hurdler CLI Subsystem - Prompts Registry Command
 * Manage system prompts, templates, rendering variables, and synchronization.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printCode } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  listPrompts,
  getPrompt,
  renderPrompt,
  registerPrompt,
  unregisterPrompt,
} from '../../registries/prompts/service.js';
import { syncPromptRegistryWithDisk } from '../../registries/prompts/storage.js';
import { getOptionString } from '../parser.js';

export const handlePromptsList: CliCommandHandler = async (args, ctx) => {
  const category = getOptionString(args.options, 'category', 'c');

  let allPrompts = listPrompts();

  if (category) {
    allPrompts = allPrompts.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
  }

  const rows = allPrompts.map((p) => ({
    id: p.id,
    title: p.title || p.id,
    category: p.category || 'general',
    variables: (p.variables || []).join(', ') || 'None',
    cacheable: p.cacheable ? 'yes' : 'no',
    priority: p.priority ?? 50,
  }));

  if (!ctx.isJson) {
    printHeader(`Registered Prompts & Templates (${rows.length} total)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'id', label: 'Prompt ID', minWidth: 26 },
          { key: 'title', label: 'Prompt Title', minWidth: 26 },
          { key: 'category', label: 'Category', minWidth: 16 },
          { key: 'variables', label: 'Variables', minWidth: 20 },
          { key: 'cacheable', label: 'Cacheable', align: 'center', minWidth: 10 },
          { key: 'priority', label: 'Priority', align: 'right', minWidth: 8 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: allPrompts,
  };
};

export const handlePromptsGet: CliCommandHandler = async (args, ctx) => {
  const promptId = args.positionals[0];
  if (!promptId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing prompt ID.',
      suggestion: 'Usage: hurdler prompts get <promptId>',
    };
  }

  try {
    const prompt = getPrompt(promptId);

    if (!ctx.isJson) {
      printHeader(`Prompt: ${prompt.title} (${prompt.id})`);
      printKeyValues({
        'Prompt ID': prompt.id,
        'Title': prompt.title,
        'Category': prompt.category || 'general',
        'Variables': (prompt.variables || []).join(', ') || 'None',
        'Cacheable': prompt.cacheable ? 'Yes' : 'No',
        'Priority': prompt.priority ?? 50,
        'Description': prompt.description || 'No description',
      });

      console.log('\n📝 Template Content:');
      printCode(prompt.content);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: prompt,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: `Prompt '${promptId}' not found.`,
      suggestion: `Run 'hurdler prompts list' to view available prompts.`,
    };
  }
};

export const handlePromptsRender: CliCommandHandler = async (args, ctx) => {
  const promptId = args.positionals[0];
  if (!promptId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing prompt ID.',
      suggestion: 'Usage: hurdler prompts render <promptId> [--param key=value...]',
    };
  }

  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(args.options)) {
    if (!['json', 'dev', 'quiet', 'help', 'version'].includes(k)) {
      variables[k] = String(v);
    }
  }

  try {
    const rendered = renderPrompt(promptId, variables);

    if (!ctx.isJson) {
      printHeader(`Rendered Output: ${promptId}`);
      printCode(rendered);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { promptId, variables, rendered },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to render prompt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handlePromptsAdd: CliCommandHandler = async (args, ctx) => {
  const filePath = getOptionString(args.options, 'file', 'f');
  if (!filePath) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --file option.',
      suggestion: 'Usage: hurdler prompts add --file <prompt.json>',
    };
  }

  try {
    const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(content);
    const registered = registerPrompt(parsed);

    if (!ctx.isJson) {
      printSuccess(`Registered custom prompt '${registered.id}' (${registered.title}).`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: `Prompt '${registered.id}' registered.`,
      data: registered,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to register prompt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handlePromptsRemove: CliCommandHandler = async (args, ctx) => {
  const promptId = args.positionals[0];
  if (!promptId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing prompt ID.',
      suggestion: 'Usage: hurdler prompts remove <promptId>',
    };
  }

  try {
    const removed = unregisterPrompt(promptId);
    if (!ctx.isJson) {
      if (removed) {
        printSuccess(`Unregistered prompt '${promptId}'.`);
      } else {
        console.log(`Prompt '${promptId}' was not found.`);
      }
    }
    return {
      success: removed,
      exitCode: removed ? ExitCode.SUCCESS : ExitCode.NOT_FOUND,
      data: { promptId, removed },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to remove prompt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handlePromptsSync: CliCommandHandler = async (args, ctx) => {
  const syncPath = getOptionString(args.options, 'path');
  try {
    const result = syncPromptRegistryWithDisk(undefined, {
      customPath: syncPath,
    });

    if (!ctx.isJson) {
      printSuccess('Prompts registry synchronized with disk.');
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
      error: `Failed to sync prompts registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const promptsCommandDefinition: CliCommandDefinition = {
  name: 'prompts',
  summary: 'Manage prompt templates, render system prompts, and sync with disk',
  description: 'Manage prompt engineering templates, render prompts with dynamic variables, and synchronize definitions.',
  usage: 'hurdler prompts <list|get|render|add|remove|sync> [args] [options]',
  handler: handlePromptsList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List all registered prompts',
      usage: 'hurdler prompts list [--category <c>] [options]',
      options: [
        { name: 'category', alias: 'c', description: 'Filter by prompt category', type: 'string' },
      ],
      handler: handlePromptsList,
    },
    get: {
      name: 'get',
      summary: 'Inspect prompt details and template body',
      usage: 'hurdler prompts get <promptId>',
      arguments: [{ name: 'promptId', description: 'Prompt ID', required: true }],
      handler: handlePromptsGet,
    },
    render: {
      name: 'render',
      summary: 'Render a prompt template with provided parameters',
      usage: 'hurdler prompts render <promptId> [--param key=value...]',
      arguments: [{ name: 'promptId', description: 'Prompt ID', required: true }],
      handler: handlePromptsRender,
    },
    add: {
      name: 'add',
      summary: 'Register custom prompt from JSON file',
      usage: 'hurdler prompts add --file <prompt.json>',
      options: [{ name: 'file', alias: 'f', description: 'JSON definition file', type: 'string', required: true }],
      handler: handlePromptsAdd,
    },
    remove: {
      name: 'remove',
      summary: 'Unregister a custom prompt',
      usage: 'hurdler prompts remove <promptId>',
      arguments: [{ name: 'promptId', description: 'Prompt ID', required: true }],
      handler: handlePromptsRemove,
    },
    sync: {
      name: 'sync',
      summary: 'Synchronize prompts with .hurdler/registries/prompts.json',
      usage: 'hurdler prompts sync [--path <path>]',
      options: [{ name: 'path', description: 'Custom path override', type: 'string' }],
      handler: handlePromptsSync,
    },
  },
  examples: [
    'hurdler prompts list',
    'hurdler prompts get architect-system-prompt',
    'hurdler prompts render nextjs-business-logic --framework "Next.js 15"',
    'hurdler prompts sync',
  ],
};

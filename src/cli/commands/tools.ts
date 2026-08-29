/**
 * Hurdler CLI Subsystem - Tools Registry Command
 * Manage native and custom tools, inspect schemas, execute tools, and sync with disk.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printCode } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  listTools,
  getTool,
  runTool,
  registerTool,
  unregisterTool,
  syncToolRegistry,
} from '../../registries/tools/service.js';
import { getOptionString } from '../parser.js';
import type { ToolCategory } from '../../registries/tools/types.js';

export const handleToolsList: CliCommandHandler = async (args, ctx) => {
  const category = getOptionString(args.options, 'category', 'c');

  let allTools = listTools();

  if (category) {
    allTools = allTools.filter((t) => t.category?.toLowerCase() === category.toLowerCase());
  }

  const rows = allTools.map((t) => ({
    name: t.name,
    category: t.category || 'general',
    description: t.description,
    readOnly: t.readOnly ? 'yes' : 'no',
    danger: t.isDangerous ? 'DANGEROUS' : 'SAFE',
    enabled: t.enabled !== false ? 'yes' : 'no',
  }));

  if (!ctx.isJson) {
    printHeader(`Registered Native & Custom Tools (${rows.length} total)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'name', label: 'Tool Name', minWidth: 22 },
          { key: 'category', label: 'Category', minWidth: 14 },
          { key: 'danger', label: 'Safety', minWidth: 10 },
          { key: 'readOnly', label: 'Read-Only', align: 'center', minWidth: 10 },
          { key: 'description', label: 'Description', maxWidth: 45, minWidth: 20 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: allTools,
  };
};

export const handleToolsGet: CliCommandHandler = async (args, ctx) => {
  const toolName = args.positionals[0];
  if (!toolName) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing tool name.',
      suggestion: 'Usage: hurdler tools get <toolName>',
    };
  }

  try {
    const tool = getTool(toolName);

    if (!ctx.isJson) {
      printHeader(`Tool: ${tool.name}`);
      printKeyValues({
        'Name': tool.name,
        'Category': tool.category || 'general',
        'Safety Level': tool.isDangerous ? 'Dangerous / Modifying' : 'Safe / Non-destructive',
        'Read-Only': tool.readOnly ? 'Yes' : 'No',
        'Enabled': tool.enabled !== false ? 'Yes' : 'No',
        'Tags': (tool.tags || []).join(', ') || 'None',
        'Description': tool.description,
      });

      console.log('\n📐 Parameter Description:');
      printCode(tool.description);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: tool,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: `Tool '${toolName}' not found.`,
      suggestion: `Run 'hurdler tools list' to view registered tools.`,
    };
  }
};

export const handleToolsRun: CliCommandHandler = async (args, ctx) => {
  const toolName = args.positionals[0];
  if (!toolName) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing tool name.',
      suggestion: 'Usage: hurdler tools run <toolName> [--args \'<json>\']',
    };
  }

  let toolArgs: Record<string, unknown> = {};
  const rawArgs = getOptionString(args.options, 'args', 'a');
  const fileArgs = getOptionString(args.options, 'file', 'f');

  if (rawArgs) {
    try {
      toolArgs = JSON.parse(rawArgs);
    } catch (err) {
      return {
        success: false,
        exitCode: ExitCode.INVALID_ARGUMENTS,
        error: `Invalid JSON in --args: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  } else if (fileArgs) {
    try {
      const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), fileArgs), 'utf-8');
      toolArgs = JSON.parse(content);
    } catch (err) {
      return {
        success: false,
        exitCode: ExitCode.INVALID_ARGUMENTS,
        error: `Failed to read args file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    const result = await runTool(toolName, toolArgs, {
      workspaceRoot: ctx.projectRoot,
    });

    if (!ctx.isJson) {
      printHeader(`Tool Execution: ${toolName}`);
      printCode(JSON.stringify(result, null, 2), 'json');
    }

    return {
      success: result.success,
      exitCode: result.success ? ExitCode.SUCCESS : ExitCode.ERROR,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Tool '${toolName}' execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleToolsAdd: CliCommandHandler = async (args, ctx) => {
  const filePath = getOptionString(args.options, 'file', 'f');
  if (!filePath) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --file option.',
      suggestion: 'Usage: hurdler tools add --file <tool.json>',
    };
  }

  try {
    const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(content);
    registerTool(parsed);

    if (!ctx.isJson) {
      printSuccess(`Registered tool '${parsed.name}'.`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: `Tool '${parsed.name}' registered.`,
      data: parsed,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to register tool: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleToolsRemove: CliCommandHandler = async (args, ctx) => {
  const toolName = args.positionals[0];
  if (!toolName) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing tool name.',
      suggestion: 'Usage: hurdler tools remove <toolName>',
    };
  }

  try {
    const removed = unregisterTool(toolName);
    if (!ctx.isJson) {
      if (removed) {
        printSuccess(`Unregistered tool '${toolName}'.`);
      } else {
        console.log(`Tool '${toolName}' was not found.`);
      }
    }
    return {
      success: removed,
      exitCode: removed ? ExitCode.SUCCESS : ExitCode.NOT_FOUND,
      data: { toolName, removed },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to remove tool: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleToolsSync: CliCommandHandler = async (args, ctx) => {
  const syncPath = getOptionString(args.options, 'path');
  try {
    await syncToolRegistry({
      projectRoot: ctx.projectRoot,
      targetPath: syncPath,
    });

    if (!ctx.isJson) {
      printSuccess('Tools registry synchronized with disk.');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: 'Tools registry synchronized with disk.',
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to sync tools registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const toolsCommandDefinition: CliCommandDefinition = {
  name: 'tools',
  summary: 'Manage tools registry, inspect schemas, execute tools, and sync with disk',
  description: 'Manage native (fs, git, mapper, playwright) and custom tools, execute tools safely, and synchronize registries.',
  usage: 'hurdler tools <list|get|run|add|remove|sync> [args] [options]',
  handler: handleToolsList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List all registered tools',
      usage: 'hurdler tools list [--category <c>] [options]',
      options: [{ name: 'category', alias: 'c', description: 'Filter by category (filesystem, git, mapper, playwright, custom)', type: 'string' }],
      handler: handleToolsList,
    },
    get: {
      name: 'get',
      summary: 'Inspect tool parameters, safety level, and details',
      usage: 'hurdler tools get <toolName>',
      arguments: [{ name: 'toolName', description: 'Tool Name', required: true }],
      handler: handleToolsGet,
    },
    run: {
      name: 'run',
      summary: 'Execute a tool with provided arguments',
      usage: 'hurdler tools run <toolName> [--args \'<json>\'] [--file <args.json>]',
      arguments: [{ name: 'toolName', description: 'Tool name to execute', required: true }],
      options: [
        { name: 'args', alias: 'a', description: 'Inline JSON string arguments', type: 'string' },
        { name: 'file', alias: 'f', description: 'Path to arguments JSON file', type: 'string' },
      ],
      handler: handleToolsRun,
    },
    add: {
      name: 'add',
      summary: 'Register custom tool from JSON file',
      usage: 'hurdler tools add --file <tool.json>',
      options: [{ name: 'file', alias: 'f', description: 'JSON definition file', type: 'string', required: true }],
      handler: handleToolsAdd,
    },
    remove: {
      name: 'remove',
      summary: 'Unregister a custom tool',
      usage: 'hurdler tools remove <toolName>',
      arguments: [{ name: 'toolName', description: 'Tool Name', required: true }],
      handler: handleToolsRemove,
    },
    sync: {
      name: 'sync',
      summary: 'Synchronize tools with .hurdler/registries/tools.json',
      usage: 'hurdler tools sync [--path <path>]',
      options: [{ name: 'path', description: 'Custom path override', type: 'string' }],
      handler: handleToolsSync,
    },
  },
  examples: [
    'hurdler tools list',
    'hurdler tools get read_file',
    'hurdler tools run list_directory --args \'{"path":"src"}\'',
    'hurdler tools sync',
  ],
};

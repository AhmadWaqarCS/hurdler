/**
 * Hurdler CLI Subsystem - Workflows & Orchestration Command
 * Manage multi-agent workflow DAGs, run end-to-end autonomous tasks, compose pipelines, and sync with disk.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  listWorkflows,
  getWorkflow,
  registerWorkflow,
  unregisterWorkflow,
} from '../../registries/workflows/service.js';
import { syncWorkflowRegistryWithDisk } from '../../registries/workflows/storage.js';
import { executeWorkflow } from '../../workflows/engine.js';
import { composeWorkflows } from '../../workflows/composition.js';
import { getOptionString, getOptionBoolean } from '../parser.js';

export const handleWorkflowsList: CliCommandHandler = async (args, ctx) => {
  const category = getOptionString(args.options, 'category', 'c');

  let allWorkflows = listWorkflows();

  if (category) {
    allWorkflows = allWorkflows.filter((w) => w.category?.toLowerCase() === category.toLowerCase());
  }

  const rows = allWorkflows.map((w) => ({
    id: w.id,
    title: w.title || w.id,
    category: w.category || 'general',
    stepCount: (w.steps || []).length,
    agents: Array.from(new Set(w.steps.map((s) => s.agentId).filter(Boolean))).join(', ') || 'Various',
    builtin: w.isBuiltin ? 'yes' : 'no',
  }));

  if (!ctx.isJson) {
    printHeader(`Registered Multi-Agent Workflows (${rows.length} total)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'id', label: 'Workflow ID', minWidth: 26 },
          { key: 'title', label: 'Workflow Title', minWidth: 26 },
          { key: 'category', label: 'Category', minWidth: 16 },
          { key: 'stepCount', label: 'Steps', align: 'right', minWidth: 8 },
          { key: 'agents', label: 'Involved Agents', maxWidth: 35, minWidth: 18 },
          { key: 'builtin', label: 'Built-in', align: 'center', minWidth: 8 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: allWorkflows,
  };
};

export const handleWorkflowsGet: CliCommandHandler = async (args, ctx) => {
  const workflowId = args.positionals[0];
  if (!workflowId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing workflow ID.',
      suggestion: 'Usage: hurdler workflows get <workflowId>',
    };
  }

  try {
    const wf = getWorkflow(workflowId);

    if (!ctx.isJson) {
      printHeader(`Workflow: ${wf.title} (${wf.id})`);
      printKeyValues({
        'Workflow ID': wf.id,
        'Title': wf.title,
        'Category': wf.category || 'general',
        'Total Steps': wf.steps.length,
        'Built-in': wf.isBuiltin ? 'Yes' : 'No',
        'Description': wf.description || 'No description',
      });

      console.log('\n🔄 Workflow DAG Steps:');
      const stepRows = wf.steps.map((s, idx) => ({
        index: idx + 1,
        id: s.id,
        title: s.title,
        agent: s.agentId || 'default',
        tools: (s.tools || ['*']).join(', '),
        prereqs: (s.dependsOn || []).join(', ') || 'None',
      }));

      console.log(
        formatTable(
          stepRows,
          [
            { key: 'index', label: '#', align: 'right', minWidth: 4 },
            { key: 'id', label: 'Step ID', minWidth: 20 },
            { key: 'title', label: 'Step Title', minWidth: 22 },
            { key: 'agent', label: 'Agent Assigned', minWidth: 18 },
            { key: 'tools', label: 'Allowed Tools', minWidth: 16 },
            { key: 'prereqs', label: 'Dependencies', minWidth: 14 },
          ],
          { indent: '  ' }
        )
      );
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: wf,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: `Workflow '${workflowId}' not found.`,
      suggestion: `Run 'hurdler workflows list' to view available workflows.`,
    };
  }
};

export const handleWorkflowsRun: CliCommandHandler = async (args, ctx) => {
  const workflowId = args.positionals[0] || 'feature-development';
  const goal = getOptionString(args.options, 'goal', 'g');
  const modelTier = getOptionString(args.options, 'tier', 't') as 'standard' | 'flex' | 'priority' | undefined;
  const autoCommit = !getOptionBoolean(args.options, 'no-git', 'ng', false);

  if (!goal) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --goal option.',
      suggestion: 'Usage: hurdler workflows run <workflowId> --goal "<task description>"',
    };
  }

  if (!ctx.isJson) {
    printHeader(`Executing Workflow: ${workflowId}`);
    printKeyValues({
      'Goal': goal,
      'Model Tier Override': modelTier || 'Default per step',
      'Auto Git Commit': autoCommit ? 'Yes (per agent step)' : 'No',
    });
    console.log('\n🚀 Orchestrating agent execution pipeline...\n');
  }

  try {
    const result = await executeWorkflow(workflowId, {
      projectRoot: ctx.projectRoot,
      modelTierOverride: modelTier,
      autoCommit,
      variables: { userGoal: goal, goal },
    });

    const isSuccess = result.status === 'success';

    if (!ctx.isJson) {
      if (isSuccess) {
        printSuccess(`Workflow '${workflowId}' completed successfully in ${result.durationMs}ms!`);
        printKeyValues({
          'Completed Steps': `${result.stepResults.length}`,
          'Files Generated/Modified': result.generatedFiles.length,
          'Total Tokens': result.totalTokens.totalTokens.toLocaleString(),
          'Estimated Cost': `$${result.totalCost.totalCost.toFixed(6)} USD`,
        });
      } else {
        console.error(`❌ Workflow '${workflowId}' finished with status: ${result.status}`);
        if (result.error) {
          console.error(`   Error: ${result.error}`);
        }
      }
    }

    return {
      success: isSuccess,
      exitCode: isSuccess ? ExitCode.SUCCESS : ExitCode.ERROR,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Workflow execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleWorkflowsCompose: CliCommandHandler = async (args, ctx) => {
  const workflowIds = args.positionals;
  const newTitle = getOptionString(args.options, 'title', 't') || getOptionString(args.options, 'name', 'n') || 'Composed Pipeline';
  const newId = getOptionString(args.options, 'id') || `composed-${Date.now()}`;

  if (workflowIds.length < 2) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Compose requires at least 2 workflow IDs.',
      suggestion: 'Usage: hurdler workflows compose <wf1> <wf2>... --title "<title>" --id <newId>',
    };
  }

  try {
    const composed = composeWorkflows(workflowIds, {
      id: newId,
      title: newTitle,
    });

    if (!ctx.isJson) {
      printSuccess(`Composed workflow '${composed.id}' created with ${composed.steps.length} combined steps.`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: composed,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to compose workflows: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleWorkflowsAdd: CliCommandHandler = async (args, ctx) => {
  const filePath = getOptionString(args.options, 'file', 'f');
  if (!filePath) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --file option.',
      suggestion: 'Usage: hurdler workflows add --file <workflow.json>',
    };
  }

  try {
    const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(content);
    const registered = registerWorkflow(parsed);

    if (!ctx.isJson) {
      printSuccess(`Registered custom workflow '${registered.id}' (${registered.title}).`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: `Workflow '${registered.id}' registered.`,
      data: registered,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to register workflow: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleWorkflowsRemove: CliCommandHandler = async (args, ctx) => {
  const workflowId = args.positionals[0];
  if (!workflowId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing workflow ID.',
      suggestion: 'Usage: hurdler workflows remove <workflowId>',
    };
  }

  try {
    const removed = unregisterWorkflow(workflowId);
    if (!ctx.isJson) {
      if (removed) {
        printSuccess(`Unregistered workflow '${workflowId}'.`);
      } else {
        console.log(`Workflow '${workflowId}' was not found.`);
      }
    }
    return {
      success: removed,
      exitCode: removed ? ExitCode.SUCCESS : ExitCode.NOT_FOUND,
      data: { workflowId, removed },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to remove workflow: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleWorkflowsSync: CliCommandHandler = async (args, ctx) => {
  const syncPath = getOptionString(args.options, 'path');
  try {
    await syncWorkflowRegistryWithDisk({
      projectRoot: ctx.projectRoot,
      targetPath: syncPath,
    });

    if (!ctx.isJson) {
      printSuccess('Workflows registry synchronized with disk.');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: 'Workflows registry synchronized with disk.',
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to sync workflows registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const workflowsCommandDefinition: CliCommandDefinition = {
  name: 'workflows',
  summary: 'Manage multi-agent workflows, run autonomous goal pipelines, and compose workflows',
  description: 'Manage DAG workflow pipelines, orchestrate multi-agent execution loops with auto-debugging, and synchronize workflows with disk.',
  usage: 'hurdler workflows <list|get|run|compose|add|remove|sync> [args] [options]',
  handler: handleWorkflowsList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List all registered multi-agent workflows',
      usage: 'hurdler workflows list [--category <c>] [options]',
      options: [{ name: 'category', alias: 'c', description: 'Filter by category', type: 'string' }],
      handler: handleWorkflowsList,
    },
    get: {
      name: 'get',
      summary: 'Inspect workflow steps, DAG dependencies, and agent assignments',
      usage: 'hurdler workflows get <workflowId>',
      arguments: [{ name: 'workflowId', description: 'Workflow ID', required: true }],
      handler: handleWorkflowsGet,
    },
    run: {
      name: 'run',
      summary: 'Execute a multi-agent workflow for a specified goal',
      usage: 'hurdler workflows run <workflowId> --goal "<goal>" [--tier <tier>]',
      arguments: [{ name: 'workflowId', description: 'Workflow ID to execute', required: true }],
      options: [
        { name: 'goal', alias: 'g', description: 'User objective / goal', type: 'string', required: true },
        { name: 'tier', alias: 't', description: 'LLM provider API tier override (standard, flex, priority)', type: 'string' },
        { name: 'no-git', alias: 'ng', description: 'Disable automated step git commits', type: 'boolean' },
      ],
      handler: handleWorkflowsRun,
    },
    compose: {
      name: 'compose',
      summary: 'Compose multiple workflows into a unified sequential pipeline',
      usage: 'hurdler workflows compose <wf1> <wf2>... --title "<title>" --id <newId>',
      options: [
        { name: 'title', alias: 't', description: 'Title of composed workflow', type: 'string' },
        { name: 'id', description: 'Unique identifier for new workflow', type: 'string' },
      ],
      handler: handleWorkflowsCompose,
    },
    add: {
      name: 'add',
      summary: 'Register custom workflow from JSON file',
      usage: 'hurdler workflows add --file <workflow.json>',
      options: [{ name: 'file', alias: 'f', description: 'JSON definition file', type: 'string', required: true }],
      handler: handleWorkflowsAdd,
    },
    remove: {
      name: 'remove',
      summary: 'Unregister a custom workflow',
      usage: 'hurdler workflows remove <workflowId>',
      arguments: [{ name: 'workflowId', description: 'Workflow ID', required: true }],
      handler: handleWorkflowsRemove,
    },
    sync: {
      name: 'sync',
      summary: 'Synchronize workflows with .hurdler/registries/workflows.json',
      usage: 'hurdler workflows sync [--path <path>]',
      options: [{ name: 'path', description: 'Custom path override', type: 'string' }],
      handler: handleWorkflowsSync,
    },
  },
  examples: [
    'hurdler workflows list',
    'hurdler workflows get feature-development',
    'hurdler workflows run feature-development --goal "Build user auth schema and endpoints"',
    'hurdler workflows compose feature-development security-hardening --title "Secure Feature Pipeline"',
    'hurdler workflows sync',
  ],
};

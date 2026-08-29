/**
 * Hurdler CLI Subsystem - Agents Registry Command
 * Manage specialized agent identities, system prompt bindings, Git authorship, and execution payloads.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printCode } from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  listAgents,
  getAgent,
  createAgentExecutionPayload,
  registerAgent,
  unregisterAgent,
  syncAgentRegistry,
} from '../../registries/agents/service.js';
import { getOptionString } from '../parser.js';

export const handleAgentsList: CliCommandHandler = async (args, ctx) => {
  const capability = getOptionString(args.options, 'capability', 'c');

  let allAgents = listAgents();

  if (capability) {
    allAgents = allAgents.filter((a) =>
      (a.capabilities || []).some((c) => c.toLowerCase().includes(capability.toLowerCase()))
    );
  }

  const rows = allAgents.map((a) => ({
    id: a.id,
    title: a.title || a.id,
    role: a.role,
    gitAuthor: a.gitAuthor ? `${a.gitAuthor.name} <${a.gitAuthor.email}>` : 'Default',
    capabilities: (a.capabilities || []).join(', ') || 'General',
    builtin: a.isBuiltin ? 'yes' : 'no',
  }));

  if (!ctx.isJson) {
    printHeader(`Registered Specialized AI Agents (${rows.length} total)`);
    console.log(
      formatTable(
        rows,
        [
          { key: 'id', label: 'Agent ID', minWidth: 20 },
          { key: 'title', label: 'Agent Title', minWidth: 22 },
          { key: 'role', label: 'Role', minWidth: 16 },
          { key: 'gitAuthor', label: 'Git Author Attribution', minWidth: 32 },
          { key: 'capabilities', label: 'Capabilities', maxWidth: 30, minWidth: 15 },
          { key: 'builtin', label: 'Built-in', align: 'center', minWidth: 8 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: allAgents,
  };
};

export const handleAgentsGet: CliCommandHandler = async (args, ctx) => {
  const agentId = args.positionals[0];
  if (!agentId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing agent ID.',
      suggestion: 'Usage: hurdler agents get <agentId>',
    };
  }

  try {
    const agent = getAgent(agentId);

    if (!ctx.isJson) {
      printHeader(`Agent: ${agent.title} (${agent.id})`);
      printKeyValues({
        'Agent ID': agent.id,
        'Title': agent.title,
        'Role': agent.role,
        'Built-in': agent.isBuiltin ? 'Yes' : 'No',
        'Git Author': agent.gitAuthor ? `${agent.gitAuthor.name} <${agent.gitAuthor.email}>` : 'Default',
        'Default Prompts': (agent.defaultPrompts || []).join(', ') || 'None',
        'Allowed Tools': (agent.allowedTools || ['*']).join(', '),
        'Disallowed Tools': (agent.disallowedTools || []).join(', ') || 'None',
        'Capabilities': (agent.capabilities || []).join(', '),
        'Description': agent.description || 'No description',
      });
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: agent,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: `Agent '${agentId}' not found.`,
      suggestion: `Run 'hurdler agents list' to view available agents.`,
    };
  }
};

export const handleAgentsPayload: CliCommandHandler = async (args, ctx) => {
  const agentId = args.positionals[0];
  const task = getOptionString(args.options, 'task', 't') || 'Implement application feature';

  if (!agentId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing agent ID.',
      suggestion: 'Usage: hurdler agents payload <agentId> --task "<task>"',
    };
  }

  try {
    const payload = createAgentExecutionPayload(agentId, task);

    if (!ctx.isJson) {
      printHeader(`Compiled Execution Payload for Agent: ${agentId}`);
      printKeyValues({
        'Agent Title': payload.agent.title,
        'Git Author': `${payload.gitAuthor.name} <${payload.gitAuthor.email}>`,
        'Allowed Tools': payload.allowedTools.join(', '),
        'Disallowed Tools': payload.disallowedTools.join(', ') || 'None',
      });

      console.log('\n📜 Synthesized System Prompt:');
      printCode(payload.systemPrompt);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: payload,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to compile agent payload: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleAgentsAdd: CliCommandHandler = async (args, ctx) => {
  const filePath = getOptionString(args.options, 'file', 'f');
  if (!filePath) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing --file option.',
      suggestion: 'Usage: hurdler agents add --file <agent.json>',
    };
  }

  try {
    const content = await fs.readFile(path.resolve(ctx.projectRoot || process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(content);
    const registered = registerAgent(parsed);

    if (!ctx.isJson) {
      printSuccess(`Registered custom agent '${registered.id}' (${registered.title}).`);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: `Agent '${registered.id}' registered.`,
      data: registered,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to register agent: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleAgentsRemove: CliCommandHandler = async (args, ctx) => {
  const agentId = args.positionals[0];
  if (!agentId) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing agent ID.',
      suggestion: 'Usage: hurdler agents remove <agentId>',
    };
  }

  try {
    const removed = unregisterAgent(agentId);
    if (!ctx.isJson) {
      if (removed) {
        printSuccess(`Unregistered agent '${agentId}'.`);
      } else {
        console.log(`Agent '${agentId}' was not found.`);
      }
    }
    return {
      success: removed,
      exitCode: removed ? ExitCode.SUCCESS : ExitCode.NOT_FOUND,
      data: { agentId, removed },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to remove agent: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleAgentsSync: CliCommandHandler = async (args, ctx) => {
  const syncPath = getOptionString(args.options, 'path');
  try {
    const result = await syncAgentRegistry({
      projectRoot: ctx.projectRoot,
      targetPath: syncPath,
    });

    if (!ctx.isJson) {
      printSuccess('Agents registry synchronized with disk.');
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
      error: `Failed to sync agents registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const agentsCommandDefinition: CliCommandDefinition = {
  name: 'agents',
  summary: 'Manage AI agent identities, Git authorship, prompt bindings, and execution payloads',
  description: 'Manage specialized software engineering agents (architect, business-logic, tester, debugger, etc.), compile payloads, and synchronize registries.',
  usage: 'hurdler agents <list|get|payload|add|remove|sync> [args] [options]',
  handler: handleAgentsList,
  subcommands: {
    list: {
      name: 'list',
      summary: 'List all registered specialized agents',
      usage: 'hurdler agents list [--capability <c>] [options]',
      options: [{ name: 'capability', alias: 'c', description: 'Filter by capability', type: 'string' }],
      handler: handleAgentsList,
    },
    get: {
      name: 'get',
      summary: 'Inspect agent identity, Git author, and tool constraints',
      usage: 'hurdler agents get <agentId>',
      arguments: [{ name: 'agentId', description: 'Agent ID', required: true }],
      handler: handleAgentsGet,
    },
    payload: {
      name: 'payload',
      summary: 'Preview compiled system prompt, git author, and tool context for a task',
      usage: 'hurdler agents payload <agentId> [--task "<task>"]',
      arguments: [{ name: 'agentId', description: 'Agent ID', required: true }],
      options: [{ name: 'task', alias: 't', description: 'User task description', type: 'string' }],
      handler: handleAgentsPayload,
    },
    add: {
      name: 'add',
      summary: 'Register custom agent from JSON file',
      usage: 'hurdler agents add --file <agent.json>',
      options: [{ name: 'file', alias: 'f', description: 'JSON definition file', type: 'string', required: true }],
      handler: handleAgentsAdd,
    },
    remove: {
      name: 'remove',
      summary: 'Unregister a custom agent',
      usage: 'hurdler agents remove <agentId>',
      arguments: [{ name: 'agentId', description: 'Agent ID', required: true }],
      handler: handleAgentsRemove,
    },
    sync: {
      name: 'sync',
      summary: 'Synchronize agents with .hurdler/registries/agents.json',
      usage: 'hurdler agents sync [--path <path>]',
      options: [{ name: 'path', description: 'Custom path override', type: 'string' }],
      handler: handleAgentsSync,
    },
  },
  examples: [
    'hurdler agents list',
    'hurdler agents get architect',
    'hurdler agents payload business-logic --task "Create user authentication endpoints"',
    'hurdler agents sync',
  ],
};

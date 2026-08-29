/**
 * Hurdler CLI Subsystem - Commands Registry & Aggregator
 * Central mapping of all top-level CLI commands and subcommands.
 */

import type { CliCommandDefinition } from '../types.js';

import { initCommandDefinition } from './init.js';
import { configCommandDefinition } from './config.js';
import { devCommandDefinition } from './dev.js';
import { keysCommandDefinition } from './keys.js';
import { billingCommandDefinition } from './billing.js';
import { llmsCommandDefinition } from './llms.js';
import { promptsCommandDefinition } from './prompts.js';
import { toolsCommandDefinition } from './tools.js';
import { modulesCommandDefinition } from './modules.js';
import { agentsCommandDefinition } from './agents.js';
import { workflowsCommandDefinition } from './workflows.js';
import { gitCommandDefinition } from './git.js';
import { codeCommandDefinition } from './code.js';
import { mapperCommandDefinition } from './mapper.js';
import { uiCommandDefinition } from './ui.js';
import { tuiCommandDefinition } from './tui.js';

/**
 * Universal Command Registry mapping top-level names to command definitions.
 */
export const COMMAND_REGISTRY: Record<string, CliCommandDefinition> = {
  tui: tuiCommandDefinition,
  init: initCommandDefinition,
  config: configCommandDefinition,
  dev: devCommandDefinition,
  keys: keysCommandDefinition,
  billing: billingCommandDefinition,
  llms: llmsCommandDefinition,
  prompts: promptsCommandDefinition,
  tools: toolsCommandDefinition,
  modules: modulesCommandDefinition,
  agents: agentsCommandDefinition,
  workflows: workflowsCommandDefinition,
  git: gitCommandDefinition,
  code: codeCommandDefinition,
  mapper: mapperCommandDefinition,
  ui: uiCommandDefinition,
};

export * from './init.js';
export * from './config.js';
export * from './dev.js';
export * from './keys.js';
export * from './billing.js';
export * from './llms.js';
export * from './prompts.js';
export * from './tools.js';
export * from './modules.js';
export * from './agents.js';
export * from './workflows.js';
export * from './git.js';
export * from './code.js';
export * from './mapper.js';
export * from './ui.js';
export * from './tui.js';

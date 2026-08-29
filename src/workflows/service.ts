import { executeWorkflow } from './engine.js';
import { composeWorkflows, adaptWorkflowForModelCapability } from './composition.js';
import {
  createExecutionContext,
  recordFileChange,
  formatCodebaseContextForPrompt,
} from './context.js';
import { runAutoDebugLoop } from './debugger-loop.js';
import { defaultWorkflowRegistry } from '../registries/workflows/service.js';

/**
 * Functional Workflow Service providing a unified orchestration facade
 * across the Hurdler agentic platform.
 */
export const workflowService = {
  /**
   * Executes a workflow by registered ID or inline definition.
   */
  execute: executeWorkflow,

  /**
   * Composes multiple workflows into a single chained or combined pipeline.
   */
  compose: composeWorkflows,

  /**
   * Adapts a workflow pipeline to match the reasoning capability of a target model tier.
   */
  adapt: adaptWorkflowForModelCapability,

  /**
   * Creates an isolated workflow execution context.
   */
  createContext: createExecutionContext,

  /**
   * Records a file change and updates dynamic symbol summaries.
   */
  recordFile: recordFileChange,

  /**
   * Formats dynamic codebase context as markdown for agent prompts.
   */
  formatCodebaseContext: formatCodebaseContextForPrompt,

  /**
   * Directly invokes the self-healing auto-debugger loop.
   */
  debugLoop: runAutoDebugLoop,

  /**
   * Direct reference to the global Workflow Registry Service.
   */
  registry: defaultWorkflowRegistry,
};

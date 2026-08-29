import { defaultWorkflowRegistry } from '../registries/workflows/service.js';
import {
  WorkflowDefinitionSchema,
} from '../registries/workflows/schema.js';
import {
  WorkflowValidationError,
  WorkflowExecutionError,
  WorkflowAbortedError,
} from '../registries/workflows/errors.js';
import { createExecutionContext } from './context.js';
import { executeStep } from './step-executor.js';
import { devInfo, devError } from '../core/dev-mode/index.js';
import type {
  WorkflowDefinition,
  WorkflowStepDefinition,
} from '../registries/workflows/types.js';
import type {
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  WorkflowStepResult,
} from './types.js';

/**
 * Topologically sorts workflow steps according to their declared dependencies.
 */
function resolveStepExecutionOrder(steps: WorkflowStepDefinition[]): WorkflowStepDefinition[] {
  const stepMap = new Map<string, WorkflowStepDefinition>();
  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: WorkflowStepDefinition[] = [];

  function visit(stepId: string) {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) {
      throw new Error(`Cyclic dependency detected in workflow steps at step '${stepId}'`);
    }

    visiting.add(stepId);
    const step = stepMap.get(stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' declares dependency on unknown step '${stepId}'`);
    }

    for (const depId of step.dependsOn ?? []) {
      if (!stepMap.has(depId)) {
        throw new Error(`Step '${step.id}' depends on non-existent step '${depId}'`);
      }
      visit(depId);
    }

    visiting.delete(stepId);
    visited.add(stepId);
    ordered.push(step);
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      visit(step.id);
    }
  }

  return ordered;
}

/**
 * Executes a complete multi-agent workflow pipeline end-to-end.
 * Orchestrates step sequencing, dynamic context tracking, automated verification,
 * and Git attribution.
 */
export async function executeWorkflow(
  workflowOrId: string | WorkflowDefinition,
  options: WorkflowExecutionOptions = {}
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();

  // 1. Resolve & Validate Workflow Definition
  let workflow: WorkflowDefinition;
  if (typeof workflowOrId === 'string') {
    workflow = defaultWorkflowRegistry.get(workflowOrId);
  } else {
    const parseResult = WorkflowDefinitionSchema.safeParse(workflowOrId);
    if (!parseResult.success) {
      throw new WorkflowValidationError(
        workflowOrId.id ?? 'inline-workflow',
        parseResult.error.issues
      );
    }
    workflow = parseResult.data;
  }

  devInfo(
    'WORKFLOW_ENGINE',
    `Starting execution of workflow '${workflow.id}' (${workflow.title}) with ${workflow.steps.length} steps [dryRun: ${options.dryRun ?? false}]`
  );

  // 2. Initialize Execution Context
  const context = createExecutionContext(workflow, options);

  // 3. Resolve Execution Order (DAG Toposort)
  let orderedSteps: WorkflowStepDefinition[];
  try {
    orderedSteps = resolveStepExecutionOrder(workflow.steps);
  } catch (err: any) {
    throw new WorkflowExecutionError(workflow.id, `Failed to resolve step order: ${err.message}`, {
      error: err,
    });
  }

  const stepResults: WorkflowStepResult[] = [];
  let overallStatus: 'success' | 'failed' | 'partial' = 'success';
  let overallError: string | undefined;

  // 4. Iterate and Execute Steps
  for (const step of orderedSteps) {
    if (options.abortSignal?.aborted) {
      throw new WorkflowAbortedError(workflow.id, 'AbortSignal received');
    }

    // Check if prerequisite step failed
    const failedPrerequisite = (step.dependsOn ?? []).some((depId: string) => {
      const res = context.stepResults.get(depId);
      return res && res.status === 'failed';
    });

    if (failedPrerequisite) {
      devInfo(
        'WORKFLOW_ENGINE',
        `Skipping step '${step.id}' because prerequisite step failed.`
      );
      const skippedResult: WorkflowStepResult = {
        stepId: step.id,
        stepTitle: step.title,
        agentId: step.agentId,
        status: 'skipped',
        executionMode: step.executionMode,
        modifiedFiles: [],
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
      context.stepResults.set(step.id, skippedResult);
      stepResults.push(skippedResult);
      overallStatus = 'partial';
      continue;
    }

    try {
      const result = await executeStep(step, context, options);
      stepResults.push(result);

      if (result.status === 'failed') {
        if (!step.optional) {
          overallStatus = 'failed';
          overallError = result.error ?? `Step '${step.id}' failed.`;
          if (options.stopOnError !== false) {
            break;
          }
        } else {
          overallStatus = 'partial';
        }
      }
    } catch (err: any) {
      overallStatus = 'failed';
      overallError = err instanceof Error ? err.message : String(err);
      devError('WORKFLOW_ENGINE', `Workflow '${workflow.id}' aborted due to step error: ${overallError}`);
      if (options.stopOnError !== false) {
        break;
      }
    }
  }

  const totalDurationMs = Date.now() - startTime;
  const generatedFiles = Array.from(context.files.keys());

  const executionResult: WorkflowExecutionResult = {
    workflowId: workflow.id,
    workflowTitle: workflow.title,
    status: overallStatus,
    durationMs: totalDurationMs,
    stepResults,
    totalTokens: { ...context.totalTokens },
    totalCost: { ...context.totalCost },
    generatedFiles,
    gitBranch: context.currentBranch,
    error: overallError,
  };

  if (options.hooks?.onWorkflowComplete) {
    await options.hooks.onWorkflowComplete(executionResult, context);
  }

  devInfo(
    'WORKFLOW_ENGINE',
    `Workflow '${workflow.id}' finished in ${totalDurationMs}ms [status: ${overallStatus}, files: ${generatedFiles.length}, totalTokens: ${context.totalTokens.totalTokens}, totalCost: $${context.totalCost.totalCost.toFixed(6)}]`
  );

  return executionResult;
}

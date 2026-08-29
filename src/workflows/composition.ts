import { defaultWorkflowRegistry } from '../registries/workflows/service.js';
import { devInfo } from '../core/dev-mode/index.js';
import type {
  WorkflowDefinition,
  WorkflowStepDefinition,
} from '../registries/workflows/types.js';
import type { ComposeWorkflowsOptions } from './types.js';

/**
 * Programmatically combines multiple workflows into a single composed workflow pipeline.
 */
export function composeWorkflows(
  workflowsOrIds: (string | WorkflowDefinition)[],
  options: ComposeWorkflowsOptions = {}
): WorkflowDefinition {
  const resolvedWorkflows: WorkflowDefinition[] = workflowsOrIds.map((item) => {
    if (typeof item === 'string') {
      return defaultWorkflowRegistry.get(item);
    }
    return item;
  });

  if (resolvedWorkflows.length === 0) {
    throw new Error('Cannot compose empty workflows list.');
  }

  const composedId =
    options.id ??
    `composed-${resolvedWorkflows.map((w) => w.id).join('-')}-${Date.now()}`;
  const composedTitle =
    options.title ??
    `Composed Workflow: ${resolvedWorkflows.map((w) => w.title).join(' + ')}`;
  const composedCategory =
    options.category ?? resolvedWorkflows[0].category;
  const composedDescription =
    options.description ??
    `Composite workflow combining [${resolvedWorkflows.map((w) => w.id).join(', ')}]`;

  const allDefaultPrompts = new Set<string>();
  const allTags = new Set<string>();
  const composedSteps: WorkflowStepDefinition[] = [];

  let previousLastStepId: string | undefined;

  for (let wIndex = 0; wIndex < resolvedWorkflows.length; wIndex++) {
    const workflow = resolvedWorkflows[wIndex];

    for (const prompt of workflow.defaultPrompts ?? []) {
      allDefaultPrompts.add(prompt);
    }
    for (const tag of workflow.tags ?? []) {
      allTags.add(tag);
    }

    // Clone steps and chain dependencies if sequential
    for (let sIndex = 0; sIndex < workflow.steps.length; sIndex++) {
      const step = { ...workflow.steps[sIndex] };
      const uniqueStepId = `${workflow.id}:${step.id}`;

      // Remap internal dependencies
      const remappedDependsOn: string[] = [];
      for (const dep of step.dependsOn ?? []) {
        remappedDependsOn.push(`${workflow.id}:${dep}`);
      }

      // If sequential mode and this is the first step of a subsequent workflow, chain from previous workflow's last step
      if (options.sequential !== false && sIndex === 0 && previousLastStepId) {
        remappedDependsOn.push(previousLastStepId);
      }

      composedSteps.push({
        ...step,
        id: uniqueStepId,
        dependsOn: remappedDependsOn,
      });

      if (sIndex === workflow.steps.length - 1) {
        previousLastStepId = uniqueStepId;
      }
    }
  }

  if (options.defaultPrompts) {
    for (const p of options.defaultPrompts) {
      allDefaultPrompts.add(p);
    }
  }

  const composed: WorkflowDefinition = {
    id: composedId,
    title: composedTitle,
    category: composedCategory,
    description: composedDescription,
    targetFramework: options.targetFramework ?? resolvedWorkflows[0].targetFramework ?? 'nextjs',
    steps: composedSteps,
    defaultPrompts: Array.from(allDefaultPrompts),
    tags: Array.from(allTags),
    isBuiltin: false,
    active: true,
    createdAt: new Date().toISOString(),
  };

  devInfo(
    'WORKFLOW_COMPOSITION',
    `Composed ${resolvedWorkflows.length} workflows into '${composed.id}' (${composed.steps.length} total steps)`
  );

  return composed;
}

/**
 * Dynamically adapts a workflow pipeline to match the reasoning capability
 * of the target LLM model tier (Priority / High vs. Flex / Standard).
 *
 * - High-tier models (Priority / Opus / Pro): Consolidates multi-pass single-aspect steps
 *   into unified multi-aspect steps with combined prompts for rapid execution.
 * - Standard/Flex-tier models: Decomposes combined steps into atomic, single-responsibility steps.
 */
export function adaptWorkflowForModelCapability(
  workflow: WorkflowDefinition,
  targetTier: 'priority' | 'flex' | 'standard'
): WorkflowDefinition {
  const adapted: WorkflowDefinition = {
    ...workflow,
    id: `${workflow.id}-adapted-${targetTier}`,
    steps: workflow.steps.map((s) => ({ ...s })),
  };

  if (targetTier === 'priority') {
    // High reasoning tier: Combine atomic steps if they target the same agent sequentially
    devInfo(
      'WORKFLOW_ADAPTATION',
      `Adapting workflow '${workflow.id}' for High-Capability Priority tier (consolidating prompt combinations)`
    );

    const optimizedSteps: WorkflowStepDefinition[] = [];
    for (let i = 0; i < adapted.steps.length; i++) {
      const step = adapted.steps[i];
      const nextStep = adapted.steps[i + 1];

      // Check if two sequential steps share the same agent and can be combined
      if (
        nextStep &&
        step.agentId &&
        step.agentId === nextStep.agentId &&
        step.executionMode === 'agent' &&
        nextStep.executionMode === 'agent' &&
        nextStep.dependsOn.length === 1 &&
        nextStep.dependsOn[0] === step.id
      ) {
        // Consolidate prompt IDs
        const combinedPrompts = Array.from(
          new Set([...(step.prompts ?? []), ...(nextStep.prompts ?? [])])
        );
        const combinedTools = Array.from(
          new Set([...(step.tools ?? []), ...(nextStep.tools ?? [])])
        );

        optimizedSteps.push({
          id: `${step.id}+${nextStep.id}`,
          title: `${step.title} & ${nextStep.title}`,
          description: `Consolidated multi-aspect execution: ${step.description ?? ''} | ${nextStep.description ?? ''}`,
          agentId: step.agentId,
          executionMode: 'agent',
          prompts: combinedPrompts,
          tools: combinedTools,
          modelTier: 'priority',
          reasoningEffort: 'high',
          dependsOn: step.dependsOn,
          gitAction: nextStep.gitAction ?? step.gitAction,
          lintAction: nextStep.lintAction ?? step.lintAction,
        });

        i++; // Skip the next step since it was merged
      } else {
        optimizedSteps.push({
          ...step,
          modelTier: 'priority',
        });
      }
    }
    adapted.steps = optimizedSteps;
  } else {
    // Standard / Flex tier: Enforce lower tier and single responsibility
    devInfo(
      'WORKFLOW_ADAPTATION',
      `Adapting workflow '${workflow.id}' for Standard/Flex tier (preserving atomic isolation)`
    );
    adapted.steps = adapted.steps.map((step) => ({
      ...step,
      modelTier: targetTier,
      reasoningEffort: 'medium',
    }));
  }

  return adapted;
}

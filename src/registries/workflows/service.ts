import { BaseRegistry } from '../base/registry.js';
import { devInfo, devWarn } from '../../core/dev-mode/index.js';
import { STATIC_WORKFLOWS } from './static-workflows.js';
import {
  WorkflowDefinitionSchema,
  WorkflowQueryFilterSchema,
} from './schema.js';
import {
  WorkflowNotFoundError,
  WorkflowAlreadyExistsError,
  WorkflowValidationError,
} from './errors.js';
import type {
  WorkflowDefinition,
  WorkflowQueryFilter,
} from './types.js';

/**
 * Universal Workflow Registry Service for managing, registering,
 * querying, and validating workflow pipelines in Hurdler.
 */
export class WorkflowRegistryService {
  private readonly registry: BaseRegistry<string, WorkflowDefinition>;
  private readonly staticWorkflowIds = new Set<string>();

  constructor(initialWorkflows?: Record<string, WorkflowDefinition>) {
    this.registry = new BaseRegistry<string, WorkflowDefinition>({
      name: 'WorkflowRegistry',
      schema: WorkflowDefinitionSchema,
      keyExtractor: (w) => w.id,
    });

    const workflowsToLoad = initialWorkflows ?? STATIC_WORKFLOWS;
    for (const workflow of Object.values(workflowsToLoad)) {
      this.registerInternal(workflow, true);
    }
  }

  /**
   * Internal registration helper without duplicate error throwing for static initialization.
   */
  private registerInternal(workflow: WorkflowDefinition, isBuiltin = false): void {
    const parseResult = WorkflowDefinitionSchema.safeParse(workflow);
    if (!parseResult.success) {
      throw new WorkflowValidationError(workflow.id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;
    validated.isBuiltin = isBuiltin;

    if (this.registry.has(validated.id)) {
      this.registry.unregister(validated.id);
    }

    this.registry.register(validated.id, validated);
    if (isBuiltin) {
      this.staticWorkflowIds.add(validated.id);
    }
  }

  /**
   * Registers a new custom workflow into the registry.
   * Throws WorkflowAlreadyExistsError if ID is already registered.
   */
  register(workflow: WorkflowDefinition): this {
    const parseResult = WorkflowDefinitionSchema.safeParse(workflow);
    if (!parseResult.success) {
      throw new WorkflowValidationError(workflow.id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;

    if (this.registry.has(validated.id)) {
      throw new WorkflowAlreadyExistsError(validated.id);
    }

    const now = new Date().toISOString();
    if (!validated.createdAt) {
      validated.createdAt = now;
    }
    validated.updatedAt = now;
    validated.isBuiltin = false;

    this.registry.register(validated.id, validated);

    devInfo(
      'WORKFLOW_REGISTRY',
      `Registered custom workflow '${validated.id}' (${validated.title}) [category: ${validated.category}, steps: ${validated.steps.length}]`
    );
    return this;
  }

  /**
   * Registers or updates an existing workflow definition.
   */
  registerOrUpdate(workflow: WorkflowDefinition): this {
    const parseResult = WorkflowDefinitionSchema.safeParse(workflow);
    if (!parseResult.success) {
      throw new WorkflowValidationError(workflow.id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;
    const now = new Date().toISOString();

    if (this.registry.has(validated.id)) {
      const existing = this.registry.get(validated.id);
      validated.createdAt = existing.createdAt ?? now;
      validated.isBuiltin = existing.isBuiltin ?? false;
      this.registry.unregister(validated.id);
      devInfo('WORKFLOW_REGISTRY', `Updated existing workflow '${validated.id}' (${validated.title})`);
    } else {
      validated.createdAt = now;
      validated.isBuiltin = false;
      devInfo('WORKFLOW_REGISTRY', `Registered new workflow '${validated.id}' (${validated.title})`);
    }

    validated.updatedAt = now;
    this.registry.register(validated.id, validated);
    return this;
  }

  /**
   * Retrieves a workflow by ID or throws WorkflowNotFoundError.
   */
  get(workflowId: string): WorkflowDefinition {
    const workflow = this.registry.getOrNull(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }
    return { ...workflow, steps: workflow.steps.map((s) => ({ ...s })) };
  }

  /**
   * Retrieves a workflow by ID or returns null if not found.
   */
  getOrNull(workflowId: string): WorkflowDefinition | null {
    const workflow = this.registry.getOrNull(workflowId);
    return workflow
      ? { ...workflow, steps: workflow.steps.map((s) => ({ ...s })) }
      : null;
  }

  /**
   * Checks if a workflow with the specified ID is registered.
   */
  has(workflowId: string): boolean {
    return this.registry.has(workflowId);
  }

  /**
   * Returns all registered workflows.
   */
  getAll(): WorkflowDefinition[] {
    return this.registry
      .getAll()
      .map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) }));
  }

  /**
   * Returns the count of registered workflows.
   */
  count(): number {
    return this.registry.count();
  }

  /**
   * Retrieves all workflows belonging to a category.
   */
  getByCategory(category: string): WorkflowDefinition[] {
    const catLower = category.toLowerCase();
    return this.registry
      .filter((w) => w.category.toLowerCase() === catLower)
      .map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) }));
  }

  /**
   * Retrieves all workflows matching a tag.
   */
  getByTag(tag: string): WorkflowDefinition[] {
    const lower = tag.toLowerCase();
    return this.registry
      .filter((w) => (w.tags ?? []).some((t) => t.toLowerCase() === lower))
      .map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) }));
  }

  /**
   * Retrieves all workflows that utilize a specific agent in at least one step.
   */
  getByAgent(agentId: string): WorkflowDefinition[] {
    const lower = agentId.toLowerCase();
    return this.registry
      .filter((w) =>
        w.steps.some((s) => (s.agentId ? s.agentId.toLowerCase() === lower : false))
      )
      .map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) }));
  }

  /**
   * Performs multi-criteria filtering and querying across registered workflows.
   */
  query(filter: WorkflowQueryFilter): WorkflowDefinition[] {
    const validated = WorkflowQueryFilterSchema.parse(filter);

    return this.registry
      .filter((w) => {
        if (validated.activeOnly && !w.active) {
          return false;
        }

        if (validated.isBuiltin !== undefined && w.isBuiltin !== validated.isBuiltin) {
          return false;
        }

        if (
          validated.category &&
          w.category.toLowerCase() !== validated.category.toLowerCase()
        ) {
          return false;
        }

        if (validated.categories && validated.categories.length > 0) {
          const set = new Set(validated.categories.map((c) => c.toLowerCase()));
          if (!set.has(w.category.toLowerCase())) {
            return false;
          }
        }

        if (validated.tag) {
          const lower = validated.tag.toLowerCase();
          if (!(w.tags ?? []).some((t) => t.toLowerCase() === lower)) {
            return false;
          }
        }

        if (validated.tags && validated.tags.length > 0) {
          const set = new Set(validated.tags.map((t) => t.toLowerCase()));
          if (!(w.tags ?? []).some((t) => set.has(t.toLowerCase()))) {
            return false;
          }
        }

        if (validated.agentId) {
          const lower = validated.agentId.toLowerCase();
          if (!w.steps.some((s) => (s.agentId ? s.agentId.toLowerCase() === lower : false))) {
            return false;
          }
        }

        if (
          validated.targetFramework &&
          w.targetFramework.toLowerCase() !== validated.targetFramework.toLowerCase()
        ) {
          return false;
        }

        if (validated.search) {
          const query = validated.search.toLowerCase();
          const matches =
            w.id.toLowerCase().includes(query) ||
            w.title.toLowerCase().includes(query) ||
            w.description.toLowerCase().includes(query) ||
            (w.tags ?? []).some((t) => t.toLowerCase().includes(query)) ||
            w.steps.some(
              (s) =>
                s.id.toLowerCase().includes(query) ||
                s.title.toLowerCase().includes(query)
            );
          if (!matches) {
            return false;
          }
        }

        return true;
      })
      .map((w) => ({ ...w, steps: w.steps.map((s) => ({ ...s })) }));
  }

  /**
   * Unregisters a custom workflow. Cannot unregister built-in workflows.
   */
  unregister(workflowId: string): boolean {
    if (this.staticWorkflowIds.has(workflowId)) {
      throw new WorkflowValidationError(
        workflowId,
        `Cannot unregister built-in static workflow '${workflowId}'`
      );
    }

    const removed = this.registry.unregister(workflowId);
    if (removed) {
      devInfo('WORKFLOW_REGISTRY', `Unregistered custom workflow '${workflowId}'`);
    }
    return removed;
  }

  /**
   * Clears all custom workflow registrations and resets back to built-in static workflows.
   */
  clearCustom(): void {
    const all = this.registry.getAll();
    for (const workflow of all) {
      if (!this.staticWorkflowIds.has(workflow.id)) {
        this.registry.unregister(workflow.id);
      }
    }
    devInfo('WORKFLOW_REGISTRY', 'Cleared all custom workflow registrations');
  }

  /**
   * Freezes the registry.
   */
  freeze(): this {
    this.registry.freeze();
    return this;
  }

  /**
   * Returns true if registry is frozen.
   */
  isFrozen(): boolean {
    return this.registry.isFrozen();
  }
}

/**
 * Global default instance of the Workflow Registry Service.
 */
export const defaultWorkflowRegistry = new WorkflowRegistryService();

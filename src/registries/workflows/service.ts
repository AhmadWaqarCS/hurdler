import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/index.js';
import { STATIC_WORKFLOWS } from './static-workflows.js';
import {
  WorkflowDefinitionSchema,
  WorkflowQueryFilterSchema,
  WorkflowUpdateSchema,
  WorkflowStorageOptionsSchema,
  WorkflowStepDefinitionSchema,
} from './schema.js';
import {
  WorkflowNotFoundError,
  WorkflowAlreadyExistsError,
  WorkflowValidationError,
  BuiltinWorkflowProtectionError,
} from './errors.js';
import {
  loadWorkflowRegistryFromDisk,
  saveWorkflowRegistryToDisk,
  syncWorkflowRegistryWithDisk,
  saveWorkflowToDisk,
  deleteWorkflowFromDisk,
} from './storage.js';
import type {
  WorkflowDefinition,
  WorkflowInput,
  WorkflowUpdateInput,
  WorkflowQueryFilter,
  WorkflowStorageOptions,
  WorkflowRegistryMap,
  WorkflowStepDefinition,
} from './types.js';

/**
 * Universal Workflow Registry Service for managing, registering,
 * querying, persisting, and validating workflow pipelines in Hurdler.
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
  private registerInternal(workflow: WorkflowDefinition | WorkflowInput, isBuiltin = false): WorkflowDefinition {
    const parseResult = WorkflowDefinitionSchema.safeParse(workflow);
    if (!parseResult.success) {
      throw new WorkflowValidationError((workflow as any).id ?? 'unknown', parseResult.error.issues);
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

    return { ...validated, steps: validated.steps.map((s) => ({ ...s })) };
  }

  /**
   * Returns array of all registered workflow IDs.
   */
  getRegisteredIds(): string[] {
    return this.registry.getAll().map((w) => w.id);
  }

  /**
   * Registers a new custom workflow into the registry.
   * Throws WorkflowAlreadyExistsError if ID is already registered.
   */
  register(
    workflow: WorkflowInput | WorkflowDefinition,
    options?: WorkflowStorageOptions
  ): WorkflowDefinition {
    const opts = WorkflowStorageOptionsSchema.parse(options ?? {});
    const parseResult = WorkflowDefinitionSchema.safeParse(workflow);
    if (!parseResult.success) {
      throw new WorkflowValidationError((workflow as any).id ?? 'unknown', parseResult.error.issues);
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

    if (opts.persist) {
      saveWorkflowToDisk(validated, {
        targetPath: opts.targetPath,
        projectRoot: opts.projectRoot,
      }).catch((err) => {
        devWarn('WORKFLOW_REGISTRY', `Async persist failed for workflow '${validated.id}': ${err.message}`);
      });
    }

    return { ...validated, steps: validated.steps.map((s) => ({ ...s })) };
  }

  /**
   * Partially updates an existing workflow definition.
   */
  update(
    workflowId: string,
    updates: WorkflowUpdateInput,
    options?: WorkflowStorageOptions
  ): WorkflowDefinition {
    const opts = WorkflowStorageOptionsSchema.parse(options ?? {});
    const existing = this.get(workflowId);

    if (existing.isBuiltin && !opts.force) {
      devWarn('WORKFLOW_REGISTRY', `Updating built-in workflow '${workflowId}' properties in memory.`);
    }

    const validatedUpdates = WorkflowUpdateSchema.parse(updates);
    const now = new Date().toISOString();

    const updated: WorkflowDefinition = {
      ...existing,
      ...validatedUpdates,
      id: existing.id, // ID is immutable
      isBuiltin: existing.isBuiltin,
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
      steps: (validatedUpdates.steps ?? existing.steps).map((s) => ({ ...s })),
      defaultPrompts: validatedUpdates.defaultPrompts ?? existing.defaultPrompts,
      tags: validatedUpdates.tags ?? existing.tags,
    };

    const finalParsed = WorkflowDefinitionSchema.safeParse(updated);
    if (!finalParsed.success) {
      throw new WorkflowValidationError(workflowId, finalParsed.error.issues);
    }

    this.registry.unregister(workflowId);
    this.registry.register(workflowId, finalParsed.data);

    devInfo('WORKFLOW_REGISTRY', `Updated workflow '${workflowId}' (${finalParsed.data.title})`);

    if (opts.persist) {
      saveWorkflowToDisk(finalParsed.data, {
        targetPath: opts.targetPath,
        projectRoot: opts.projectRoot,
      }).catch((err) => {
        devWarn('WORKFLOW_REGISTRY', `Async persist failed for updated workflow '${workflowId}': ${err.message}`);
      });
    }

    return { ...finalParsed.data, steps: finalParsed.data.steps.map((s) => ({ ...s })) };
  }

  /**
   * Registers or updates an existing workflow definition.
   */
  registerOrUpdate(
    workflow: WorkflowInput | WorkflowDefinition,
    options?: WorkflowStorageOptions
  ): WorkflowDefinition {
    const parseResult = WorkflowDefinitionSchema.safeParse(workflow);
    if (!parseResult.success) {
      throw new WorkflowValidationError((workflow as any).id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;
    const opts = WorkflowStorageOptionsSchema.parse(options ?? {});
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

    if (opts.persist) {
      saveWorkflowToDisk(validated, {
        targetPath: opts.targetPath,
        projectRoot: opts.projectRoot,
      }).catch((err) => {
        devWarn('WORKFLOW_REGISTRY', `Async persist failed for workflow '${validated.id}': ${err.message}`);
      });
    }

    return { ...validated, steps: validated.steps.map((s) => ({ ...s })) };
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
   * Unregisters a workflow. Prevents removing built-in static workflows unless force: true.
   */
  unregister(workflowId: string, options?: WorkflowStorageOptions): boolean {
    const opts = WorkflowStorageOptionsSchema.parse(options ?? {});

    if (this.staticWorkflowIds.has(workflowId) && !opts.force) {
      throw new BuiltinWorkflowProtectionError(workflowId);
    }

    const removed = this.registry.unregister(workflowId);
    if (removed) {
      devInfo('WORKFLOW_REGISTRY', `Unregistered workflow '${workflowId}'`);
      if (opts.persist) {
        deleteWorkflowFromDisk(workflowId, {
          targetPath: opts.targetPath,
          projectRoot: opts.projectRoot,
        }).catch((err) => {
          devWarn('WORKFLOW_REGISTRY', `Async delete from disk failed for workflow '${workflowId}': ${err.message}`);
        });
      }
    }
    return removed;
  }

  /**
   * Clears all custom workflow registrations and resets back to built-in static workflows.
   */
  clearCustom(options?: WorkflowStorageOptions): void {
    const opts = WorkflowStorageOptionsSchema.parse(options ?? {});
    const all = this.registry.getAll();
    for (const workflow of all) {
      if (!this.staticWorkflowIds.has(workflow.id)) {
        this.registry.unregister(workflow.id);
      }
    }
    devInfo('WORKFLOW_REGISTRY', 'Cleared all custom workflow registrations');

    if (opts.persist) {
      this.saveToDisk(opts).catch((err) => {
        devWarn('WORKFLOW_REGISTRY', `Async saveToDisk failed after clearCustom: ${err.message}`);
      });
    }
  }

  /**
   * Resets registry back to initial baseline STATIC_WORKFLOWS.
   */
  reset(options?: WorkflowStorageOptions): void {
    this.registry.clear();
    this.staticWorkflowIds.clear();
    for (const workflow of Object.values(STATIC_WORKFLOWS)) {
      this.registerInternal(workflow, true);
    }
    devInfo('WORKFLOW_REGISTRY', 'Reset workflows registry to baseline static defaults');

    const opts = WorkflowStorageOptionsSchema.parse(options ?? {});
    if (opts.persist) {
      saveWorkflowRegistryToDisk(STATIC_WORKFLOWS, opts).catch((err) => {
        devWarn('WORKFLOW_REGISTRY', `Async saveWorkflowRegistryToDisk failed after reset: ${err.message}`);
      });
    }
  }

  /**
   * Loads workflows from `.hurdler/registries/workflows.json` into memory.
   */
  async loadFromDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const diskWorkflows = await loadWorkflowRegistryFromDisk(options);
    if (diskWorkflows) {
      for (const workflow of Object.values(diskWorkflows)) {
        const isBuiltin = workflow.id in STATIC_WORKFLOWS;
        this.registerInternal(workflow, isBuiltin);
      }
    }
  }

  /**
   * Saves current in-memory workflows to `.hurdler/registries/workflows.json`.
   */
  async saveToDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const current = this.registry.getAll();
    await saveWorkflowRegistryToDisk(current, options);
  }

  /**
   * Synchronizes in-memory registry with `.hurdler/registries/workflows.json`.
   */
  async syncWithDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<WorkflowRegistryMap> {
    const merged = await syncWorkflowRegistryWithDisk(options);
    for (const workflow of Object.values(merged)) {
      const isBuiltin = workflow.id in STATIC_WORKFLOWS;
      this.registerInternal(workflow, isBuiltin);
    }
    return merged;
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

// ============================================================================
// STANDALONE FUNCTIONAL API (Function-First Architecture)
// ============================================================================

/**
 * Retrieves a workflow definition by its unique identifier.
 *
 * @param workflowId - Unique workflow identifier (e.g. 'feature-development', 'bug-fix-and-debug').
 * @returns Defensive copy of WorkflowDefinition.
 * @throws {WorkflowNotFoundError} If workflow ID is not registered.
 */
export function getWorkflow(workflowId: string): WorkflowDefinition {
  return defaultWorkflowRegistry.get(workflowId);
}

/**
 * Retrieves a workflow definition by ID, or returns null if not found.
 *
 * @param workflowId - Unique workflow identifier.
 * @returns WorkflowDefinition or null.
 */
export function getWorkflowOrNull(workflowId: string): WorkflowDefinition | null {
  return defaultWorkflowRegistry.getOrNull(workflowId);
}

/**
 * Checks whether a workflow with the given ID exists in the registry.
 *
 * @param workflowId - Unique workflow identifier.
 * @returns True if registered, false otherwise.
 */
export function hasWorkflow(workflowId: string): boolean {
  return defaultWorkflowRegistry.has(workflowId);
}

/**
 * Lists all registered workflows, optionally filtered by search criteria.
 *
 * @param filter - Optional query filter options.
 * @returns Array of matching WorkflowDefinitions.
 */
export function listWorkflows(filter?: WorkflowQueryFilter): WorkflowDefinition[] {
  return filter ? defaultWorkflowRegistry.query(filter) : defaultWorkflowRegistry.getAll();
}

/**
 * Registers a new workflow into the registry.
 *
 * @param workflow - Complete or partial workflow input definition.
 * @param options - Optional persistence settings.
 * @returns Created WorkflowDefinition.
 * @throws {WorkflowAlreadyExistsError} If workflow ID already exists.
 * @throws {WorkflowValidationError} If schema validation fails.
 */
export function registerWorkflow(
  workflow: WorkflowInput | WorkflowDefinition,
  options?: WorkflowStorageOptions
): WorkflowDefinition {
  return defaultWorkflowRegistry.register(workflow, options);
}

/**
 * Updates an existing registered workflow.
 *
 * @param workflowId - ID of workflow to update.
 * @param updates - Partial workflow properties to update.
 * @param options - Optional persistence settings.
 * @returns Updated WorkflowDefinition.
 * @throws {WorkflowNotFoundError} If workflow does not exist.
 * @throws {WorkflowValidationError} If updated payload is invalid.
 */
export function updateWorkflow(
  workflowId: string,
  updates: WorkflowUpdateInput,
  options?: WorkflowStorageOptions
): WorkflowDefinition {
  return defaultWorkflowRegistry.update(workflowId, updates, options);
}

/**
 * Upserts a workflow (registers if new, updates if existing).
 *
 * @param workflow - Workflow definition payload.
 * @param options - Optional persistence settings.
 * @returns Registered or updated WorkflowDefinition.
 */
export function registerOrUpdateWorkflow(
  workflow: WorkflowInput | WorkflowDefinition,
  options?: WorkflowStorageOptions
): WorkflowDefinition {
  return defaultWorkflowRegistry.registerOrUpdate(workflow, options);
}

/**
 * Unregisters a workflow from the registry.
 *
 * @param workflowId - ID of workflow to remove.
 * @param options - Optional persistence and force overrides.
 * @returns True if removed, false if not found.
 * @throws {BuiltinWorkflowProtectionError} If attempting to remove built-in workflow without force: true.
 */
export function unregisterWorkflow(
  workflowId: string,
  options?: WorkflowStorageOptions
): boolean {
  return defaultWorkflowRegistry.unregister(workflowId, options);
}

/**
 * Clears all custom workflow registrations and resets registry to static defaults.
 *
 * @param options - Optional persistence settings.
 */
export function clearCustomWorkflows(options?: WorkflowStorageOptions): void {
  defaultWorkflowRegistry.clearCustom(options);
}

/**
 * Resets the entire workflow registry to baseline static workflows.
 *
 * @param options - Optional persistence settings.
 */
export function resetWorkflowRegistry(options?: WorkflowStorageOptions): void {
  defaultWorkflowRegistry.reset(options);
}

/**
 * Retrieves all workflows in a specific domain category.
 *
 * @param category - Category name (e.g. 'feature_development', 'debugging', 'security_hardening').
 * @returns Array of WorkflowDefinitions.
 */
export function getWorkflowsByCategory(category: string): WorkflowDefinition[] {
  return defaultWorkflowRegistry.getByCategory(category);
}

/**
 * Retrieves all workflows possessing a specific tag.
 *
 * @param tag - Tag string (e.g. 'auth', 'database', 'nextjs').
 * @returns Array of WorkflowDefinitions.
 */
export function getWorkflowsByTag(tag: string): WorkflowDefinition[] {
  return defaultWorkflowRegistry.getByTag(tag);
}

/**
 * Retrieves all workflows that use a specific agent.
 *
 * @param agentId - Unique agent identifier.
 * @returns Array of WorkflowDefinitions.
 */
export function getWorkflowsByAgent(agentId: string): WorkflowDefinition[] {
  return defaultWorkflowRegistry.getByAgent(agentId);
}

/**
 * Queries workflows matching multi-criteria filter options.
 *
 * @param filter - Criteria including category, tags, agent ID, search keyword, activeOnly.
 * @returns Array of matching WorkflowDefinitions.
 */
export function queryWorkflows(filter: WorkflowQueryFilter): WorkflowDefinition[] {
  return defaultWorkflowRegistry.query(filter);
}

/**
 * Returns total count of registered workflows.
 */
export function countWorkflows(): number {
  return defaultWorkflowRegistry.count();
}

/**
 * Returns all active workflows currently eligible for execution.
 */
export function getActiveWorkflows(): WorkflowDefinition[] {
  return defaultWorkflowRegistry.query({ activeOnly: true });
}

/**
 * Returns all built-in static default workflows.
 */
export function getBuiltinWorkflows(): WorkflowDefinition[] {
  return defaultWorkflowRegistry.query({ isBuiltin: true });
}

/**
 * Returns all user-registered custom workflows.
 */
export function getCustomWorkflows(): WorkflowDefinition[] {
  return defaultWorkflowRegistry.query({ isBuiltin: false });
}

/**
 * Helper factory function to construct a valid WorkflowDefinition object with defaults.
 *
 * @param input - Partial or complete workflow fields.
 * @returns Validated WorkflowDefinition.
 */
export function createWorkflow(input: WorkflowInput): WorkflowDefinition {
  const result = WorkflowDefinitionSchema.safeParse(input);
  if (!result.success) {
    throw new WorkflowValidationError(input.id ?? 'unknown', result.error.issues);
  }
  return result.data;
}

/**
 * Helper factory function to construct a valid WorkflowStepDefinition object with defaults.
 *
 * @param input - Step definition fields.
 * @returns Validated WorkflowStepDefinition.
 */
export function createWorkflowStep(input: Partial<WorkflowStepDefinition> & { id: string; title: string }): WorkflowStepDefinition {
  const result = WorkflowStepDefinitionSchema.safeParse(input);
  if (!result.success) {
    throw new WorkflowValidationError(input.id, result.error.issues);
  }
  return result.data;
}

import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import {
  NativeToolDefinitionSchema,
  ToolFilterOptionsSchema,
  ToolUpdateSchema,
} from './schema.js';
import { ToolNotFoundError, ToolAlreadyExistsError } from './errors.js';
import { STATIC_TOOLS } from './native/index.js';
import { toAISDKToolMap, toAISDKTool } from './adapter.js';
import { executeTool } from './runner.js';
import {
  saveToolRegistryToDisk,
  loadToolRegistryFromDisk,
  syncToolRegistryWithDisk,
} from './storage.js';
import type { Tool } from 'ai';
import type {
  NativeToolDefinition,
  ToolCategory,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolFilterOptions,
  ToolUpdate,
} from './types.js';

/**
 * Universal Tool Registry Service for registering, querying, sandboxing,
 * updating, and converting native tools into AI SDK tools.
 */
export class ToolRegistryService {
  private readonly registry: BaseRegistry<string, NativeToolDefinition>;

  constructor(initialTools?: Record<string, NativeToolDefinition>) {
    this.registry = new BaseRegistry<string, NativeToolDefinition>({
      name: 'ToolsRegistry',
      schema: NativeToolDefinitionSchema,
      keyExtractor: (t) => t.name,
    });

    const toolsToLoad = initialTools ?? STATIC_TOOLS;
    for (const tool of Object.values(toolsToLoad)) {
      this.registerInternal(tool);
    }
  }

  /**
   * Internal registration helper for initialization without throwing duplicate errors.
   */
  private registerInternal(tool: NativeToolDefinition): void {
    const validated = NativeToolDefinitionSchema.parse(tool) as NativeToolDefinition;
    if (this.registry.has(validated.name)) {
      this.registry.unregister(validated.name);
    }
    this.registry.register(validated.name, validated);
  }

  /**
   * Registers a new native tool.
   * Throws ToolAlreadyExistsError if a tool with the same name already exists.
   */
  register(tool: NativeToolDefinition): this {
    const validated = NativeToolDefinitionSchema.parse(tool) as NativeToolDefinition;

    if (this.registry.has(validated.name)) {
      throw new ToolAlreadyExistsError(validated.name);
    }

    this.registry.register(validated.name, validated);
    devInfo('TOOL_REGISTRY', `Registered tool '${validated.name}' (category: ${validated.category})`);
    return this;
  }

  /**
   * Registers or overwrites an existing tool definition.
   */
  registerOrUpdate(tool: NativeToolDefinition): this {
    const validated = NativeToolDefinitionSchema.parse(tool) as NativeToolDefinition;

    if (this.registry.has(validated.name)) {
      this.registry.unregister(validated.name);
    }

    this.registry.register(validated.name, validated);
    devInfo('TOOL_REGISTRY', `Registered/Updated tool '${validated.name}' (category: ${validated.category})`);
    return this;
  }

  /**
   * Updates an existing tool with partial attributes.
   *
   * @param name - Tool name.
   * @param updates - Partial tool updates.
   */
  update(name: string, updates: ToolUpdate): NativeToolDefinition {
    const existing = this.get(name);
    const validatedUpdates = ToolUpdateSchema.parse(updates);

    const updated: NativeToolDefinition = {
      ...existing,
      ...validatedUpdates,
      name: existing.name,
      tags: validatedUpdates.tags
        ? Array.from(new Set([...(existing.tags || []), ...validatedUpdates.tags]))
        : existing.tags,
      metadata: validatedUpdates.metadata
        ? { ...(existing.metadata || {}), ...validatedUpdates.metadata }
        : existing.metadata,
    };

    this.registerOrUpdate(updated);
    devInfo('TOOL_REGISTRY', `Updated tool '${name}'`);
    return updated;
  }

  /**
   * Unregisters a tool by name.
   *
   * @param name - Tool name to remove.
   * @returns true if tool was removed.
   */
  unregister(name: string): boolean {
    const removed = this.registry.unregister(name);
    if (removed) {
      devInfo('TOOL_REGISTRY', `Unregistered tool '${name}'`);
    }
    return removed;
  }

  /**
   * Registers multiple tools at once.
   */
  registerMany(tools: NativeToolDefinition[] | Record<string, NativeToolDefinition>): this {
    const list = Array.isArray(tools) ? tools : Object.values(tools);
    for (const tool of list) {
      this.register(tool);
    }
    return this;
  }

  /**
   * Retrieves a tool by name or throws ToolNotFoundError.
   */
  get(name: string): NativeToolDefinition {
    const tool = this.registry.getOrNull(name);
    if (!tool) {
      const available = this.registry.getAll().map((t) => t.name);
      throw new ToolNotFoundError(name, available);
    }
    return tool;
  }

  /**
   * Retrieves a tool by name or returns null.
   */
  getOrNull(name: string): NativeToolDefinition | null {
    return this.registry.getOrNull(name);
  }

  /**
   * Checks if a tool is registered.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Returns all registered tools.
   */
  getAll(): NativeToolDefinition[] {
    return this.registry.getAll();
  }

  /**
   * Returns all tools belonging to a specific category.
   */
  getByCategory(category: ToolCategory): NativeToolDefinition[] {
    return this.registry.filter((t) => t.category === category);
  }

  /**
   * Returns all tools matching at least one tag.
   */
  getByTags(tags: string[]): NativeToolDefinition[] {
    if (!tags || tags.length === 0) return [];
    return this.registry.filter((t) =>
      t.tags ? tags.some((tag) => t.tags?.includes(tag)) : false
    );
  }

  /**
   * Filter tools using a custom predicate.
   */
  filter(predicate: (tool: NativeToolDefinition, name: string) => boolean): NativeToolDefinition[] {
    return this.registry.filter(predicate);
  }

  /**
   * Resolves a set of tools based on filter criteria and converts them directly into
   * Vercel AI SDK compatible tools dictionary (Record<string, Tool>) for LLMs and workflows.
   */
  resolveTools(
    options?: ToolFilterOptions,
    context?: ToolExecutionContext
  ): Record<string, Tool> {
    const validated = options ? ToolFilterOptionsSchema.parse(options) : undefined;
    let selected: NativeToolDefinition[] = this.getAll();

    if (validated) {
      // Filter by names
      if (validated.names && validated.names.length > 0) {
        const nameSet = new Set(validated.names);
        selected = selected.filter((t) => nameSet.has(t.name));
      }

      // Filter by categories
      if (validated.categories && validated.categories.length > 0) {
        const catSet = new Set(validated.categories);
        selected = selected.filter((t) => catSet.has(t.category));
      }

      // Filter by tags
      if (validated.tags && validated.tags.length > 0) {
        selected = selected.filter((t) =>
          t.tags ? validated.tags!.some((tag) => t.tags?.includes(tag)) : false
        );
      }

      // Exclude names
      if (validated.excludeNames && validated.excludeNames.length > 0) {
        const excludeSet = new Set(validated.excludeNames);
        selected = selected.filter((t) => !excludeSet.has(t.name));
      }

      // Read-only only
      if (validated.readOnlyOnly) {
        selected = selected.filter((t) => t.readOnly === true);
      }
    }

    return toAISDKToolMap(selected, context);
  }

  /**
   * Directly executes a registered tool by name.
   */
  async execute<TInput = any, TOutput = any>(
    name: string,
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>> {
    const tool = this.get(name);
    return executeTool<TInput, TOutput>(tool, input, context);
  }

  /**
   * Synchronizes this registry instance with `.hurdler/registries/tools.json` on disk.
   */
  async syncWithDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const diskMap = await syncToolRegistryWithDisk(options);
    for (const [name, meta] of Object.entries(diskMap)) {
      if (this.has(name)) {
        this.update(name, meta);
      }
    }
  }

  /**
   * Loads registry records from disk.
   */
  async loadFromDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const diskMap = await loadToolRegistryFromDisk(options);
    if (diskMap) {
      for (const [name, meta] of Object.entries(diskMap)) {
        if (this.has(name)) {
          this.update(name, meta);
        }
      }
    }
  }

  /**
   * Persists current in-memory registry to `.hurdler/registries/tools.json`.
   */
  async saveToDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const allTools = this.registry.getAll();
    await saveToolRegistryToDisk(allTools, options);
  }

  /**
   * Resets registry back to baseline static tools.
   */
  reset(): void {
    this.registry.clear();
    for (const tool of Object.values(STATIC_TOOLS)) {
      this.registerInternal(tool);
    }
    devInfo('TOOL_REGISTRY', 'Reset tool registry to baseline static tools');
  }

  /**
   * Returns total count of registered tools.
   */
  count(): number {
    return this.registry.count();
  }

  /**
   * Freezes registry preventing further registrations or edits.
   */
  freeze(): this {
    this.registry.freeze();
    return this;
  }

  /**
   * Checks if registry is frozen.
   */
  isFrozen(): boolean {
    return this.registry.isFrozen();
  }
}

/**
 * Default global singleton instance of the Tool Registry Service.
 */
export const defaultToolRegistry = new ToolRegistryService();

// ============================================================================
// STANDALONE FUNCTIONAL API (Function-First Paradigm)
// ============================================================================

/**
 * Retrieves a tool definition by name from the default registry.
 *
 * @example
 * ```ts
 * const tool = getTool('create_file');
 * console.log(tool.description);
 * ```
 * @param name - Tool name.
 * @throws ToolNotFoundError if tool is not registered.
 */
export function getTool(name: string): NativeToolDefinition {
  return defaultToolRegistry.get(name);
}

/**
 * Checks whether a tool is registered in the default registry.
 *
 * @param name - Tool name.
 */
export function hasTool(name: string): boolean {
  return defaultToolRegistry.has(name);
}

/**
 * Lists registered tools from the default registry, optionally filtered by category.
 *
 * @param category - Optional functional category filter.
 */
export function listTools(category?: ToolCategory): NativeToolDefinition[] {
  if (category) {
    return defaultToolRegistry.getByCategory(category);
  }
  return defaultToolRegistry.getAll();
}

/**
 * Returns all registered tools belonging to a specific category.
 *
 * @param category - Functional category name.
 */
export function getToolsByCategory(category: ToolCategory): NativeToolDefinition[] {
  return defaultToolRegistry.getByCategory(category);
}

/**
 * Returns all registered tools matching at least one tag.
 *
 * @param tags - Array of tag strings.
 */
export function getToolsByTags(tags: string[]): NativeToolDefinition[] {
  return defaultToolRegistry.getByTags(tags);
}

/**
 * Filters registered tools using a custom predicate function.
 *
 * @param predicate - Filter predicate function.
 */
export function filterTools(
  predicate: (tool: NativeToolDefinition, name: string) => boolean
): NativeToolDefinition[] {
  return defaultToolRegistry.filter(predicate);
}

/**
 * Registers a new native tool in the default registry.
 * Optionally persists changes to `.hurdler/registries/tools.json`.
 *
 * @example
 * ```ts
 * registerTool({
 *   name: 'custom_lint',
 *   description: 'Runs custom code linter',
 *   category: 'custom',
 *   parameters: z.object({ path: z.string() }),
 *   execute: async ({ path }) => ({ passed: true })
 * });
 * ```
 * @param tool - Native tool definition.
 * @param options - Optional persistence settings.
 */
export function registerTool(
  tool: NativeToolDefinition,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): void {
  defaultToolRegistry.register(tool);
  if (options?.persist) {
    saveToolRegistry(options).catch((err) => {
      devWarn('TOOL_REGISTRY', `Failed to persist registry after registering tool '${tool.name}': ${err.message}`);
    });
  }
}

/**
 * Registers multiple native tools in the default registry.
 *
 * @param tools - Array or dictionary of tool definitions.
 * @param options - Optional persistence settings.
 */
export function registerTools(
  tools: NativeToolDefinition[] | Record<string, NativeToolDefinition>,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): void {
  defaultToolRegistry.registerMany(tools);
  if (options?.persist) {
    saveToolRegistry(options).catch((err) => {
      devWarn('TOOL_REGISTRY', `Failed to persist registry after registering tools: ${err.message}`);
    });
  }
}

/**
 * Updates an existing tool definition in the default registry with partial fields.
 *
 * @param name - Tool name.
 * @param updates - Partial tool updates.
 * @param options - Optional persistence settings.
 */
export function updateTool(
  name: string,
  updates: ToolUpdate,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): NativeToolDefinition {
  const updated = defaultToolRegistry.update(name, updates);
  if (options?.persist) {
    saveToolRegistry(options).catch((err) => {
      devWarn('TOOL_REGISTRY', `Failed to persist registry after updating tool '${name}': ${err.message}`);
    });
  }
  return updated;
}

/**
 * Unregisters a tool from the default registry.
 *
 * @param name - Tool name to remove.
 * @param options - Optional persistence settings.
 */
export function unregisterTool(
  name: string,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): boolean {
  const removed = defaultToolRegistry.unregister(name);
  if (removed && options?.persist) {
    saveToolRegistry(options).catch((err) => {
      devWarn('TOOL_REGISTRY', `Failed to persist registry after unregistering tool '${name}': ${err.message}`);
    });
  }
  return removed;
}

/**
 * Resolves registered tools matching filter criteria and converts them directly
 * into Vercel AI SDK compatible tools dictionary (`Record<string, Tool>`).
 *
 * @example
 * ```ts
 * const aiTools = resolveTools({ categories: ['filesystem', 'editing'], readOnlyOnly: true });
 * const result = await callLLM({ prompt: '...', tools: aiTools });
 * ```
 * @param options - Tool filter criteria (names, categories, tags, excludeNames, readOnlyOnly).
 * @param context - Optional execution context (workspaceRoot, agentId, timeoutMs).
 */
export function resolveTools(
  options?: ToolFilterOptions,
  context?: ToolExecutionContext
): Record<string, Tool> {
  return defaultToolRegistry.resolveTools(options, context);
}

/**
 * Directly executes a registered tool by name with input parameters and execution context.
 *
 * @example
 * ```ts
 * const result = await runTool('read_file', { path: 'src/index.ts' }, { workspaceRoot: '/app' });
 * if (result.success) {
 *   console.log(result.output.content);
 * }
 * ```
 * @param name - Tool name.
 * @param input - Input payload matching tool's Zod parameters schema.
 * @param context - Optional execution context.
 */
export async function runTool<TInput = any, TOutput = any>(
  name: string,
  input: TInput,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult<TOutput>> {
  return defaultToolRegistry.execute<TInput, TOutput>(name, input, context);
}

/**
 * Loads registry records from `.hurdler/registries/tools.json` into default registry.
 */
export async function loadToolRegistry(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  await defaultToolRegistry.loadFromDisk(options);
}

/**
 * Saves default in-memory registry to `.hurdler/registries/tools.json`.
 */
export async function saveToolRegistry(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  await defaultToolRegistry.saveToDisk(options);
}

/**
 * Synchronizes default in-memory registry with `.hurdler/registries/tools.json`.
 * If file does not exist, creates it with baseline tools metadata.
 */
export async function syncToolRegistry(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  await defaultToolRegistry.syncWithDisk(options);
}

/**
 * Resets default registry back to baseline static tools.
 */
export function resetToolRegistry(): void {
  defaultToolRegistry.reset();
}

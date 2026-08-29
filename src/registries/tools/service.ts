import { BaseRegistry } from '../base/registry.js';
import { devInfo } from '../../core/dev-mode/dev-mode.js';
import { NativeToolDefinitionSchema, ToolFilterOptionsSchema } from './schema.js';
import { ToolNotFoundError, ToolAlreadyExistsError } from './errors.js';
import { STATIC_TOOLS } from './native/index.js';
import { toAISDKToolMap, toAISDKTool } from './adapter.js';
import { executeTool } from './runner.js';
import type { Tool } from 'ai';
import type {
  NativeToolDefinition,
  ToolCategory,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolFilterOptions,
} from './types.js';

/**
 * Universal Tool Registry Service for registering, querying, sandboxing,
 * and converting native tools into AI SDK tools.
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
      throw new ToolNotFoundError(name);
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

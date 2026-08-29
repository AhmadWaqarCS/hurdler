import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import {
  PromptDefinitionSchema,
  PromptCompositionOptionsSchema,
  PromptUpdateSchema,
  PromptRegistryConfigSchema,
} from './schema.js';
import {
  PromptNotFoundError,
  PromptAlreadyExistsError,
  PromptValidationError,
} from './errors.js';
import { STATIC_PROMPTS } from './static-prompts.js';
import { extractVariables, renderTemplate } from './renderer.js';
import { PromptCacheEngine } from './cache.js';
import {
  savePromptRegistryToDisk,
  loadPromptRegistryFromDisk,
  syncPromptRegistryWithDisk,
} from './storage.js';
import type {
  PromptDefinition,
  PromptCompositionOptions,
  ComposedPromptResult,
  PromptCacheStats,
  PromptUpdate,
  PromptRegistryConfig,
  PromptStorageOptions,
  PromptRenderOptions,
} from './types.js';

/**
 * Universal Prompt Registry Service for managing, querying, rendering, composing,
 * persisting, and caching prompts for agents and workflows.
 */
export class PromptRegistryService {
  private readonly registry: BaseRegistry<string, PromptDefinition>;
  private readonly cache = new PromptCacheEngine();
  private config: PromptRegistryConfig;

  constructor(
    initialPrompts?: Record<string, PromptDefinition> | PromptDefinition[],
    config?: Partial<PromptRegistryConfig>
  ) {
    this.config = PromptRegistryConfigSchema.parse(config ?? {});
    this.registry = new BaseRegistry<string, PromptDefinition>({
      name: 'PromptsRegistry',
      schema: PromptDefinitionSchema,
      keyExtractor: (p) => p.id,
    });

    const promptsToLoad = initialPrompts ?? STATIC_PROMPTS;
    const promptList = Array.isArray(promptsToLoad) ? promptsToLoad : Object.values(promptsToLoad);
    for (const prompt of promptList) {
      this.registerPromptInternal(prompt);
    }
  }

  /**
   * Updates runtime configuration for the registry service.
   *
   * @param config Partial configuration updates
   * @returns this
   */
  configure(config: Partial<PromptRegistryConfig>): this {
    this.config = PromptRegistryConfigSchema.parse({
      ...this.config,
      ...config,
    });
    devInfo('PROMPT_REGISTRY', `Configured prompt registry (autoSync: ${this.config.autoSync}, cacheEnabled: ${this.config.cacheEnabled})`);
    return this;
  }

  /**
   * Retrieves the current configuration of the registry.
   *
   * @returns Current PromptRegistryConfig
   */
  getConfig(): PromptRegistryConfig {
    return { ...this.config };
  }

  /**
   * Internal helper to register and validate a prompt without throwing duplicate error on initial load.
   */
  private registerPromptInternal(prompt: PromptDefinition): void {
    const validated = PromptDefinitionSchema.parse(prompt);
    if (!validated.variables || validated.variables.length === 0) {
      validated.variables = extractVariables(validated.content);
    }

    if (this.registry.has(validated.id)) {
      this.registry.unregister(validated.id);
    }
    this.registry.register(validated.id, validated);
  }

  /**
   * Triggers an automatic disk synchronization if autoSync is enabled.
   */
  private autoSyncIfEnabled(override?: boolean): void {
    const shouldSync = override !== undefined ? override : this.config.autoSync;
    if (shouldSync) {
      try {
        savePromptRegistryToDisk(this.registry.getAll(), {
          customPath: this.config.storagePath,
        });
      } catch (err) {
        devWarn('PROMPT_REGISTRY', `Auto-sync to disk failed: ${String(err)}`);
      }
    }
  }

  /**
   * Registers a new prompt into the registry.
   * Throws PromptAlreadyExistsError if a prompt with the same ID is already registered.
   *
   * @param prompt Prompt definition to register
   * @param options Optional registration options (syncToDisk)
   * @returns this
   * @throws {PromptAlreadyExistsError} If prompt ID already exists
   * @throws {PromptValidationError} If prompt schema validation fails
   */
  register(prompt: PromptDefinition, options: { syncToDisk?: boolean } = {}): this {
    const validated = PromptDefinitionSchema.parse(prompt);

    if (this.registry.has(validated.id)) {
      throw new PromptAlreadyExistsError(validated.id);
    }

    if (!validated.variables || validated.variables.length === 0) {
      validated.variables = extractVariables(validated.content);
    }

    const now = new Date().toISOString();
    if (!validated.createdAt) {
      validated.createdAt = now;
    }
    validated.updatedAt = now;

    this.registry.register(validated.id, validated);
    this.cache.clear();

    devInfo('PROMPT_REGISTRY', `Registered prompt '${validated.id}' (${validated.title}) [category: ${validated.category}]`);
    this.autoSyncIfEnabled(options.syncToDisk);
    return this;
  }

  /**
   * Registers or overwrites an existing prompt.
   *
   * @param prompt Prompt definition to register or update
   * @param options Optional registration options
   * @returns this
   */
  registerOrUpdate(prompt: PromptDefinition, options: { syncToDisk?: boolean } = {}): this {
    const validated = PromptDefinitionSchema.parse(prompt);

    if (!validated.variables || validated.variables.length === 0) {
      validated.variables = extractVariables(validated.content);
    }

    const now = new Date().toISOString();
    if (this.registry.has(validated.id)) {
      const existing = this.registry.get(validated.id);
      validated.createdAt = existing.createdAt ?? now;
      this.registry.unregister(validated.id);
    } else {
      validated.createdAt = validated.createdAt ?? now;
    }
    validated.updatedAt = now;

    this.registry.register(validated.id, validated);
    this.cache.clear();

    devInfo('PROMPT_REGISTRY', `Registered/Updated prompt '${validated.id}' (${validated.title})`);
    this.autoSyncIfEnabled(options.syncToDisk);
    return this;
  }

  /**
   * Registers multiple prompts at once.
   *
   * @param prompts Array or dictionary of prompts
   * @param options Optional registration options
   * @returns this
   */
  registerMany(
    prompts: PromptDefinition[] | Record<string, PromptDefinition>,
    options: { syncToDisk?: boolean } = {}
  ): this {
    const list = Array.isArray(prompts) ? prompts : Object.values(prompts);
    for (const prompt of list) {
      this.register(prompt, { syncToDisk: false });
    }
    this.autoSyncIfEnabled(options.syncToDisk);
    return this;
  }

  /**
   * Partially updates an existing prompt definition in the registry.
   *
   * @param id Prompt ID to update
   * @param updates Partial fields to apply
   * @param options Optional update options
   * @returns The updated PromptDefinition
   * @throws {PromptNotFoundError} If the prompt ID is not registered
   * @throws {PromptValidationError} If resulting prompt fails schema validation
   */
  update(
    id: string,
    updates: PromptUpdate,
    options: { syncToDisk?: boolean } = {}
  ): PromptDefinition {
    const existing = this.get(id);
    const parsedUpdates = PromptUpdateSchema.parse(updates);

    const mergedContent = parsedUpdates.content ?? existing.content;
    const mergedVariables =
      parsedUpdates.variables ??
      (parsedUpdates.content ? extractVariables(mergedContent) : existing.variables);

    const updatedPrompt: PromptDefinition = {
      ...existing,
      ...parsedUpdates,
      content: mergedContent,
      variables: mergedVariables,
      updatedAt: new Date().toISOString(),
    };

    const validated = PromptDefinitionSchema.parse(updatedPrompt);
    this.registry.unregister(id);
    this.registry.register(validated.id, validated);
    this.cache.clear();

    devInfo('PROMPT_REGISTRY', `Updated prompt '${id}' (${validated.title})`);
    this.autoSyncIfEnabled(options.syncToDisk);
    return validated;
  }

  /**
   * Unregisters a prompt by ID.
   *
   * @param id Prompt ID to remove
   * @param options Optional unregister options
   * @returns True if removed, false if not found
   */
  unregister(id: string, options: { syncToDisk?: boolean } = {}): boolean {
    const removed = this.registry.unregister(id);
    if (removed) {
      this.cache.clear();
      devInfo('PROMPT_REGISTRY', `Unregistered prompt '${id}'`);
      this.autoSyncIfEnabled(options.syncToDisk);
    }
    return removed;
  }

  /**
   * Checks if a prompt exists by ID.
   *
   * @param id Prompt ID
   * @returns True if present
   */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * Retrieves a prompt by ID or throws PromptNotFoundError.
   *
   * @param id Prompt ID
   * @returns PromptDefinition
   * @throws {PromptNotFoundError} If prompt ID is not found
   */
  get(id: string): PromptDefinition {
    const prompt = this.registry.getOrNull(id);
    if (!prompt) {
      const allIds = this.registry.getAll().map((p) => p.id);
      throw new PromptNotFoundError(id, allIds);
    }
    return prompt;
  }

  /**
   * Retrieves a prompt by ID or returns null if not found.
   *
   * @param id Prompt ID
   * @returns PromptDefinition or null
   */
  getOrNull(id: string): PromptDefinition | null {
    return this.registry.getOrNull(id);
  }

  /**
   * Retrieves all prompts belonging to a given category, sorted by priority.
   *
   * @param category Category name (e.g. 'global', 'system', 'agent')
   * @returns Array of PromptDefinition
   */
  getByCategory(category: string): PromptDefinition[] {
    const normalized = category.toLowerCase().trim();
    return this.registry
      .filter((p) => p.category.toLowerCase().trim() === normalized)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Retrieves all prompts matching a specific title (case-insensitive), sorted by priority.
   * Supports multiple prompts sharing the same title.
   *
   * @param title Title to match
   * @returns Array of PromptDefinition
   */
  getByTitle(title: string): PromptDefinition[] {
    const normalized = title.toLowerCase().trim();
    return this.registry
      .filter((p) => p.title.toLowerCase().trim() === normalized)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Retrieves prompts matching any (or all) of the specified tags.
   *
   * @param tags Tag names to search
   * @param matchAll If true, requires matching all tags; otherwise any tag
   * @returns Array of PromptDefinition
   */
  getByTags(tags: string[], matchAll = false): PromptDefinition[] {
    if (!tags || tags.length === 0) {
      return [];
    }
    const normalizedTags = tags.map((t) => t.toLowerCase().trim());

    return this.registry
      .filter((p) => {
        if (!p.tags || p.tags.length === 0) {
          return false;
        }
        const promptTags = p.tags.map((t) => t.toLowerCase().trim());
        if (matchAll) {
          return normalizedTags.every((t) => promptTags.includes(t));
        }
        return normalizedTags.some((t) => promptTags.includes(t));
      })
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Returns all registered prompts, sorted by priority.
   *
   * @returns Array of all PromptDefinition
   */
  getAll(): PromptDefinition[] {
    return this.registry.getAll().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Finds the first prompt matching a predicate function.
   *
   * @param predicate Filter callback
   * @returns PromptDefinition or undefined
   */
  find(predicate: (prompt: PromptDefinition) => boolean): PromptDefinition | undefined {
    return this.registry.find(predicate);
  }

  /**
   * Filters registered prompts matching a predicate function, sorted by priority.
   *
   * @param predicate Filter callback
   * @returns Array of PromptDefinition
   */
  filter(predicate: (prompt: PromptDefinition) => boolean): PromptDefinition[] {
    return this.registry.filter(predicate).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Returns the count of registered prompts.
   *
   * @returns Total number of prompts
   */
  count(): number {
    return this.registry.count();
  }

  /**
   * Renders a single prompt template by ID or PromptDefinition, applying variable substitutions.
   *
   * @param idOrPrompt Prompt ID or PromptDefinition object
   * @param variables Key-value map of variable values
   * @param strict If true, throws PromptRenderError on missing un-defaulted variables
   * @returns Interpolated prompt string
   */
  renderPrompt(
    idOrPrompt: string | PromptDefinition,
    variables: Record<string, string | number | boolean> = {},
    strict?: boolean
  ): string {
    const isStrict = strict !== undefined ? strict : this.config.strictVariables;
    const prompt = typeof idOrPrompt === 'string' ? this.get(idOrPrompt) : idOrPrompt;
    return renderTemplate(prompt.content, { variables, strict: isStrict });
  }

  /**
   * Composes multiple prompts into a cohesive system instructions block for workflows and LLM generation.
   *
   * @param options Prompt composition options
   * @returns ComposedPromptResult
   */
  compose(options: PromptCompositionOptions): ComposedPromptResult {
    const validatedOptions = PromptCompositionOptionsSchema.parse(options);
    const useCache = this.config.cacheEnabled && validatedOptions.useCache !== false;
    const cacheKey = this.cache.generateKey('compose', validatedOptions);

    if (useCache) {
      const cached = this.cache.get<ComposedPromptResult>(cacheKey);
      if (cached) {
        devDebug('PROMPT_REGISTRY', `Cache hit for prompt composition (prompts: ${cached.promptsUsed.length})`);
        return cached;
      }
    }

    const promptMap = new Map<string, PromptDefinition>();

    // 1. Resolve explicit Prompt IDs
    if (validatedOptions.promptIds) {
      for (const id of validatedOptions.promptIds) {
        const prompt = this.get(id);
        promptMap.set(prompt.id, prompt);
      }
    }

    // 2. Resolve Category queries
    if (validatedOptions.categories) {
      for (const cat of validatedOptions.categories) {
        const matching = this.getByCategory(cat);
        for (const p of matching) {
          promptMap.set(p.id, p);
        }
      }
    }

    // 3. Resolve Title queries
    if (validatedOptions.titles) {
      for (const title of validatedOptions.titles) {
        const matching = this.getByTitle(title);
        for (const p of matching) {
          promptMap.set(p.id, p);
        }
      }
    }

    // 4. Resolve Tag queries
    if (validatedOptions.tags) {
      const matching = this.getByTags(validatedOptions.tags);
      for (const p of matching) {
        promptMap.set(p.id, p);
      }
    }

    // 5. Resolve Inline Prompts
    if (validatedOptions.inlinePrompts) {
      validatedOptions.inlinePrompts.forEach((inline, idx) => {
        if (typeof inline === 'string') {
          const inlinePrompt: PromptDefinition = {
            id: `inline:${idx + 1}`,
            title: `Inline Prompt ${idx + 1}`,
            category: 'custom',
            content: inline,
            variables: extractVariables(inline),
            cacheable: false,
            priority: 100 + idx,
            tags: ['inline'],
          };
          promptMap.set(inlinePrompt.id, inlinePrompt);
        } else if (inline && typeof inline === 'object') {
          const inlinePrompt: PromptDefinition = {
            id: inline.id ?? `inline:${idx + 1}`,
            title: inline.title ?? `Inline Prompt ${idx + 1}`,
            category: inline.category ?? 'custom',
            content: inline.content ?? '',
            variables: inline.variables ?? extractVariables(inline.content ?? ''),
            cacheable: inline.cacheable ?? false,
            priority: inline.priority ?? 100 + idx,
            tags: inline.tags ?? ['inline'],
            ...inline,
          };
          promptMap.set(inlinePrompt.id, inlinePrompt);
        }
      });
    }

    // Sort prompts by priority (lowest number first)
    const sortedPrompts = Array.from(promptMap.values()).sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
    );

    const cachedBlocks: string[] = [];
    const dynamicBlocks: string[] = [];
    const allRenderedBlocks: string[] = [];

    for (const prompt of sortedPrompts) {
      const rendered = renderTemplate(prompt.content, {
        variables: validatedOptions.variables,
        strict: false,
      });

      allRenderedBlocks.push(rendered);

      if (prompt.cacheable !== false) {
        cachedBlocks.push(rendered);
      } else {
        dynamicBlocks.push(rendered);
      }
    }

    const separator = validatedOptions.separator ?? this.config.defaultSeparator;
    const fullSystemPrompt = allRenderedBlocks.join(separator);
    const cachedPromptString =
      validatedOptions.separateCached && cachedBlocks.length > 0
        ? cachedBlocks.join(separator)
        : undefined;

    const totalCharacters =
      fullSystemPrompt.length + (validatedOptions.userPrompt ? validatedOptions.userPrompt.length : 0);
    const estimatedTokens = Math.ceil(totalCharacters / 4);

    const result: ComposedPromptResult = {
      system: fullSystemPrompt,
      cachedPrompt: cachedPromptString,
      prompt: validatedOptions.userPrompt,
      promptsUsed: sortedPrompts,
      variableSubstitutions: validatedOptions.variables,
      totalCharacters,
      estimatedTokens,
    };

    if (useCache) {
      this.cache.set(cacheKey, result, this.config.cacheTtlMs);
    }

    devDebug('PROMPT_REGISTRY', `Composed ${sortedPrompts.length} prompt(s) (Total chars: ${totalCharacters}, est. tokens: ${estimatedTokens})`);
    return result;
  }

  /**
   * Resets the registry to only contain the default static prompts.
   *
   * @param options Optional reset options
   */
  resetToDefaults(options: { syncToDisk?: boolean } = {}): void {
    this.registry.clear();
    this.cache.clear();
    for (const prompt of Object.values(STATIC_PROMPTS)) {
      this.registerPromptInternal(prompt);
    }
    devInfo('PROMPT_REGISTRY', `Reset prompts registry to ${this.registry.count()} default static prompts`);
    this.autoSyncIfEnabled(options.syncToDisk);
  }

  /**
   * Clears all registered prompts and cache.
   *
   * @param options Optional clear options
   */
  clear(options: { syncToDisk?: boolean } = {}): void {
    this.registry.clear();
    this.cache.clear();
    devWarn('PROMPT_REGISTRY', 'Cleared all prompts from registry');
    this.autoSyncIfEnabled(options.syncToDisk);
  }

  /**
   * Loads prompts from the disk storage JSON file.
   *
   * @param options Storage options
   * @returns this
   */
  loadFromDisk(options: PromptStorageOptions = {}): this {
    const diskPrompts = loadPromptRegistryFromDisk({
      customPath: options.customPath ?? this.config.storagePath,
      pretty: options.pretty,
    });
    this.registry.clear();
    this.cache.clear();
    for (const prompt of diskPrompts) {
      this.registerPromptInternal(prompt);
    }
    devInfo('PROMPT_REGISTRY', `Loaded ${diskPrompts.length} prompts from disk into registry`);
    return this;
  }

  /**
   * Saves current in-memory prompts to disk storage JSON.
   *
   * @param options Storage options
   * @returns Absolute path written to
   */
  saveToDisk(options: PromptStorageOptions = {}): string {
    return savePromptRegistryToDisk(this.registry.getAll(), {
      customPath: options.customPath ?? this.config.storagePath,
      pretty: options.pretty,
    });
  }

  /**
   * Synchronizes the prompts registry with disk, merging baseline prompts and disk overrides.
   *
   * @param options Storage options
   * @returns this
   */
  syncWithDisk(options: PromptStorageOptions = {}): this {
    const merged = syncPromptRegistryWithDisk(this.registry.getAll(), {
      customPath: options.customPath ?? this.config.storagePath,
      pretty: options.pretty,
    });
    this.registry.clear();
    this.cache.clear();
    for (const prompt of merged) {
      this.registerPromptInternal(prompt);
    }
    devInfo('PROMPT_REGISTRY', `Synchronized ${merged.length} prompt(s) with disk`);
    return this;
  }

  /**
   * Retrieves prompt cache statistics.
   *
   * @returns PromptCacheStats
   */
  getCacheStats(): PromptCacheStats {
    return this.cache.getStats();
  }

  /**
   * Clears the prompt cache manually.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Resets cache metrics.
   */
  resetCacheStats(): void {
    this.cache.resetStats();
  }
}

/** Global singleton instance of PromptRegistryService */
export const defaultPromptRegistry = new PromptRegistryService();

// ---------------------------------------------------------------------------
// Standalone Functional API Layer (Function-First)
// ---------------------------------------------------------------------------

/**
 * Registers a new prompt into the default registry.
 *
 * @param prompt Prompt definition to register
 * @param options Optional registration options
 * @returns The registered PromptDefinition
 * @throws {PromptAlreadyExistsError} If prompt ID already exists
 * @throws {PromptValidationError} If schema validation fails
 *
 * @example
 * ```ts
 * registerPrompt({
 *   id: 'custom:clean-code',
 *   title: 'Clean Code Rule',
 *   category: 'system',
 *   content: 'Write clean, modular code with descriptive variable names.',
 * });
 * ```
 */
export function registerPrompt(
  prompt: PromptDefinition,
  options?: { syncToDisk?: boolean }
): PromptDefinition {
  defaultPromptRegistry.register(prompt, options);
  return defaultPromptRegistry.get(prompt.id);
}

/**
 * Registers or updates a prompt in the default registry.
 *
 * @param prompt Prompt definition to register or update
 * @param options Optional registration options
 * @returns The registered or updated PromptDefinition
 */
export function registerOrUpdatePrompt(
  prompt: PromptDefinition,
  options?: { syncToDisk?: boolean }
): PromptDefinition {
  defaultPromptRegistry.registerOrUpdate(prompt, options);
  return defaultPromptRegistry.get(prompt.id);
}

/**
 * Registers multiple prompts into the default registry.
 *
 * @param prompts Array or dictionary of prompt definitions
 * @param options Optional registration options
 * @returns Array of registered prompt definitions
 */
export function registerPrompts(
  prompts: PromptDefinition[] | Record<string, PromptDefinition>,
  options?: { syncToDisk?: boolean }
): PromptDefinition[] {
  defaultPromptRegistry.registerMany(prompts, options);
  return defaultPromptRegistry.getAll();
}

/**
 * Partially updates an existing prompt definition in the default registry.
 *
 * @param id Prompt ID to update
 * @param updates Partial fields to apply
 * @param options Optional update options
 * @returns The updated PromptDefinition
 * @throws {PromptNotFoundError} If prompt ID does not exist
 */
export function updatePrompt(
  id: string,
  updates: PromptUpdate,
  options?: { syncToDisk?: boolean }
): PromptDefinition {
  return defaultPromptRegistry.update(id, updates, options);
}

/**
 * Unregisters a prompt from the default registry by ID.
 *
 * @param id Prompt ID to unregister
 * @param options Optional unregister options
 * @returns True if removed, false if not found
 */
export function unregisterPrompt(
  id: string,
  options?: { syncToDisk?: boolean }
): boolean {
  return defaultPromptRegistry.unregister(id, options);
}

/**
 * Retrieves a prompt by ID from the default registry or throws PromptNotFoundError.
 *
 * @param id Prompt ID
 * @returns PromptDefinition
 * @throws {PromptNotFoundError} If prompt ID is not found
 */
export function getPrompt(id: string): PromptDefinition {
  return defaultPromptRegistry.get(id);
}

/**
 * Retrieves a prompt by ID or returns null if not found.
 *
 * @param id Prompt ID
 * @returns PromptDefinition or null
 */
export function getPromptOrNull(id: string): PromptDefinition | null {
  return defaultPromptRegistry.getOrNull(id);
}

/**
 * Checks if a prompt exists in the default registry.
 *
 * @param id Prompt ID
 * @returns True if registered
 */
export function hasPrompt(id: string): boolean {
  return defaultPromptRegistry.has(id);
}

/**
 * Lists all registered prompts, optionally filtered by category, tag, or title.
 *
 * @param options Optional filter query
 * @returns Array of PromptDefinition
 */
export function listPrompts(options?: {
  category?: string;
  tag?: string;
  title?: string;
}): PromptDefinition[] {
  if (!options) {
    return defaultPromptRegistry.getAll();
  }

  let list = defaultPromptRegistry.getAll();

  if (options.category) {
    const cat = options.category.toLowerCase().trim();
    list = list.filter((p) => p.category.toLowerCase().trim() === cat);
  }
  if (options.tag) {
    const tag = options.tag.toLowerCase().trim();
    list = list.filter((p) => p.tags?.some((t) => t.toLowerCase().trim() === tag));
  }
  if (options.title) {
    const title = options.title.toLowerCase().trim();
    list = list.filter((p) => p.title.toLowerCase().trim() === title);
  }

  return list.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/**
 * Retrieves all prompts in a category from the default registry.
 *
 * @param category Category name
 * @returns Array of PromptDefinition
 */
export function getPromptsByCategory(category: string): PromptDefinition[] {
  return defaultPromptRegistry.getByCategory(category);
}

/**
 * Retrieves all prompts with a matching title from the default registry.
 *
 * @param title Prompt title
 * @returns Array of PromptDefinition
 */
export function getPromptsByTitle(title: string): PromptDefinition[] {
  return defaultPromptRegistry.getByTitle(title);
}

/**
 * Retrieves all prompts matching specific tags.
 *
 * @param tags Tags array
 * @param matchAll If true, prompts must match all tags
 * @returns Array of PromptDefinition
 */
export function getPromptsByTags(tags: string[], matchAll = false): PromptDefinition[] {
  return defaultPromptRegistry.getByTags(tags, matchAll);
}

/**
 * Convenience helper to retrieve all global prompts.
 *
 * @returns Array of global PromptDefinition
 */
export function getGlobalPrompts(): PromptDefinition[] {
  return defaultPromptRegistry.getByCategory('global');
}

/**
 * Convenience helper to retrieve all system prompts.
 *
 * @returns Array of system PromptDefinition
 */
export function getSystemPrompts(): PromptDefinition[] {
  return defaultPromptRegistry.getByCategory('system');
}

/**
 * Convenience helper to retrieve all agent prompts.
 *
 * @returns Array of agent PromptDefinition
 */
export function getAgentPrompts(): PromptDefinition[] {
  return defaultPromptRegistry.getByCategory('agent');
}

/**
 * Finds the first registered prompt matching a predicate.
 *
 * @param predicate Predicate callback
 * @returns PromptDefinition or undefined
 */
export function findPrompt(
  predicate: (prompt: PromptDefinition) => boolean
): PromptDefinition | undefined {
  return defaultPromptRegistry.find(predicate);
}

/**
 * Filters registered prompts matching a predicate.
 *
 * @param predicate Filter callback
 * @returns Array of PromptDefinition
 */
export function filterPrompts(
  predicate: (prompt: PromptDefinition) => boolean
): PromptDefinition[] {
  return defaultPromptRegistry.filter(predicate);
}

/**
 * Returns total count of registered prompts.
 *
 * @returns number
 */
export function countPrompts(): number {
  return defaultPromptRegistry.count();
}

/**
 * Clears all prompts in the default registry.
 *
 * @param options Optional clear options
 */
export function clearPrompts(options?: { syncToDisk?: boolean }): void {
  defaultPromptRegistry.clear(options);
}

/**
 * Resets the default registry to default baseline static prompts.
 *
 * @param options Optional reset options
 */
export function resetPromptsToDefaults(options?: { syncToDisk?: boolean }): void {
  defaultPromptRegistry.resetToDefaults(options);
}

/**
 * Renders a prompt template with variable interpolation.
 *
 * @param idOrPrompt Prompt ID or PromptDefinition
 * @param variables Key-value substitution map
 * @param strict If true, throws PromptRenderError on missing required variables
 * @returns Rendered template string
 */
export function renderPrompt(
  idOrPrompt: string | PromptDefinition,
  variables?: Record<string, string | number | boolean>,
  strict?: boolean
): string {
  return defaultPromptRegistry.renderPrompt(idOrPrompt, variables, strict);
}

/**
 * Standalone template interpolation function.
 *
 * @param template Raw template string with {{variable}} placeholders
 * @param options Render options (variables, strict)
 * @returns Interpolated string
 */
export function renderPromptTemplate(
  template: string,
  options?: Partial<PromptRenderOptions>
): string {
  return renderTemplate(template, options);
}

/**
 * Standalone variable extractor from template content.
 *
 * @param content Prompt template string
 * @returns Array of unique variable names
 */
export function extractPromptVariables(content: string): string[] {
  return extractVariables(content);
}

/**
 * Composes multiple prompts into a cohesive LLM prompt bundle using the default registry.
 *
 * @param options Composition options
 * @returns ComposedPromptResult
 */
export function composePrompts(options: PromptCompositionOptions): ComposedPromptResult {
  return defaultPromptRegistry.compose(options);
}

/**
 * Configures the default prompt registry service.
 *
 * @param config Configuration options
 * @returns Updated PromptRegistryConfig
 */
export function configurePromptRegistry(
  config: Partial<PromptRegistryConfig>
): PromptRegistryConfig {
  defaultPromptRegistry.configure(config);
  return defaultPromptRegistry.getConfig();
}

/**
 * Retrieves the current configuration of the default prompt registry.
 *
 * @returns PromptRegistryConfig
 */
export function getPromptRegistryConfig(): PromptRegistryConfig {
  return defaultPromptRegistry.getConfig();
}

/**
 * Loads prompt definitions from disk into the default registry.
 *
 * @param options Storage options
 * @returns Array of loaded PromptDefinition
 */
export function loadPromptRegistry(options?: PromptStorageOptions): PromptDefinition[] {
  defaultPromptRegistry.loadFromDisk(options);
  return defaultPromptRegistry.getAll();
}

/**
 * Saves current default registry prompts to disk.
 *
 * @param options Storage options
 * @returns File path written to
 */
export function savePromptRegistry(options?: PromptStorageOptions): string {
  return defaultPromptRegistry.saveToDisk(options);
}

/**
 * Synchronizes the default prompt registry with disk storage.
 *
 * @param options Storage options
 * @returns Consolidated PromptDefinition array
 */
export function syncPromptRegistry(options?: PromptStorageOptions): PromptDefinition[] {
  defaultPromptRegistry.syncWithDisk(options);
  return defaultPromptRegistry.getAll();
}

/**
 * Retrieves cache statistics from the default prompt registry.
 *
 * @returns PromptCacheStats
 */
export function getPromptCacheStats(): PromptCacheStats {
  return defaultPromptRegistry.getCacheStats();
}

/**
 * Clears the prompt composition cache.
 */
export function clearPromptCache(): void {
  defaultPromptRegistry.clearCache();
}

/**
 * Resets prompt cache metrics.
 */
export function resetPromptCacheStats(): void {
  defaultPromptRegistry.resetCacheStats();
}

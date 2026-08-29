import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import {
  PromptDefinitionSchema,
  PromptCompositionOptionsSchema,
} from './schema.js';
import {
  PromptNotFoundError,
  PromptAlreadyExistsError,
} from './errors.js';
import { STATIC_PROMPTS } from './static-prompts.js';
import { extractVariables, renderTemplate } from './renderer.js';
import { PromptCacheEngine } from './cache.js';
import type {
  PromptDefinition,
  PromptCompositionOptions,
  ComposedPromptResult,
  PromptCacheStats,
} from './types.js';

/**
 * Universal Prompt Registry Service for managing, querying, rendering, composing,
 * and caching prompts for agents and workflows.
 */
export class PromptRegistryService {
  private readonly registry: BaseRegistry<string, PromptDefinition>;
  private readonly cache = new PromptCacheEngine();

  constructor(initialPrompts?: Record<string, PromptDefinition>) {
    this.registry = new BaseRegistry<string, PromptDefinition>({
      name: 'PromptsRegistry',
      schema: PromptDefinitionSchema,
      keyExtractor: (p) => p.id,
    });

    const promptsToLoad = initialPrompts ?? STATIC_PROMPTS;
    for (const prompt of Object.values(promptsToLoad)) {
      this.registerPromptInternal(prompt);
    }
  }

  /**
   * Internal helper to register and validate a prompt without throwing duplicate error on initial load.
   */
  private registerPromptInternal(prompt: PromptDefinition): void {
    const validated = PromptDefinitionSchema.parse(prompt);
    // Auto-detect template variables if not explicitly provided
    if (!validated.variables || validated.variables.length === 0) {
      validated.variables = extractVariables(validated.content);
    }

    if (this.registry.has(validated.id)) {
      this.registry.unregister(validated.id);
    }
    this.registry.register(validated.id, validated);
  }

  /**
   * Registers a new prompt into the registry.
   * Throws PromptAlreadyExistsError if a prompt with the same ID is already registered.
   */
  register(prompt: PromptDefinition): this {
    const validated = PromptDefinitionSchema.parse(prompt);

    if (this.registry.has(validated.id)) {
      throw new PromptAlreadyExistsError(validated.id);
    }

    // Auto-detect variables from content if omitted
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
    return this;
  }

  /**
   * Registers or overwrites an existing prompt.
   */
  registerOrUpdate(prompt: PromptDefinition): this {
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
    return this;
  }

  /**
   * Registers multiple prompts at once.
   */
  registerMany(prompts: PromptDefinition[] | Record<string, PromptDefinition>): this {
    const list = Array.isArray(prompts) ? prompts : Object.values(prompts);
    for (const prompt of list) {
      this.register(prompt);
    }
    return this;
  }

  /**
   * Unregisters a prompt by ID.
   */
  unregister(id: string): boolean {
    const removed = this.registry.unregister(id);
    if (removed) {
      this.cache.clear();
      devInfo('PROMPT_REGISTRY', `Unregistered prompt '${id}'`);
    }
    return removed;
  }

  /**
   * Checks if a prompt exists by ID.
   */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * Retrieves a prompt by ID or throws PromptNotFoundError.
   */
  get(id: string): PromptDefinition {
    const prompt = this.registry.getOrNull(id);
    if (!prompt) {
      throw new PromptNotFoundError(id);
    }
    return prompt;
  }

  /**
   * Retrieves a prompt by ID or returns null if not found.
   */
  getOrNull(id: string): PromptDefinition | null {
    return this.registry.getOrNull(id);
  }

  /**
   * Retrieves all prompts belonging to a given category, sorted by priority.
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
   */
  getByTitle(title: string): PromptDefinition[] {
    const normalized = title.toLowerCase().trim();
    return this.registry
      .filter((p) => p.title.toLowerCase().trim() === normalized)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Retrieves prompts matching any (or all) of the specified tags.
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
   */
  getAll(): PromptDefinition[] {
    return this.registry.getAll().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Finds the first prompt matching a predicate function.
   */
  find(predicate: (prompt: PromptDefinition) => boolean): PromptDefinition | undefined {
    return this.registry.find(predicate);
  }

  /**
   * Filters registered prompts matching a predicate function, sorted by priority.
   */
  filter(predicate: (prompt: PromptDefinition) => boolean): PromptDefinition[] {
    return this.registry.filter(predicate).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Returns the count of registered prompts.
   */
  count(): number {
    return this.registry.count();
  }

  /**
   * Renders a single prompt template by ID or PromptDefinition, applying variable substitutions.
   */
  renderPrompt(
    idOrPrompt: string | PromptDefinition,
    variables: Record<string, string | number | boolean> = {},
    strict = false
  ): string {
    const prompt = typeof idOrPrompt === 'string' ? this.get(idOrPrompt) : idOrPrompt;
    return renderTemplate(prompt.content, { variables, strict });
  }

  /**
   * Composes multiple prompts into a cohesive system instructions block for workflows and LLM generation.
   */
  compose(options: PromptCompositionOptions): ComposedPromptResult {
    const validatedOptions = PromptCompositionOptionsSchema.parse(options);
    const useCache = validatedOptions.useCache !== false;
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

    const separator = validatedOptions.separator ?? '\n\n---\n\n';
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
      this.cache.set(cacheKey, result);
    }

    devDebug('PROMPT_REGISTRY', `Composed ${sortedPrompts.length} prompt(s) (Total chars: ${totalCharacters}, est. tokens: ${estimatedTokens})`);
    return result;
  }

  /**
   * Resets the registry to only contain the default static prompts.
   */
  resetToDefaults(): void {
    this.registry.clear();
    this.cache.clear();
    for (const prompt of Object.values(STATIC_PROMPTS)) {
      this.registerPromptInternal(prompt);
    }
    devInfo('PROMPT_REGISTRY', `Reset prompts registry to ${this.registry.count()} default static prompts`);
  }

  /**
   * Clears all registered prompts and cache.
   */
  clear(): void {
    this.registry.clear();
    this.cache.clear();
    devWarn('PROMPT_REGISTRY', 'Cleared all prompts from registry');
  }

  /**
   * Retrieves prompt cache statistics.
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
}

/** Global singleton instance of PromptRegistryService */
export const defaultPromptRegistry = new PromptRegistryService();

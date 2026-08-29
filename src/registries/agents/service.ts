import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/index.js';
import { registerAgentAuthor, getAgentAuthor } from '../../git/authors.js';
import type { GitAuthor } from '../../git/types.js';
import { defaultPromptRegistry, PromptRegistryService } from '../prompts/index.js';
import { STATIC_AGENTS } from './static-agents.js';
import {
  AgentDefinitionSchema,
  AgentQueryFilterSchema,
  AgentPromptCompositionOptionsSchema,
  AgentUpdateSchema,
  AgentStorageOptionsSchema,
} from './schema.js';
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  AgentValidationError,
  BuiltinAgentProtectionError,
} from './errors.js';
import {
  synthesizeAgentSystemPrompt,
  getEffectiveAgentTools,
  formatAgentIdentityHeader,
  formatAgentGitSignature,
} from './identity.js';
import {
  loadAgentRegistryFromDisk,
  saveAgentRegistryToDisk,
  syncAgentRegistryWithDisk,
  saveAgentToDisk,
  deleteAgentFromDisk,
} from './storage.js';
import type {
  AgentDefinition,
  AgentInput,
  AgentUpdateInput,
  AgentQueryFilter,
  AgentPromptCompositionOptions,
  CompiledAgentContext,
  AgentModelPreference,
  AgentStorageOptions,
  AgentRegistryMap,
} from './types.js';

/**
 * Universal Agent Registry Service for managing, querying, configuring,
 * and synthesizing LLM Agent identities, git authorship, prompt bindings,
 * and execution contexts.
 */
export class AgentRegistryService {
  private readonly registry: BaseRegistry<string, AgentDefinition>;
  private readonly staticAgentIds = new Set<string>();

  constructor(initialAgents?: Record<string, AgentDefinition>) {
    this.registry = new BaseRegistry<string, AgentDefinition>({
      name: 'AgentsRegistry',
      schema: AgentDefinitionSchema,
      keyExtractor: (a) => a.id,
    });

    const agentsToLoad = initialAgents ?? STATIC_AGENTS;
    for (const agent of Object.values(agentsToLoad)) {
      this.registerAgentInternal(agent, true);
    }
  }

  /**
   * Returns array of all registered agent IDs.
   */
  getRegisteredIds(): string[] {
    return this.registry.getAll().map((a) => a.id);
  }

  /**
   * Internal registration helper without duplicate throwing on initial static load.
   */
  private registerAgentInternal(agent: AgentDefinition | AgentInput, isBuiltin = false): AgentDefinition {
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (!parseResult.success) {
      throw new AgentValidationError((agent as any).id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;
    validated.isBuiltin = isBuiltin;

    if (this.registry.has(validated.id)) {
      this.registry.unregister(validated.id);
    }

    this.registry.register(validated.id, validated);
    if (isBuiltin) {
      this.staticAgentIds.add(validated.id);
    }

    // Synchronize Git author configuration
    if (validated.gitAuthor) {
      try {
        registerAgentAuthor(validated.id, validated.gitAuthor);
      } catch (err) {
        devWarn('AGENT_REGISTRY', `Failed to sync Git author for agent '${validated.id}': ${err}`);
      }
    }

    return { ...validated };
  }

  /**
   * Registers a new agent into the registry.
   * Throws AgentAlreadyExistsError if an agent with the same ID is already registered.
   */
  register(agent: AgentInput | AgentDefinition, options?: AgentStorageOptions): AgentDefinition {
    const opts = AgentStorageOptionsSchema.parse(options ?? {});
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (!parseResult.success) {
      throw new AgentValidationError((agent as any).id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;

    if (this.registry.has(validated.id)) {
      throw new AgentAlreadyExistsError(validated.id);
    }

    const now = new Date().toISOString();
    if (!validated.createdAt) {
      validated.createdAt = now;
    }
    validated.updatedAt = now;
    validated.isBuiltin = false;

    this.registry.register(validated.id, validated);

    // Register Git author in the Git subsystem
    if (validated.gitAuthor) {
      registerAgentAuthor(validated.id, validated.gitAuthor);
    }

    devInfo(
      'AGENT_REGISTRY',
      `Registered custom agent '${validated.id}' (${validated.title}) [category: ${validated.category}]`
    );

    if (opts.persist) {
      saveAgentToDisk(validated, {
        targetPath: opts.targetPath,
        projectRoot: opts.projectRoot,
      }).catch((err) => {
        devWarn('AGENT_REGISTRY', `Async persist failed for agent '${validated.id}': ${err.message}`);
      });
    }

    return { ...validated };
  }

  /**
   * Partially updates an existing agent definition.
   */
  update(
    agentId: string,
    updates: AgentUpdateInput,
    options?: AgentStorageOptions
  ): AgentDefinition {
    const opts = AgentStorageOptionsSchema.parse(options ?? {});
    const existing = this.get(agentId);

    if (existing.isBuiltin && !opts.force) {
      // Validate if mutation is allowed
      devWarn(
        'AGENT_REGISTRY',
        `Updating built-in agent '${agentId}' properties in memory.`
      );
    }

    const validatedUpdates = AgentUpdateSchema.parse(updates);
    const now = new Date().toISOString();

    const updated: AgentDefinition = {
      ...existing,
      ...validatedUpdates,
      id: existing.id, // ID is immutable
      isBuiltin: existing.isBuiltin,
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
      gitAuthor: validatedUpdates.gitAuthor ?? existing.gitAuthor,
      allowedTools: validatedUpdates.allowedTools ?? existing.allowedTools,
      disallowedTools: validatedUpdates.disallowedTools ?? existing.disallowedTools,
      capabilities: validatedUpdates.capabilities ?? existing.capabilities,
      defaultPrompts: validatedUpdates.defaultPrompts ?? existing.defaultPrompts,
      tags: validatedUpdates.tags ?? existing.tags,
    };

    // Validate final full object
    const finalParsed = AgentDefinitionSchema.safeParse(updated);
    if (!finalParsed.success) {
      throw new AgentValidationError(agentId, finalParsed.error.issues);
    }

    this.registry.unregister(agentId);
    this.registry.register(agentId, finalParsed.data);

    if (finalParsed.data.gitAuthor) {
      registerAgentAuthor(agentId, finalParsed.data.gitAuthor);
    }

    devInfo('AGENT_REGISTRY', `Updated agent '${agentId}' (${finalParsed.data.title})`);

    if (opts.persist) {
      saveAgentToDisk(finalParsed.data, {
        targetPath: opts.targetPath,
        projectRoot: opts.projectRoot,
      }).catch((err) => {
        devWarn('AGENT_REGISTRY', `Async persist failed for updated agent '${agentId}': ${err.message}`);
      });
    }

    return { ...finalParsed.data };
  }

  /**
   * Registers or updates an existing agent.
   */
  registerOrUpdate(
    agent: AgentInput | AgentDefinition,
    options?: AgentStorageOptions
  ): AgentDefinition {
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (!parseResult.success) {
      throw new AgentValidationError((agent as any).id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;
    const opts = AgentStorageOptionsSchema.parse(options ?? {});
    const now = new Date().toISOString();

    if (this.registry.has(validated.id)) {
      const existing = this.registry.get(validated.id);
      validated.createdAt = existing.createdAt ?? now;
      validated.isBuiltin = existing.isBuiltin ?? false;
      this.registry.unregister(validated.id);
      devInfo('AGENT_REGISTRY', `Updated existing agent '${validated.id}' (${validated.title})`);
    } else {
      validated.createdAt = now;
      validated.isBuiltin = false;
      devInfo('AGENT_REGISTRY', `Registered new agent '${validated.id}' (${validated.title})`);
    }

    validated.updatedAt = now;
    this.registry.register(validated.id, validated);

    if (validated.gitAuthor) {
      registerAgentAuthor(validated.id, validated.gitAuthor);
    }

    if (opts.persist) {
      saveAgentToDisk(validated, {
        targetPath: opts.targetPath,
        projectRoot: opts.projectRoot,
      }).catch((err) => {
        devWarn('AGENT_REGISTRY', `Async persist failed for agent '${validated.id}': ${err.message}`);
      });
    }

    return { ...validated };
  }

  /**
   * Retrieves an agent by its unique identifier.
   * Throws AgentNotFoundError if not found.
   */
  get(agentId: string): AgentDefinition {
    const agent = this.registry.getOrNull(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId, this.getRegisteredIds());
    }
    return { ...agent };
  }

  /**
   * Retrieves an agent by its unique identifier, or null if not found.
   */
  getOrNull(agentId: string): AgentDefinition | null {
    const agent = this.registry.getOrNull(agentId);
    return agent ? { ...agent } : null;
  }

  /**
   * Checks if an agent with the specified ID is registered.
   */
  has(agentId: string): boolean {
    return this.registry.has(agentId);
  }

  /**
   * Returns all registered agents.
   */
  getAll(): AgentDefinition[] {
    return this.registry.getAll().map((a) => ({ ...a }));
  }

  /**
   * Returns the count of registered agents.
   */
  count(): number {
    return this.registry.count();
  }

  /**
   * Retrieves all agents belonging to a specific functional category.
   */
  getByCategory(category: string): AgentDefinition[] {
    return this.registry
      .filter((agent) => agent.category.toLowerCase() === category.toLowerCase())
      .map((a) => ({ ...a }));
  }

  /**
   * Retrieves all agents associated with a specific tag.
   */
  getByTag(tag: string): AgentDefinition[] {
    const lower = tag.toLowerCase();
    return this.registry
      .filter((agent) => (agent.tags ?? []).some((t) => t.toLowerCase() === lower))
      .map((a) => ({ ...a }));
  }

  /**
   * Retrieves all agents declaring a specific capability token.
   */
  getByCapability(capability: string): AgentDefinition[] {
    const lower = capability.toLowerCase();
    return this.registry
      .filter((agent) =>
        (agent.capabilities ?? []).some((c) => c.toLowerCase() === lower)
      )
      .map((a) => ({ ...a }));
  }

  /**
   * Performs multi-criteria filtering and searching across registered agents.
   */
  query(filter: AgentQueryFilter): AgentDefinition[] {
    const validatedFilter = AgentQueryFilterSchema.parse(filter);

    return this.registry
      .filter((agent) => {
        // Active filter
        if (validatedFilter.activeOnly && !agent.active) {
          return false;
        }

        // Builtin filter
        if (
          validatedFilter.isBuiltin !== undefined &&
          agent.isBuiltin !== validatedFilter.isBuiltin
        ) {
          return false;
        }

        // Single Category
        if (
          validatedFilter.category &&
          agent.category.toLowerCase() !== validatedFilter.category.toLowerCase()
        ) {
          return false;
        }

        // Multiple Categories
        if (validatedFilter.categories && validatedFilter.categories.length > 0) {
          const catSet = new Set(validatedFilter.categories.map((c) => c.toLowerCase()));
          if (!catSet.has(agent.category.toLowerCase())) {
            return false;
          }
        }

        // Single Tag
        if (validatedFilter.tag) {
          const lowerTag = validatedFilter.tag.toLowerCase();
          if (!(agent.tags ?? []).some((t) => t.toLowerCase() === lowerTag)) {
            return false;
          }
        }

        // Multiple Tags (matches if agent has ANY of the specified tags)
        if (validatedFilter.tags && validatedFilter.tags.length > 0) {
          const tagSet = new Set(validatedFilter.tags.map((t) => t.toLowerCase()));
          const hasAnyTag = (agent.tags ?? []).some((t) => tagSet.has(t.toLowerCase()));
          if (!hasAnyTag) {
            return false;
          }
        }

        // Single Capability
        if (validatedFilter.capability) {
          const lowerCap = validatedFilter.capability.toLowerCase();
          if (!(agent.capabilities ?? []).some((c) => c.toLowerCase() === lowerCap)) {
            return false;
          }
        }

        // Multiple Capabilities (matches if agent has ANY of the specified capabilities)
        if (validatedFilter.capabilities && validatedFilter.capabilities.length > 0) {
          const capSet = new Set(validatedFilter.capabilities.map((c) => c.toLowerCase()));
          const hasAnyCap = (agent.capabilities ?? []).some((c) => capSet.has(c.toLowerCase()));
          if (!hasAnyCap) {
            return false;
          }
        }

        // Keyword Search
        if (validatedFilter.search) {
          const query = validatedFilter.search.toLowerCase();
          const matches =
            agent.id.toLowerCase().includes(query) ||
            agent.title.toLowerCase().includes(query) ||
            agent.description.toLowerCase().includes(query) ||
            agent.role.toLowerCase().includes(query) ||
            (agent.tags ?? []).some((t) => t.toLowerCase().includes(query));
          if (!matches) {
            return false;
          }
        }

        return true;
      })
      .map((a) => ({ ...a }));
  }

  /**
   * Resolves the GitAuthor identity for an agent.
   */
  getGitAuthor(agentId: string): GitAuthor {
    const agent = this.getOrNull(agentId);
    if (agent?.gitAuthor) {
      return { ...agent.gitAuthor };
    }
    return getAgentAuthor(agentId);
  }

  /**
   * Compiles complete execution context for an agent including synthesized system prompt,
   * resolved Git author, tool definitions, and preferred model parameters.
   */
  compileAgentContext(
    agentId: string,
    options: AgentPromptCompositionOptions = {},
    promptRegistry: PromptRegistryService = defaultPromptRegistry
  ): CompiledAgentContext {
    const agent = this.get(agentId);
    const validatedOptions = AgentPromptCompositionOptionsSchema.parse(options);

    devDebug(
      'AGENT_REGISTRY',
      `Compiling agent context for '${agent.id}' (${agent.title})`
    );

    // Collect all prompt IDs to resolve from the Prompts Registry
    const promptIdSet = new Set<string>();
    for (const pid of agent.defaultPrompts ?? []) {
      promptIdSet.add(pid);
    }
    for (const pid of validatedOptions.extraPrompts ?? []) {
      promptIdSet.add(pid);
    }

    const resolvedPromptContents: string[] = [];
    if (promptIdSet.size > 0 && promptRegistry) {
      for (const pid of promptIdSet) {
        const prompt = promptRegistry.getOrNull(pid);
        if (prompt) {
          const renderedContent = promptRegistry.renderPrompt(pid, validatedOptions.variables, false);
          resolvedPromptContents.push(`### ${prompt.title} (${prompt.id})\n${renderedContent}`);
        } else {
          devWarn('AGENT_REGISTRY', `Prompt '${pid}' declared by agent '${agent.id}' was not found in PromptRegistry`);
        }
      }
    }

    // Synthesize full system prompt
    const systemPrompt = synthesizeAgentSystemPrompt(
      agent,
      resolvedPromptContents,
      validatedOptions
    );

    const gitAuthor = agent.gitAuthor ?? this.getGitAuthor(agent.id);
    const allowedTools = getEffectiveAgentTools(agent);
    const disallowedTools = agent.disallowedTools ?? [];

    return {
      agent,
      systemPrompt,
      gitAuthor,
      allowedTools,
      disallowedTools,
      preferredModel: agent.preferredModel,
      compiledAt: new Date().toISOString(),
    };
  }

  /**
   * Unregisters an agent. By default, prevents removing built-in static agents unless force: true.
   */
  unregister(agentId: string, options?: AgentStorageOptions): boolean {
    const opts = AgentStorageOptionsSchema.parse(options ?? {});

    if (this.staticAgentIds.has(agentId) && !opts.force) {
      throw new AgentValidationError(
        agentId,
        `Cannot unregister built-in static agent '${agentId}'`
      );
    }

    const removed = this.registry.unregister(agentId);
    if (removed) {
      devInfo('AGENT_REGISTRY', `Unregistered agent '${agentId}'`);
      if (opts.persist) {
        deleteAgentFromDisk(agentId, {
          targetPath: opts.targetPath,
          projectRoot: opts.projectRoot,
        }).catch((err) => {
          devWarn('AGENT_REGISTRY', `Async delete from disk failed for agent '${agentId}': ${err.message}`);
        });
      }
    }
    return removed;
  }

  /**
   * Clears all custom agent registrations and resets back to built-in static agents.
   */
  clearCustom(options?: AgentStorageOptions): void {
    const opts = AgentStorageOptionsSchema.parse(options ?? {});
    const allAgents = this.registry.getAll();
    for (const agent of allAgents) {
      if (!this.staticAgentIds.has(agent.id)) {
        this.registry.unregister(agent.id);
      }
    }
    devInfo('AGENT_REGISTRY', 'Cleared all custom agent registrations');

    if (opts.persist) {
      this.saveToDisk(opts).catch((err) => {
        devWarn('AGENT_REGISTRY', `Async saveToDisk failed after clearCustom: ${err.message}`);
      });
    }
  }

  /**
   * Resets registry back to initial baseline STATIC_AGENTS.
   */
  reset(options?: AgentStorageOptions): void {
    this.registry.clear();
    this.staticAgentIds.clear();
    for (const agent of Object.values(STATIC_AGENTS)) {
      this.registerAgentInternal(agent, true);
    }
    devInfo('AGENT_REGISTRY', 'Reset agents registry to baseline static defaults');

    const opts = AgentStorageOptionsSchema.parse(options ?? {});
    if (opts.persist) {
      saveAgentRegistryToDisk(STATIC_AGENTS, opts).catch((err) => {
        devWarn('AGENT_REGISTRY', `Async saveAgentRegistryToDisk failed after reset: ${err.message}`);
      });
    }
  }

  /**
   * Loads agents from `.hurdler/registries/agents.json` into memory.
   */
  async loadFromDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const diskAgents = await loadAgentRegistryFromDisk(options);
    if (diskAgents) {
      for (const agent of Object.values(diskAgents)) {
        const isBuiltin = agent.id in STATIC_AGENTS;
        this.registerAgentInternal(agent, isBuiltin);
      }
    }
  }

  /**
   * Saves current in-memory agents to `.hurdler/registries/agents.json`.
   */
  async saveToDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const current = this.registry.getAll();
    await saveAgentRegistryToDisk(current, options);
  }

  /**
   * Synchronizes in-memory registry with `.hurdler/registries/agents.json`.
   */
  async syncWithDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<AgentRegistryMap> {
    const merged = await syncAgentRegistryWithDisk(options);
    for (const agent of Object.values(merged)) {
      const isBuiltin = agent.id in STATIC_AGENTS;
      this.registerAgentInternal(agent, isBuiltin);
    }
    return merged;
  }
}

/**
 * Global default singleton instance of the Agent Registry Service.
 */
export const defaultAgentRegistry = new AgentRegistryService();

// ============================================================================
// STANDALONE FUNCTIONAL API (Function-First Architecture)
// ============================================================================

/**
 * Retrieves an agent definition by its unique identifier.
 *
 * @param agentId - Unique agent identifier (e.g. 'orchestrator', 'business-logic').
 * @returns Defensive copy of AgentDefinition.
 * @throws {AgentNotFoundError} If agent ID is not registered.
 *
 * @example
 * ```typescript
 * const agent = getAgent('business-logic');
 * console.log(agent.title, agent.gitAuthor.name);
 * ```
 */
export function getAgent(agentId: string): AgentDefinition {
  return defaultAgentRegistry.get(agentId);
}

/**
 * Retrieves an agent definition by ID, or returns null if not found.
 *
 * @param agentId - Unique agent identifier.
 * @returns AgentDefinition or null.
 */
export function getAgentOrNull(agentId: string): AgentDefinition | null {
  return defaultAgentRegistry.getOrNull(agentId);
}

/**
 * Checks whether an agent with the given ID exists in the registry.
 *
 * @param agentId - Unique agent identifier.
 * @returns True if registered, false otherwise.
 */
export function hasAgent(agentId: string): boolean {
  return defaultAgentRegistry.has(agentId);
}

/**
 * Lists all registered agents, optionally filtered by search criteria.
 *
 * @param filter - Optional query filter options.
 * @returns Array of matching AgentDefinitions.
 */
export function listAgents(filter?: AgentQueryFilter): AgentDefinition[] {
  return filter ? defaultAgentRegistry.query(filter) : defaultAgentRegistry.getAll();
}

/**
 * Registers a new agent into the registry.
 *
 * @param agent - Complete or partial agent input definition.
 * @param options - Optional persistence settings.
 * @returns Created AgentDefinition.
 * @throws {AgentAlreadyExistsError} If agent ID already exists.
 * @throws {AgentValidationError} If schema validation fails.
 */
export function registerAgent(
  agent: AgentInput | AgentDefinition,
  options?: AgentStorageOptions
): AgentDefinition {
  return defaultAgentRegistry.register(agent, options);
}

/**
 * Updates an existing registered agent.
 *
 * @param agentId - ID of agent to update.
 * @param updates - Partial agent properties to update.
 * @param options - Optional persistence settings.
 * @returns Updated AgentDefinition.
 * @throws {AgentNotFoundError} If agent does not exist.
 * @throws {AgentValidationError} If updated payload is invalid.
 */
export function updateAgent(
  agentId: string,
  updates: AgentUpdateInput,
  options?: AgentStorageOptions
): AgentDefinition {
  return defaultAgentRegistry.update(agentId, updates, options);
}

/**
 * Upserts an agent (registers if new, updates if existing).
 *
 * @param agent - Agent definition payload.
 * @param options - Optional persistence settings.
 * @returns Registered or updated AgentDefinition.
 */
export function registerOrUpdateAgent(
  agent: AgentInput | AgentDefinition,
  options?: AgentStorageOptions
): AgentDefinition {
  return defaultAgentRegistry.registerOrUpdate(agent, options);
}

/**
 * Unregisters an agent from the registry.
 *
 * @param agentId - ID of agent to remove.
 * @param options - Optional persistence and force overrides.
 * @returns True if removed, false if not found.
 * @throws {BuiltinAgentProtectionError} If attempting to remove built-in agent without force: true.
 */
export function unregisterAgent(
  agentId: string,
  options?: AgentStorageOptions
): boolean {
  return defaultAgentRegistry.unregister(agentId, options);
}

/**
 * Clears all custom agent registrations and resets registry to static defaults.
 *
 * @param options - Optional persistence settings.
 */
export function clearCustomAgents(options?: AgentStorageOptions): void {
  defaultAgentRegistry.clearCustom(options);
}

/**
 * Resets the entire agent registry to baseline static agents.
 *
 * @param options - Optional persistence settings.
 */
export function resetAgentRegistry(options?: AgentStorageOptions): void {
  defaultAgentRegistry.reset(options);
}

/**
 * Retrieves all agents in a specific domain category.
 *
 * @param category - Category name (e.g. 'engineering', 'design', 'qa', 'security').
 * @returns Array of AgentDefinitions.
 */
export function getAgentsByCategory(category: string): AgentDefinition[] {
  return defaultAgentRegistry.getByCategory(category);
}

/**
 * Retrieves all agents possessing a specific tag.
 *
 * @param tag - Tag string (e.g. 'playwright', 'testing', 'database').
 * @returns Array of AgentDefinitions.
 */
export function getAgentsByTag(tag: string): AgentDefinition[] {
  return defaultAgentRegistry.getByTag(tag);
}

/**
 * Retrieves all agents declaring a specific capability token.
 *
 * @param capability - Capability token (e.g. 'task:decompose', 'file:write', 'security:audit').
 * @returns Array of AgentDefinitions.
 */
export function getAgentsByCapability(capability: string): AgentDefinition[] {
  return defaultAgentRegistry.getByCapability(capability);
}

/**
 * Queries agents matching multi-criteria filter options.
 *
 * @param filter - Criteria including categories, tags, capabilities, search keyword, activeOnly.
 * @returns Array of matching AgentDefinitions.
 */
export function queryAgents(filter: AgentQueryFilter): AgentDefinition[] {
  return defaultAgentRegistry.query(filter);
}

/**
 * Returns total count of registered agents.
 */
export function countAgents(): number {
  return defaultAgentRegistry.count();
}

/**
 * Returns all active agents currently eligible for execution.
 */
export function getActiveAgents(): AgentDefinition[] {
  return defaultAgentRegistry.query({ activeOnly: true });
}

/**
 * Returns all built-in static default agents.
 */
export function getBuiltinAgents(): AgentDefinition[] {
  return defaultAgentRegistry.query({ isBuiltin: true });
}

/**
 * Returns all user-registered custom agents.
 */
export function getCustomAgents(): AgentDefinition[] {
  return defaultAgentRegistry.query({ isBuiltin: false });
}

/**
 * Resolves the GitAuthor identity for an agent ID.
 *
 * @param agentId - Unique agent identifier.
 * @returns Validated GitAuthor object.
 */
export function getAgentGitAuthor(agentId: string): GitAuthor {
  return defaultAgentRegistry.getGitAuthor(agentId);
}

/**
 * Validates and instantiates a clean AgentDefinition with defaults applied.
 *
 * @param input - Agent input properties.
 * @returns Validated AgentDefinition.
 */
export function createAgentDefinition(input: AgentInput): AgentDefinition {
  return AgentDefinitionSchema.parse(input);
}

/**
 * Compiles only the synthesized system prompt string for an agent.
 *
 * @param agentId - Unique agent identifier.
 * @param options - Prompt composition and variable substitution options.
 * @param promptRegistry - Optional prompt registry instance.
 * @returns Synthesized system prompt string.
 */
export function compileAgentPrompt(
  agentId: string,
  options?: AgentPromptCompositionOptions,
  promptRegistry: PromptRegistryService = defaultPromptRegistry
): string {
  const context = defaultAgentRegistry.compileAgentContext(agentId, options, promptRegistry);
  return context.systemPrompt;
}

/**
 * Compiles complete execution context for an agent invocation.
 *
 * @param agentId - Unique agent identifier.
 * @param options - Composition options.
 * @param promptRegistry - Optional prompt registry instance.
 * @returns Complete CompiledAgentContext ready for LLM call.
 */
export function compileAgentContext(
  agentId: string,
  options?: AgentPromptCompositionOptions,
  promptRegistry: PromptRegistryService = defaultPromptRegistry
): CompiledAgentContext {
  return defaultAgentRegistry.compileAgentContext(agentId, options, promptRegistry);
}

/**
 * Returns preferred LLM model options for an agent if configured.
 *
 * @param agentId - Unique agent identifier.
 * @returns AgentModelPreference or undefined.
 */
export function getAgentModelPreference(agentId: string): AgentModelPreference | undefined {
  const agent = defaultAgentRegistry.get(agentId);
  return agent.preferredModel;
}

/**
 * Checks whether an agent declares a specific capability token.
 *
 * @param agentId - Unique agent identifier.
 * @param capability - Capability token (e.g. 'code:lint', 'test:run').
 * @returns True if agent has capability, false otherwise.
 */
export function isAgentCapableOf(agentId: string, capability: string): boolean {
  const agent = defaultAgentRegistry.get(agentId);
  const lower = capability.toLowerCase();
  return (agent.capabilities ?? []).some((c) => c.toLowerCase() === lower);
}

/**
 * Checks whether a tool is allowed for a given agent.
 *
 * @param agentId - Unique agent identifier.
 * @param toolName - Name of tool to test.
 * @param allKnownToolNames - Optional list of all tools in tool registry.
 * @returns True if tool is permitted, false if restricted.
 */
export function isToolAllowedForAgent(
  agentId: string,
  toolName: string,
  allKnownToolNames: string[] = []
): boolean {
  const agent = defaultAgentRegistry.get(agentId);
  const effectiveTools = getEffectiveAgentTools(agent, allKnownToolNames);
  if (effectiveTools.includes('*')) {
    return !(agent.disallowedTools ?? []).includes(toolName);
  }
  return effectiveTools.includes(toolName);
}

/**
 * High-level ease-of-use helper that bundles everything needed to invoke an LLM for an agent task.
 *
 * @param agentId - Unique agent identifier.
 * @param userTask - Main user request or objective.
 * @param extraInstructions - Optional additional inline constraints.
 * @param promptRegistry - Optional prompt registry instance.
 * @returns Execution payload bundling system prompt, git author, allowed tools, and model preferences.
 */
export function createAgentExecutionPayload(
  agentId: string,
  userTask: string,
  extraInstructions?: string,
  promptRegistry: PromptRegistryService = defaultPromptRegistry
): {
  systemPrompt: string;
  gitAuthor: GitAuthor;
  allowedTools: string[];
  disallowedTools: string[];
  preferredModel?: AgentModelPreference;
  agent: AgentDefinition;
} {
  const context = defaultAgentRegistry.compileAgentContext(
    agentId,
    {
      userPrompt: userTask,
      extraInstructions,
    },
    promptRegistry
  );

  return {
    systemPrompt: context.systemPrompt,
    gitAuthor: context.gitAuthor,
    allowedTools: context.allowedTools,
    disallowedTools: context.disallowedTools,
    preferredModel: context.preferredModel,
    agent: context.agent,
  };
}

/**
 * Loads agents from `.hurdler/registries/agents.json` into memory.
 */
export async function loadAgentRegistry(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  return defaultAgentRegistry.loadFromDisk(options);
}

/**
 * Saves current in-memory agents to `.hurdler/registries/agents.json`.
 */
export async function saveAgentRegistry(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  return defaultAgentRegistry.saveToDisk(options);
}

/**
 * Synchronizes in-memory agents registry with disk.
 */
export async function syncAgentRegistry(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<AgentRegistryMap> {
  return defaultAgentRegistry.syncWithDisk(options);
}

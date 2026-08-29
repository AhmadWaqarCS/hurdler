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
} from './schema.js';
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  AgentValidationError,
} from './errors.js';
import { synthesizeAgentSystemPrompt, getEffectiveAgentTools } from './identity.js';
import type {
  AgentDefinition,
  AgentQueryFilter,
  AgentPromptCompositionOptions,
  CompiledAgentContext,
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
   * Internal registration helper without duplicate throwing on initial static load.
   */
  private registerAgentInternal(agent: AgentDefinition, isBuiltin = false): void {
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (!parseResult.success) {
      throw new AgentValidationError(agent.id ?? 'unknown', parseResult.error.issues);
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
  }

  /**
   * Registers a new agent into the registry.
   * Throws AgentAlreadyExistsError if an agent with the same ID is already registered.
   */
  register(agent: AgentDefinition): this {
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (!parseResult.success) {
      throw new AgentValidationError(agent.id ?? 'unknown', parseResult.error.issues);
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
    return this;
  }

  /**
   * Registers or updates an existing agent.
   */
  registerOrUpdate(agent: AgentDefinition): this {
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (!parseResult.success) {
      throw new AgentValidationError(agent.id ?? 'unknown', parseResult.error.issues);
    }

    const validated = parseResult.data;
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

    return this;
  }

  /**
   * Retrieves an agent by its unique identifier.
   * Throws AgentNotFoundError if not found.
   */
  get(agentId: string): AgentDefinition {
    const agent = this.registry.getOrNull(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId);
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
   * Unregisters a custom agent. Cannot unregister built-in static agents.
   */
  unregister(agentId: string): boolean {
    if (this.staticAgentIds.has(agentId)) {
      throw new AgentValidationError(
        agentId,
        `Cannot unregister built-in static agent '${agentId}'`
      );
    }

    const removed = this.registry.unregister(agentId);
    if (removed) {
      devInfo('AGENT_REGISTRY', `Unregistered custom agent '${agentId}'`);
    }
    return removed;
  }

  /**
   * Clears all custom agent registrations and resets back to built-in static agents.
   */
  clearCustom(): void {
    const allAgents = this.registry.getAll();
    for (const agent of allAgents) {
      if (!this.staticAgentIds.has(agent.id)) {
        this.registry.unregister(agent.id);
      }
    }
    devInfo('AGENT_REGISTRY', 'Cleared all custom agent registrations');
  }
}

/**
 * Global default instance of the Agent Registry Service.
 */
export const defaultAgentRegistry = new AgentRegistryService();

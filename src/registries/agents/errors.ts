import { HurdlerError } from '../../core/errors/base-error.js';

/**
 * Base error class for all agent registry subsystem failures.
 */
export class AgentRegistryError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: 'AGENT_REGISTRY_ERROR',
      details,
    });
  }
}

/**
 * Thrown when an agent lookup fails for a given agent ID.
 */
export class AgentNotFoundError extends HurdlerError {
  constructor(agentId: string, availableAgentIds?: string[]) {
    const listHint =
      availableAgentIds && availableAgentIds.length > 0
        ? ` Available registered agents: [${availableAgentIds.join(', ')}].`
        : '';
    super(`Agent with ID '${agentId}' was not found in the agents registry.${listHint}`, {
      code: 'AGENT_NOT_FOUND',
      details: { agentId, availableAgentIds },
    });
  }
}

/**
 * Thrown when attempting to register an agent whose ID already exists in the registry.
 */
export class AgentAlreadyExistsError extends HurdlerError {
  constructor(agentId: string) {
    super(
      `Agent with ID '${agentId}' already exists in the agents registry. Use 'updateAgent()' or 'registerOrUpdate()' to modify existing agent records.`,
      {
        code: 'AGENT_ALREADY_EXISTS',
        details: { agentId },
      }
    );
  }
}

/**
 * Thrown when agent definition data fails schema validation.
 */
export class AgentValidationError extends HurdlerError {
  constructor(agentId: string, issues: unknown) {
    super(`Validation failed for agent '${agentId}': ${typeof issues === 'string' ? issues : JSON.stringify(issues)}`, {
      code: 'AGENT_VALIDATION_ERROR',
      details: { agentId, issues },
    });
  }
}

/**
 * Thrown when synthesizing an agent system prompt, resolving prompt dependencies, or compiling execution context fails.
 */
export class AgentCompositionError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Agent composition failed: ${message}`, {
      code: 'AGENT_COMPOSITION_ERROR',
      details,
    });
  }
}

/**
 * Thrown when an error occurs reading, writing, validating, or syncing the persisted agents JSON file.
 */
export class AgentStorageError extends HurdlerError {
  constructor(
    filePath: string,
    operation: 'read' | 'write' | 'validate' | 'delete',
    message: string,
    cause?: unknown
  ) {
    super(`Failed to ${operation} agents registry at '${filePath}': ${message}`, {
      code: 'AGENT_STORAGE_ERROR',
      details: { filePath, operation },
      cause,
    });
  }
}

/**
 * Thrown when an unregister or destructive mutation attempt is made against a built-in static agent without explicit force.
 */
export class BuiltinAgentProtectionError extends HurdlerError {
  constructor(agentId: string, operation = 'unregister') {
    super(
      `Cannot ${operation} protected built-in static agent '${agentId}'. Built-in agents provide foundational capabilities for the platform. Pass 'force: true' to override if explicitly desired.`,
      {
        code: 'BUILTIN_AGENT_PROTECTION_ERROR',
        details: { agentId, operation },
      }
    );
  }
}


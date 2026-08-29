import { HurdlerError } from '../../core/errors/base-error.js';

export class AgentRegistryError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: 'AGENT_REGISTRY_ERROR',
      details,
    });
  }
}

export class AgentNotFoundError extends HurdlerError {
  constructor(agentId: string) {
    super(`Agent with ID '${agentId}' was not found in the agents registry.`, {
      code: 'AGENT_NOT_FOUND',
      details: { agentId },
    });
  }
}

export class AgentAlreadyExistsError extends HurdlerError {
  constructor(agentId: string) {
    super(`Agent with ID '${agentId}' already exists in the agents registry.`, {
      code: 'AGENT_ALREADY_EXISTS',
      details: { agentId },
    });
  }
}

export class AgentValidationError extends HurdlerError {
  constructor(agentId: string, issues: unknown) {
    super(`Validation failed for agent '${agentId}': ${JSON.stringify(issues)}`, {
      code: 'AGENT_VALIDATION_ERROR',
      details: { agentId, issues },
    });
  }
}

export class AgentCompositionError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Agent composition failed: ${message}`, {
      code: 'AGENT_COMPOSITION_ERROR',
      details,
    });
  }
}

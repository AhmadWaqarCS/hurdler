import { HurdlerError } from '../../core/errors/base-error.js';

export class LLMEngineError extends HurdlerError {
  constructor(message: string, options: { code?: string; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, {
      code: options.code ?? 'LLM_ENGINE_ERROR',
      details: options.details,
      cause: options.cause,
    });
  }
}

export class LLMExecutionError extends LLMEngineError {
  constructor(providerId: string, modelId: string, message: string, cause?: unknown) {
    super(`Execution failed for LLM model '${modelId}' (Provider: '${providerId}'): ${message}`, {
      code: 'LLM_EXECUTION_ERROR',
      details: { providerId, modelId },
      cause,
    });
  }
}

export class LLMValidationError extends LLMEngineError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`LLM input validation error: ${message}`, {
      code: 'LLM_VALIDATION_ERROR',
      details,
    });
  }
}

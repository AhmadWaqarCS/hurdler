import { HurdlerError } from '../../core/errors/base-error.js';

export class PromptNotFoundError extends HurdlerError {
  constructor(promptId: string) {
    super(`Prompt with ID '${promptId}' was not found in the prompts registry.`, {
      code: 'PROMPT_NOT_FOUND',
      details: { promptId },
    });
  }
}

export class PromptAlreadyExistsError extends HurdlerError {
  constructor(promptId: string) {
    super(`Prompt with ID '${promptId}' already exists in the prompts registry.`, {
      code: 'PROMPT_ALREADY_EXISTS',
      details: { promptId },
    });
  }
}

export class PromptValidationError extends HurdlerError {
  constructor(promptId: string, issues: unknown) {
    super(`Validation failed for prompt '${promptId}': ${JSON.stringify(issues)}`, {
      code: 'PROMPT_VALIDATION_ERROR',
      details: { promptId, issues },
    });
  }
}

export class PromptRenderError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Prompt rendering failed: ${message}`, {
      code: 'PROMPT_RENDER_ERROR',
      details,
    });
  }
}

export class PromptCompositionError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Prompt composition failed: ${message}`, {
      code: 'PROMPT_COMPOSITION_ERROR',
      details,
    });
  }
}

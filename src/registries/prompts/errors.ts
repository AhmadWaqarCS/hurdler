import { HurdlerError } from '../../core/errors/base-error.js';

/**
 * Thrown when a requested prompt ID is not found in the Prompts registry.
 */
export class PromptNotFoundError extends HurdlerError {
  constructor(promptId: string, availableSuggestions?: string[]) {
    const hint =
      availableSuggestions && availableSuggestions.length > 0
        ? ` Available prompts: ${availableSuggestions.slice(0, 5).join(', ')}${availableSuggestions.length > 5 ? ` (and ${availableSuggestions.length - 5} more)` : ''}.`
        : '';
    super(
      `Prompt with ID '${promptId}' was not found in the prompts registry.${hint} Use 'listPrompts()' to view registered prompts or 'registerPrompt()' to add it.`,
      {
        code: 'PROMPT_NOT_FOUND',
        details: { promptId, availableSuggestions },
      }
    );
  }
}

/**
 * Thrown when attempting to register a prompt with an ID that already exists.
 */
export class PromptAlreadyExistsError extends HurdlerError {
  constructor(promptId: string) {
    super(
      `Prompt with ID '${promptId}' already exists in the prompts registry. Use 'updatePrompt()' or 'registerOrUpdatePrompt()' to modify an existing prompt definition.`,
      {
        code: 'PROMPT_ALREADY_EXISTS',
        details: { promptId },
      }
    );
  }
}

/**
 * Thrown when a prompt definition fails Zod schema validation.
 */
export class PromptValidationError extends HurdlerError {
  constructor(promptId: string, issues: unknown) {
    super(
      `Validation failed for prompt '${promptId}': ${JSON.stringify(issues)}. Please ensure all required fields (id, title, content) conform to PromptDefinitionSchema.`,
      {
        code: 'PROMPT_VALIDATION_ERROR',
        details: { promptId, issues },
      }
    );
  }
}

/**
 * Thrown when template variable rendering fails (e.g. strict mode with missing variable).
 */
export class PromptRenderError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      `Prompt rendering failed: ${message}. Provide the missing context variables or use default fallbacks like {{variable | "defaultValue"}}.`,
      {
        code: 'PROMPT_RENDER_ERROR',
        details,
      }
    );
  }
}

/**
 * Thrown when prompt aggregation or composition fails.
 */
export class PromptCompositionError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Prompt composition failed: ${message}`, {
      code: 'PROMPT_COMPOSITION_ERROR',
      details,
    });
  }
}

/**
 * Thrown when reading or writing prompts to the disk store fails.
 */
export class PromptStorageError extends HurdlerError {
  constructor(action: 'read' | 'write' | 'sync', filePath: string, cause?: unknown) {
    super(
      `Failed to ${action} prompts registry at '${filePath}'. Ensure directory permissions and valid JSON format.`,
      {
        code: 'PROMPT_STORAGE_ERROR',
        cause,
        details: { action, filePath },
      }
    );
  }
}

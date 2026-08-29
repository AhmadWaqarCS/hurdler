/**
 * Hurdler CLI Subsystem - Error Classes
 */

import { HurdlerError, type HurdlerErrorOptions } from '../core/errors/base-error.js';

export class CliError extends HurdlerError {
  constructor(message: string, options: HurdlerErrorOptions = {}) {
    super(message, {
      code: options.code ?? 'CLI_ERROR',
      ...options,
    });
  }
}

export class CommandNotFoundError extends CliError {
  constructor(command: string, suggestion?: string) {
    super(`Unknown command: '${command}'`, {
      code: 'COMMAND_NOT_FOUND',
      details: { command },
      suggestion: suggestion ?? `Run 'hurdler --help' to view available commands.`,
    });
  }
}

export class InvalidArgumentError extends CliError {
  constructor(argumentName: string, reason: string, suggestion?: string) {
    super(`Invalid argument '${argumentName}': ${reason}`, {
      code: 'INVALID_ARGUMENT',
      details: { argumentName, reason },
      suggestion,
    });
  }
}

export class MissingRequiredOptionError extends CliError {
  constructor(optionName: string, usage?: string) {
    super(`Missing required option: '--${optionName}'`, {
      code: 'MISSING_REQUIRED_OPTION',
      details: { optionName },
      suggestion: usage ? `Usage: ${usage}` : `Provide '--${optionName}' with a valid value.`,
    });
  }
}

export class SubsystemExecutionError extends CliError {
  constructor(subsystem: string, error: unknown, suggestion?: string) {
    const message = error instanceof Error ? error.message : String(error);
    super(`Subsystem '${subsystem}' failed: ${message}`, {
      code: 'SUBSYSTEM_EXECUTION_ERROR',
      cause: error,
      details: { subsystem, originalError: message },
      suggestion,
    });
  }
}

export interface HurdlerErrorOptions {
  code?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
}

/**
 * Base error class for all Hurdler errors.
 */
export class HurdlerError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: HurdlerErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code ?? 'HURDLER_ERROR';
    this.details = options.details;

    // Maintain proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

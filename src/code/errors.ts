import { HurdlerError, type HurdlerErrorOptions } from '../core/errors/base-error.js';

export interface CodeErrorOptions extends HurdlerErrorOptions {
  filePath?: string;
  line?: number;
  column?: number;
  ruleId?: string;
  sourceCodeSnippet?: string;
}

/**
 * Base error class for all code analysis, formatting, and AST errors.
 */
export class CodeError extends HurdlerError {
  readonly filePath?: string;
  readonly line?: number;
  readonly column?: number;
  readonly ruleId?: string;
  readonly sourceCodeSnippet?: string;

  constructor(message: string, options: CodeErrorOptions = {}) {
    super(message, {
      code: options.code ?? 'CODE_ERROR',
      cause: options.cause,
      details: {
        ...options.details,
        filePath: options.filePath,
        line: options.line,
        column: options.column,
        ruleId: options.ruleId,
      },
    });

    this.filePath = options.filePath;
    this.line = options.line;
    this.column = options.column;
    this.ruleId = options.ruleId;
    this.sourceCodeSnippet = options.sourceCodeSnippet;
  }
}

/**
 * Error thrown during code linting operations.
 */
export class LintError extends CodeError {
  constructor(message: string, options: CodeErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'LINT_ERROR',
    });
  }
}

/**
 * Error thrown during code prettification / formatting operations.
 */
export class PrettierError extends CodeError {
  constructor(message: string, options: CodeErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'PRETTIER_ERROR',
    });
  }
}

/**
 * Error thrown during AST generation, symbol extraction, or tree-sitter parsing.
 */
export class ASTError extends CodeError {
  constructor(message: string, options: CodeErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'AST_ERROR',
    });
  }
}

/**
 * Error thrown when input parameters or schemas fail validation.
 */
export class CodeValidationError extends CodeError {
  constructor(message: string, options: CodeErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'CODE_VALIDATION_ERROR',
    });
  }
}

/**
 * Error thrown on unauthorized path access or directory traversal attempts.
 */
export class CodeSecurityError extends CodeError {
  constructor(message: string, options: CodeErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'CODE_SECURITY_ERROR',
    });
  }
}

import { HurdlerError } from '../../core/errors/base-error.js';

export class ToolNotFoundError extends HurdlerError {
  constructor(toolName: string) {
    super(`Tool '${toolName}' was not found in the tools registry.`, {
      code: 'TOOL_NOT_FOUND',
      details: { toolName },
    });
  }
}

export class ToolAlreadyExistsError extends HurdlerError {
  constructor(toolName: string) {
    super(`Tool '${toolName}' is already registered in the tools registry.`, {
      code: 'TOOL_ALREADY_EXISTS',
      details: { toolName },
    });
  }
}

export class ToolValidationError extends HurdlerError {
  constructor(toolName: string, issues: unknown) {
    super(`Validation failed for tool '${toolName}': ${JSON.stringify(issues)}`, {
      code: 'TOOL_VALIDATION_ERROR',
      details: { toolName, issues },
    });
  }
}

export class ToolExecutionError extends HurdlerError {
  constructor(toolName: string, message: string, cause?: unknown, details?: Record<string, unknown>) {
    super(`Execution of tool '${toolName}' failed: ${message}`, {
      code: 'TOOL_EXECUTION_ERROR',
      cause,
      details: { toolName, ...details },
    });
  }
}

export class PathSecurityError extends HurdlerError {
  constructor(attemptedPath: string, workspaceRoot: string, reason?: string) {
    super(
      `Access denied: Path '${attemptedPath}' is outside the authorized workspace root '${workspaceRoot}'.${reason ? ` Reason: ${reason}` : ''}`,
      {
        code: 'PATH_SECURITY_ERROR',
        details: { attemptedPath, workspaceRoot, reason },
      }
    );
  }
}

export class FileOperationError extends HurdlerError {
  constructor(operation: string, filePath: string, message: string, cause?: unknown) {
    super(`File operation '${operation}' failed for '${filePath}': ${message}`, {
      code: 'FILE_OPERATION_ERROR',
      cause,
      details: { operation, filePath },
    });
  }
}

import { HurdlerError } from '../../core/errors/base-error.js';

export class ModuleNotFoundError extends HurdlerError {
  constructor(moduleName: string) {
    super(`Module '${moduleName}' was not found in the modules registry.`, {
      code: 'MODULE_NOT_FOUND',
      details: { moduleName },
    });
  }
}

export class DuplicateModuleError extends HurdlerError {
  constructor(moduleName: string) {
    super(`Module '${moduleName}' is already registered in the modules registry.`, {
      code: 'DUPLICATE_MODULE',
      details: { moduleName },
    });
  }
}

export class InvalidModuleDefinitionError extends HurdlerError {
  constructor(moduleName: string, issues: unknown) {
    super(`Validation failed for module '${moduleName}': ${JSON.stringify(issues)}`, {
      code: 'INVALID_MODULE_DEFINITION',
      details: { moduleName, issues },
    });
  }
}

export class ModuleCompatibilityError extends HurdlerError {
  constructor(moduleName: string, reason: string, details?: Record<string, unknown>) {
    super(`Compatibility issue detected for module '${moduleName}': ${reason}`, {
      code: 'MODULE_COMPATIBILITY_ERROR',
      details: { moduleName, reason, ...details },
    });
  }
}

export class BundleNotFoundError extends HurdlerError {
  constructor(bundleId: string) {
    super(`Module bundle '${bundleId}' was not found in the preset registry.`, {
      code: 'BUNDLE_NOT_FOUND',
      details: { bundleId },
    });
  }
}

export class VersionMismatchError extends HurdlerError {
  constructor(moduleName: string, requiredVersion: string, foundVersion: string) {
    super(
      `Version mismatch for module '${moduleName}': required '${requiredVersion}', but found '${foundVersion}'.`,
      {
        code: 'VERSION_MISMATCH',
        details: { moduleName, requiredVersion, foundVersion },
      }
    );
  }
}

export class ModuleStorageError extends HurdlerError {
  constructor(filePath: string, operation: 'read' | 'write' | 'validate', message: string, cause?: unknown) {
    super(`Failed to ${operation} modules registry at '${filePath}': ${message}`, {
      code: 'MODULE_STORAGE_ERROR',
      details: { filePath, operation },
      cause,
    });
  }
}


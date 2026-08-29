import { HurdlerError } from '../../core/errors/base-error.js';

/**
 * Thrown when a requested module cannot be found in the registry.
 */
export class ModuleNotFoundError extends HurdlerError {
  constructor(moduleName: string, availableModules: string[] = []) {
    const hint =
      availableModules.length > 0
        ? ` Available modules in registry: ${availableModules.slice(0, 10).join(', ')}${availableModules.length > 10 ? '...' : ''}. You can register custom modules with registerModule().`
        : ` No modules are currently registered. You can register one using registerModule().`;
    super(`Module '${moduleName}' was not found in the modules registry.${hint}`, {
      code: 'MODULE_NOT_FOUND',
      details: { moduleName, availableModules },
    });
  }
}

/**
 * Thrown when attempting to register a module that already exists.
 */
export class DuplicateModuleError extends HurdlerError {
  constructor(moduleName: string) {
    super(`Module '${moduleName}' is already registered in the modules registry. Use updateModule() to modify it.`, {
      code: 'DUPLICATE_MODULE',
      details: { moduleName },
    });
  }
}

/**
 * Thrown when a module definition fails validation against ModuleDefinitionSchema.
 */
export class InvalidModuleDefinitionError extends HurdlerError {
  constructor(moduleName: string, issues: unknown) {
    super(`Validation failed for module '${moduleName}': ${JSON.stringify(issues)}`, {
      code: 'INVALID_MODULE_DEFINITION',
      details: { moduleName, issues },
    });
  }
}

/**
 * Thrown when a preset stack bundle is not found in the bundles registry.
 */
export class BundleNotFoundError extends HurdlerError {
  constructor(bundleId: string, availableBundles: string[] = []) {
    const hint =
      availableBundles.length > 0
        ? ` Available bundles: ${availableBundles.join(', ')}.`
        : ` No bundles are currently registered. You can register one using registerBundle().`;
    super(`Module bundle '${bundleId}' was not found in the preset registry.${hint}`, {
      code: 'BUNDLE_NOT_FOUND',
      details: { bundleId, availableBundles },
    });
  }
}

/**
 * Thrown when attempting to register a bundle that already exists.
 */
export class DuplicateBundleError extends HurdlerError {
  constructor(bundleId: string) {
    super(`Module bundle '${bundleId}' is already registered in the preset registry. Use updateBundle() to modify it.`, {
      code: 'DUPLICATE_BUNDLE',
      details: { bundleId },
    });
  }
}

/**
 * Thrown when a bundle definition fails validation against ModuleBundleSchema.
 */
export class InvalidBundleDefinitionError extends HurdlerError {
  constructor(bundleId: string, issues: unknown) {
    super(`Validation failed for module bundle '${bundleId}': ${JSON.stringify(issues)}`, {
      code: 'INVALID_BUNDLE_DEFINITION',
      details: { bundleId, issues },
    });
  }
}

/**
 * Thrown when compatibility constraints or peer dependency requirements are violated.
 */
export class ModuleCompatibilityError extends HurdlerError {
  constructor(moduleName: string, reason: string, details?: Record<string, unknown>) {
    super(`Compatibility issue detected for module '${moduleName}': ${reason}`, {
      code: 'MODULE_COMPATIBILITY_ERROR',
      details: { moduleName, reason, ...details },
    });
  }
}

/**
 * Thrown when a version mismatch is encountered during module resolution.
 */
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

/**
 * Thrown when reading, writing, or synchronizing the .hurdler/registries/modules.json file fails.
 */
export class ModuleStorageError extends HurdlerError {
  constructor(filePath: string, operation: 'read' | 'write' | 'validate', message: string, cause?: unknown) {
    super(`Failed to ${operation} modules registry at '${filePath}': ${message}`, {
      code: 'MODULE_STORAGE_ERROR',
      details: { filePath, operation },
      cause,
    });
  }
}

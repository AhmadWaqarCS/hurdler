import { HurdlerError, type HurdlerErrorOptions } from '../core/errors/index.js';

/**
 * Base domain error for all Mapper subsystem operations.
 */
export class MapperError extends HurdlerError {
  readonly suggestion?: string;

  constructor(message: string, options: HurdlerErrorOptions & { suggestion?: string } = {}) {
    super(message, {
      code: options.code ?? 'MAPPER_ERROR',
      cause: options.cause,
      details: {
        ...options.details,
        ...(options.suggestion ? { suggestion: options.suggestion } : {}),
      },
    });
    this.suggestion = options.suggestion;
  }
}

/**
 * Thrown when scanning a codebase fails due to filesystem, permission, or traversal errors.
 */
export class MapperScanError extends MapperError {
  constructor(projectRoot: string, reason: string, options: HurdlerErrorOptions = {}) {
    super(`Failed to scan codebase at '${projectRoot}': ${reason}`, {
      code: 'MAPPER_SCAN_ERROR',
      details: { projectRoot, reason, ...options.details },
      suggestion: 'Verify that the project directory exists, has read permissions, and contains valid source files.',
      ...options,
    });
  }
}

/**
 * Thrown when saving or loading a codebase map from disk fails.
 */
export class MapPersistenceError extends MapperError {
  constructor(targetPath: string, action: 'save' | 'load', reason: string, options: HurdlerErrorOptions = {}) {
    super(`Failed to ${action} codebase map at '${targetPath}': ${reason}`, {
      code: 'MAP_PERSISTENCE_ERROR',
      details: { targetPath, action, reason, ...options.details },
      suggestion: `Check file permissions and ensure the target directory '${targetPath}' is accessible for ${action} operations.`,
      ...options,
    });
  }
}

/**
 * Thrown when looking up a symbol that does not exist in the active codebase map.
 */
export class SymbolNotFoundError extends MapperError {
  constructor(symbolName: string, filePath?: string, options: HurdlerErrorOptions = {}) {
    const loc = filePath ? ` in file '${filePath}'` : '';
    super(`Symbol '${symbolName}' not found in codebase map${loc}.`, {
      code: 'SYMBOL_NOT_FOUND',
      details: { symbolName, filePath, ...options.details },
      suggestion: 'Verify the symbol name spelling or run scanCodebase() to refresh the symbol index.',
      ...options,
    });
  }
}

/**
 * Thrown when querying or requesting context for a file that is not indexed.
 */
export class FileNotFoundInMapError extends MapperError {
  constructor(filePath: string, options: HurdlerErrorOptions = {}) {
    super(`File '${filePath}' is not indexed in the active codebase map.`, {
      code: 'FILE_NOT_FOUND_IN_MAP',
      details: { filePath, ...options.details },
      suggestion: `Ensure the file path is correct relative to project root or call updateCodebaseFile('${filePath}') to index it.`,
      ...options,
    });
  }
}

/**
 * Thrown when a loaded codebase map fails Zod schema validation.
 */
export class InvalidMapSchemaError extends MapperError {
  constructor(message: string, validationErrors?: unknown, options: HurdlerErrorOptions = {}) {
    super(`Invalid codebase map schema: ${message}`, {
      code: 'INVALID_MAP_SCHEMA',
      details: { validationErrors, ...options.details },
      suggestion: 'The map file may be corrupted or from an older version. Re-run scanCodebase({ forceRescan: true }) to regenerate it.',
      ...options,
    });
  }
}

/**
 * Thrown when mapper configuration validation fails.
 */
export class MapperConfigError extends MapperError {
  constructor(message: string, options: HurdlerErrorOptions = {}) {
    super(`Invalid mapper configuration: ${message}`, {
      code: 'MAPPER_CONFIG_ERROR',
      suggestion: 'Check the configuration object passed to configureMapper() against MapperConfigSchema.',
      ...options,
    });
  }
}

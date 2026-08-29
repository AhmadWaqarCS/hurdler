import { HurdlerError, type HurdlerErrorOptions } from '../core/errors/index.js';

export class MapperError extends HurdlerError {
  constructor(message: string, options: HurdlerErrorOptions = {}) {
    super(message, {
      code: options.code ?? 'MAPPER_ERROR',
      ...options,
    });
  }
}

export class MapperScanError extends MapperError {
  constructor(projectRoot: string, reason: string, options: HurdlerErrorOptions = {}) {
    super(`Failed to scan codebase at '${projectRoot}': ${reason}`, {
      code: 'MAPPER_SCAN_ERROR',
      details: { projectRoot, reason, ...options.details },
      ...options,
    });
  }
}

export class MapPersistenceError extends MapperError {
  constructor(targetPath: string, action: 'save' | 'load', reason: string, options: HurdlerErrorOptions = {}) {
    super(`Failed to ${action} codebase map at '${targetPath}': ${reason}`, {
      code: 'MAP_PERSISTENCE_ERROR',
      details: { targetPath, action, reason, ...options.details },
      ...options,
    });
  }
}

export class SymbolNotFoundError extends MapperError {
  constructor(symbolName: string, filePath?: string, options: HurdlerErrorOptions = {}) {
    const loc = filePath ? ` in file '${filePath}'` : '';
    super(`Symbol '${symbolName}' not found in codebase map${loc}.`, {
      code: 'SYMBOL_NOT_FOUND',
      details: { symbolName, filePath, ...options.details },
      ...options,
    });
  }
}

export class FileNotFoundInMapError extends MapperError {
  constructor(filePath: string, options: HurdlerErrorOptions = {}) {
    super(`File '${filePath}' is not indexed in the active codebase map.`, {
      code: 'FILE_NOT_FOUND_IN_MAP',
      details: { filePath, ...options.details },
      ...options,
    });
  }
}

export class InvalidMapSchemaError extends MapperError {
  constructor(message: string, validationErrors?: unknown, options: HurdlerErrorOptions = {}) {
    super(`Invalid codebase map schema: ${message}`, {
      code: 'INVALID_MAP_SCHEMA',
      details: { validationErrors, ...options.details },
      ...options,
    });
  }
}

import { HurdlerError } from '../../core/errors/base-error.js';

export class RegistryError extends HurdlerError {
  constructor(message: string, options: { code?: string; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, {
      code: options.code ?? 'REGISTRY_ERROR',
      details: options.details,
      cause: options.cause,
    });
  }
}

export class RegistryItemNotFoundError extends RegistryError {
  constructor(registryName: string, key: unknown) {
    super(`Item '${String(key)}' not found in registry '${registryName}'.`, {
      code: 'REGISTRY_ITEM_NOT_FOUND',
      details: { registryName, key },
    });
  }
}

export class RegistryItemAlreadyExistsError extends RegistryError {
  constructor(registryName: string, key: unknown) {
    super(`Item '${String(key)}' already exists in registry '${registryName}'.`, {
      code: 'REGISTRY_ITEM_ALREADY_EXISTS',
      details: { registryName, key },
    });
  }
}

export class RegistryValidationError extends RegistryError {
  constructor(registryName: string, key: unknown, issues: unknown) {
    super(`Validation failed for item '${String(key)}' in registry '${registryName}'.`, {
      code: 'REGISTRY_VALIDATION_ERROR',
      details: { registryName, key, issues },
    });
  }
}

export class RegistryLockedError extends RegistryError {
  constructor(registryName: string) {
    super(`Registry '${registryName}' is frozen and cannot be modified.`, {
      code: 'REGISTRY_LOCKED',
      details: { registryName },
    });
  }
}

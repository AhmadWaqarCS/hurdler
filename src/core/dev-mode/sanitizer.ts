import { maskApiKey } from '../../common/helpers.js';
import type { SerializedError } from './types.js';

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /auth/i,
  /password/i,
  /credentials/i,
  /bearer/i,
  /private[_-]?key/i,
];

/**
 * Checks if a property key represents a sensitive field.
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Sanitizes arbitrary values, masking sensitive credentials and safely handling circular references.
 */
export function sanitizeLogData(value: unknown, maskSensitive = true, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular Reference]';
    }
    seen.add(value);

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (value instanceof Error) {
      return serializeError(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeLogData(item, maskSensitive, seen));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (maskSensitive && isSensitiveKey(k)) {
        if (typeof v === 'string') {
          sanitizedObj[k] = maskApiKey(v);
        } else if (v && typeof v === 'object') {
          sanitizedObj[k] = sanitizeLogData(v, maskSensitive, seen);
        } else {
          sanitizedObj[k] = '***';
        }
      } else {
        sanitizedObj[k] = sanitizeLogData(v, maskSensitive, seen);
      }
    }
    return sanitizedObj;
  }

  return String(value);
}

/**
 * Serializes any thrown error or exception into a standardized structured object.
 */
export function serializeError(error: unknown): SerializedError {
  if (!error) {
    return {
      name: 'UnknownError',
      message: 'Unknown error occurred',
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
    };

    const maybeHurdler = error as { code?: string; details?: Record<string, unknown>; cause?: unknown };
    if (maybeHurdler.code) {
      serialized.code = maybeHurdler.code;
    }
    if (maybeHurdler.details) {
      serialized.details = sanitizeLogData(maybeHurdler.details) as Record<string, unknown>;
    }
    if (maybeHurdler.cause) {
      serialized.cause = serializeError(maybeHurdler.cause);
    }

    return serialized;
  }

  if (typeof error === 'object') {
    return {
      name: (error as { name?: string }).name || 'ObjectError',
      message: (error as { message?: string }).message || JSON.stringify(sanitizeLogData(error)),
      details: sanitizeLogData(error) as Record<string, unknown>,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

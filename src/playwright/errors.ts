import { HurdlerError, type HurdlerErrorOptions } from '../core/errors/base-error.js';

/**
 * Base error class for all Playwright testing subsystem errors.
 */
export class PlaywrightEngineError extends HurdlerError {
  constructor(message: string, options: HurdlerErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'PLAYWRIGHT_ENGINE_ERROR',
    });
  }
}

/**
 * Thrown when launching the browser process fails or times out.
 */
export class PlaywrightLaunchError extends PlaywrightEngineError {
  constructor(message: string, options: HurdlerErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'PLAYWRIGHT_LAUNCH_ERROR',
    });
  }
}

/**
 * Thrown when navigating to a URL fails or times out.
 */
export class PlaywrightNavigationError extends PlaywrightEngineError {
  readonly url?: string;

  constructor(message: string, options: HurdlerErrorOptions & { url?: string } = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'PLAYWRIGHT_NAVIGATION_ERROR',
      details: { ...options.details, url: options.url },
    });
    this.url = options.url;
  }
}

/**
 * Thrown when executing a browser action (click, fill, wait) fails.
 */
export class PlaywrightActionError extends PlaywrightEngineError {
  readonly actionType?: string;
  readonly selector?: string;

  constructor(
    message: string,
    options: HurdlerErrorOptions & { actionType?: string; selector?: string } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? 'PLAYWRIGHT_ACTION_ERROR',
      details: {
        ...options.details,
        actionType: options.actionType,
        selector: options.selector,
      },
    });
    this.actionType = options.actionType;
    this.selector = options.selector;
  }
}

/**
 * Thrown when a Playwright assertion fails.
 */
export class PlaywrightAssertionError extends PlaywrightEngineError {
  readonly expected?: unknown;
  readonly actual?: unknown;

  constructor(
    message: string,
    options: HurdlerErrorOptions & { expected?: unknown; actual?: unknown } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? 'PLAYWRIGHT_ASSERTION_ERROR',
      details: {
        ...options.details,
        expected: options.expected,
        actual: options.actual,
      },
    });
    this.expected = options.expected;
    this.actual = options.actual;
  }
}

/**
 * Thrown when a test suite or step times out.
 */
export class PlaywrightTimeoutError extends PlaywrightEngineError {
  readonly timeoutMs?: number;

  constructor(message: string, options: HurdlerErrorOptions & { timeoutMs?: number } = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'PLAYWRIGHT_TIMEOUT_ERROR',
      details: { ...options.details, timeoutMs: options.timeoutMs },
    });
    this.timeoutMs = options.timeoutMs;
  }
}

import { DevLogger } from './logger.js';
import {
  DevModeConfigSchema,
  type DevModeConfig,
  type DevModeOptions,
  type LogLevel,
} from './types.js';

/**
 * Computes default initial dev mode configuration from environment variables and process context.
 */
function resolveInitialDevModeConfig(): DevModeConfig {
  const env = process.env;
  const isTestEnv = env.NODE_ENV === 'test';
  const hasDevFlag =
    env.DEV_MODE === 'true' ||
    env.DEV_MODE === '1' ||
    env.HURDLER_DEV_MODE === 'true' ||
    env.HURDLER_DEV_MODE === '1' ||
    (typeof process !== 'undefined' &&
      Array.isArray(process.argv) &&
      process.argv.some((arg) => arg === '--dev' || arg === '-d'));

  // Test scripts enable dev mode by default; otherwise it is disabled by default
  const enabled = hasDevFlag || isTestEnv;

  const rawConfig: Record<string, unknown> = {
    enabled,
    logLevel: env.LOG_LEVEL || (isTestEnv ? 'debug' : 'debug'),
    consoleLogging: env.LOG_CONSOLE !== 'false',
    fileLogging: env.LOG_FILE !== 'false',
    logsDirectory: env.LOGS_DIR || 'logs',
    logFileName: env.LOG_FILE_NAME || 'dev.log',
    errorLogFileName: env.ERROR_LOG_FILE_NAME || 'error.log',
    maskSensitiveData: env.MASK_SENSITIVE !== 'false',
    includeTimestamp: env.LOG_TIMESTAMP !== 'false',
    includeMetadata: env.LOG_METADATA !== 'false',
    colors: env.NO_COLOR === undefined,
  };

  return DevModeConfigSchema.parse(rawConfig);
}

/**
 * Central DevModeManager for Hurdler.
 * Controls state, configuration, and logging lifecycle for the application.
 */
export class DevModeManager {
  private config: DevModeConfig;
  private logger: DevLogger;

  constructor(initialConfig?: DevModeOptions) {
    const baseConfig = resolveInitialDevModeConfig();
    this.config = initialConfig
      ? DevModeConfigSchema.parse({ ...baseConfig, ...initialConfig })
      : baseConfig;
    this.logger = new DevLogger(this.config);
  }

  /**
   * Returns whether dev mode is currently active.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Returns a copy of the active dev mode configuration.
   */
  getConfig(): Readonly<DevModeConfig> {
    return { ...this.config };
  }

  /**
   * Returns the shared DevLogger instance.
   */
  getLogger(): DevLogger {
    return this.logger;
  }

  /**
   * Enables dev mode with optional configuration overrides.
   */
  enable(options?: DevModeOptions): void {
    const merged = DevModeConfigSchema.parse({
      ...this.config,
      ...options,
      enabled: true,
    });
    this.config = merged;
    this.logger.updateConfig(merged);
    this.logger.info('DEV_MODE', 'Dev Mode enabled.');
  }

  /**
   * Disables dev mode globally.
   */
  disable(): void {
    const merged = DevModeConfigSchema.parse({
      ...this.config,
      enabled: false,
    });
    this.config = merged;
    this.logger.updateConfig(merged);
  }

  /**
   * Updates configuration settings at runtime without changing the enabled state unless specified.
   */
  configure(options: DevModeOptions): void {
    const merged = DevModeConfigSchema.parse({
      ...this.config,
      ...options,
    });
    this.config = merged;
    this.logger.updateConfig(merged);
  }

  /**
   * Sets minimum log level.
   */
  setLogLevel(level: LogLevel): void {
    this.configure({ logLevel: level });
  }

  /**
   * Flushes all buffered log writes to disk.
   */
  async flush(): Promise<void> {
    await this.logger.flush();
  }
}

/** Global singleton DevModeManager instance */
export const defaultDevMode = new DevModeManager();

/** Enable Dev Mode across Hurdler */
export function enableDevMode(options?: DevModeOptions): void {
  defaultDevMode.enable(options);
}

/** Disable Dev Mode across Hurdler */
export function disableDevMode(): void {
  defaultDevMode.disable();
}

/** Check if Dev Mode is active */
export function isDevMode(): boolean {
  return defaultDevMode.isEnabled();
}

/** Get the active DevLogger */
export function getDevLogger(): DevLogger {
  return defaultDevMode.getLogger();
}

/** Flush buffered log lines to disk */
export async function flushDevLogs(): Promise<void> {
  await defaultDevMode.flush();
}

/** Quick debug log helper */
export function devDebug(category: string, message: string, data?: unknown, durationMs?: number): void {
  defaultDevMode.getLogger().debug(category, message, data, durationMs);
}

/** Quick info log helper */
export function devInfo(category: string, message: string, data?: unknown, durationMs?: number): void {
  defaultDevMode.getLogger().info(category, message, data, durationMs);
}

/** Quick warn log helper */
export function devWarn(category: string, message: string, data?: unknown): void {
  defaultDevMode.getLogger().warn(category, message, data);
}

/** Quick error log helper */
export function devError(category: string, message: string, error?: unknown, data?: unknown): void {
  defaultDevMode.getLogger().error(category, message, error, data);
}

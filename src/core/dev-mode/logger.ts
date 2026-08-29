import { DevLogFileWriter } from './file-writer.js';
import { sanitizeLogData, serializeError } from './sanitizer.js';
import {
  LOG_LEVEL_WEIGHTS,
  type DevModeConfig,
  type LogEntry,
  type LogLevel,
} from './types.js';

const ANSI_COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

/**
 * DevLogger manages unified console and file logging for Hurdler's dev mode.
 */
export class DevLogger {
  private config: DevModeConfig;
  private fileWriter: DevLogFileWriter;

  private listeners: Set<(entry: LogEntry) => void> = new Set();
  private recentLogs: LogEntry[] = [];
  private readonly MAX_RECENT_LOGS = 500;

  constructor(config: DevModeConfig) {
    this.config = config;
    this.fileWriter = new DevLogFileWriter(config);
  }

  /**
   * Subscribes a listener callback to receive log entries in real time.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns recent in-memory log entries.
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.recentLogs.slice(-limit);
  }

  /**
   * Updates configuration settings in real time.
   */
  updateConfig(config: DevModeConfig): void {
    this.config = config;
    this.fileWriter.updateConfig(config);
  }

  /**
   * Checks if a given log level is active.
   */
  isLevelActive(level: LogLevel): boolean {
    if (!this.config.enabled || this.config.logLevel === 'silent') {
      return false;
    }
    const currentWeight = LOG_LEVEL_WEIGHTS[this.config.logLevel] ?? 10;
    const targetWeight = LOG_LEVEL_WEIGHTS[level] ?? 10;
    return targetWeight >= currentWeight;
  }

  /**
   * Main logging dispatcher.
   */
  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
    error?: unknown,
    durationMs?: number
  ): void {
    if (!this.isLevelActive(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const sanitizedData =
      data !== undefined
        ? sanitizeLogData(data, this.config.maskSensitiveData)
        : undefined;
    const serializedError = error !== undefined ? serializeError(error) : undefined;

    const entry: LogEntry = {
      timestamp,
      level,
      category,
      message,
      data: sanitizedData,
      error: serializedError,
      durationMs,
    };

    // Store in recent buffer
    this.recentLogs.push(entry);
    if (this.recentLogs.length > this.MAX_RECENT_LOGS) {
      this.recentLogs.shift();
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Safe swallow
      }
    }

    // 1. Output to console if enabled
    if (this.config.consoleLogging) {
      this.writeToConsole(entry);
    }

    // 2. Output to disk if enabled
    if (this.config.fileLogging) {
      this.fileWriter.write(entry);
    }
  }

  /**
   * Logs a debug diagnostic message.
   */
  debug(category: string, message: string, data?: unknown, durationMs?: number): void {
    this.log('debug', category, message, data, undefined, durationMs);
  }

  /**
   * Logs an informational status message.
   */
  info(category: string, message: string, data?: unknown, durationMs?: number): void {
    this.log('info', category, message, data, undefined, durationMs);
  }

  /**
   * Logs a warning message.
   */
  warn(category: string, message: string, data?: unknown): void {
    this.log('warn', category, message, data);
  }

  /**
   * Logs an error message with error diagnostics and stack trace.
   */
  error(category: string, message: string, error?: unknown, data?: unknown): void {
    this.log('error', category, message, data, error);
  }

  /**
   * Flushes all buffered log lines to disk.
   */
  async flush(): Promise<void> {
    await this.fileWriter.flush();
  }

  /**
   * Formats and prints a log entry to the terminal console.
   */
  private writeToConsole(entry: LogEntry): void {
    const { timestamp, level, category, message, data, error, durationMs } = entry;
    const useColors = this.config.colors && process.stdout?.isTTY;

    const timePrefix = this.config.includeTimestamp
      ? useColors
        ? `${ANSI_COLORS.gray}${timestamp}${ANSI_COLORS.reset} `
        : `${timestamp} `
      : '';

    const categoryTag = useColors
      ? `${ANSI_COLORS.cyan}[${category}]${ANSI_COLORS.reset}`
      : `[${category}]`;

    const durationTag =
      durationMs !== undefined
        ? useColors
          ? ` ${ANSI_COLORS.dim}(+${durationMs}ms)${ANSI_COLORS.reset}`
          : ` (+${durationMs}ms)`
        : '';

    let levelTag = `[${level.toUpperCase()}]`;
    if (useColors) {
      switch (level) {
        case 'debug':
          levelTag = `${ANSI_COLORS.magenta}[DEV:DEBUG]${ANSI_COLORS.reset}`;
          break;
        case 'info':
          levelTag = `${ANSI_COLORS.green}[DEV:INFO]${ANSI_COLORS.reset}`;
          break;
        case 'warn':
          levelTag = `${ANSI_COLORS.yellow}[DEV:WARN]${ANSI_COLORS.reset}`;
          break;
        case 'error':
          levelTag = `${ANSI_COLORS.red}${ANSI_COLORS.bright}[DEV:ERROR]${ANSI_COLORS.reset}`;
          break;
      }
    } else {
      levelTag = `[DEV:${level.toUpperCase()}]`;
    }

    const logLine = `${timePrefix}${levelTag} ${categoryTag} ${message}${durationTag}`;

    if (level === 'error') {
      console.error(logLine);
      if (error) {
        if (error.stack) {
          console.error(useColors ? `${ANSI_COLORS.red}${error.stack}${ANSI_COLORS.reset}` : error.stack);
        }
        if (error.details && this.config.includeMetadata) {
          console.error(
            useColors ? `${ANSI_COLORS.dim}Details:${ANSI_COLORS.reset}` : 'Details:',
            error.details
          );
        }
      }
      if (data && this.config.includeMetadata) {
        console.error(useColors ? `${ANSI_COLORS.dim}Context:${ANSI_COLORS.reset}` : 'Context:', data);
      }
    } else if (level === 'warn') {
      console.warn(logLine);
      if (data && this.config.includeMetadata) {
        console.warn(useColors ? `${ANSI_COLORS.dim}Context:${ANSI_COLORS.reset}` : 'Context:', data);
      }
    } else {
      console.log(logLine);
      if (data && this.config.includeMetadata) {
        console.log(useColors ? `${ANSI_COLORS.dim}Context:${ANSI_COLORS.reset}` : 'Context:', data);
      }
    }
  }
}

import { z } from 'zod';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export const DevModeConfigSchema = z.object({
  /** Whether dev mode is globally active */
  enabled: z.boolean().default(false),
  /** Minimum log level to emit ('debug' | 'info' | 'warn' | 'error' | 'silent') */
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('debug'),
  /** Output formatted logs to stdout/stderr */
  consoleLogging: z.boolean().default(true),
  /** Output JSON log lines to disk */
  fileLogging: z.boolean().default(true),
  /** Directory path to store log files (relative to project root) */
  logsDirectory: z.string().default('logs'),
  /** Filename for all dev mode logs */
  logFileName: z.string().default('dev.log'),
  /** Filename for error logs */
  errorLogFileName: z.string().default('error.log'),
  /** Mask API keys, tokens, and secrets in logs */
  maskSensitiveData: z.boolean().default(true),
  /** Include ISO timestamp in log outputs */
  includeTimestamp: z.boolean().default(true),
  /** Include data payloads and metadata in console output */
  includeMetadata: z.boolean().default(true),
  /** Enable ANSI colors in terminal output */
  colors: z.boolean().default(true),
});

export type DevModeConfig = z.infer<typeof DevModeConfigSchema>;
export type DevModeOptions = Partial<DevModeConfig>;

export interface SerializedError {
  name: string;
  message: string;
  code?: string;
  stack?: string;
  details?: Record<string, unknown>;
  cause?: SerializedError;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  error?: SerializedError;
  durationMs?: number;
}

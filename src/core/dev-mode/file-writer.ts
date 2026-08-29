import fs from 'fs';
import path from 'path';
import type { DevModeConfig, LogEntry } from './types.js';

/**
 * Asynchronous, buffered file writer for Dev Mode logs.
 * Writes to logs/dev.log and logs/error.log without blocking application execution.
 */
export class DevLogFileWriter {
  private config: DevModeConfig;
  private logsDirPath: string;
  private devLogFilePath: string;
  private errorLogFilePath: string;
  private dirEnsured = false;
  private fsWarningReported = false;

  private buffer: Array<{ target: 'dev' | 'error'; line: string }> = [];
  private isWriting = false;
  private flushPromise: Promise<void> | null = null;

  constructor(config: DevModeConfig) {
    this.config = config;
    this.logsDirPath = path.resolve(process.cwd(), config.logsDirectory);
    this.devLogFilePath = path.join(this.logsDirPath, config.logFileName);
    this.errorLogFilePath = path.join(this.logsDirPath, config.errorLogFileName);
  }

  /**
   * Updates configuration settings at runtime.
   */
  updateConfig(config: DevModeConfig): void {
    this.config = config;
    this.logsDirPath = path.resolve(process.cwd(), config.logsDirectory);
    this.devLogFilePath = path.join(this.logsDirPath, config.logFileName);
    this.errorLogFilePath = path.join(this.logsDirPath, config.errorLogFileName);
    this.dirEnsured = false;
  }

  /**
   * Ensures the logs directory exists.
   */
  private async ensureDirectory(): Promise<void> {
    if (this.dirEnsured) {
      return;
    }
    try {
      await fs.promises.mkdir(this.logsDirPath, { recursive: true });
      this.dirEnsured = true;
    } catch (err) {
      this.reportFsError('Failed to create logs directory', err);
    }
  }

  /**
   * Enqueues a formatted log entry for disk writing.
   */
  write(entry: LogEntry): void {
    if (!this.config.fileLogging) {
      return;
    }

    const logLine = JSON.stringify(entry) + '\n';
    this.buffer.push({ target: 'dev', line: logLine });

    if (entry.level === 'error') {
      this.buffer.push({ target: 'error', line: logLine });
    }

    this.scheduleFlush();
  }

  /**
   * Schedules an asynchronous flush of buffered log entries.
   */
  private scheduleFlush(): void {
    if (this.isWriting || this.buffer.length === 0) {
      return;
    }

    this.isWriting = true;
    queueMicrotask(() => {
      this.processBuffer().finally(() => {
        this.isWriting = false;
        if (this.buffer.length > 0) {
          this.scheduleFlush();
        }
      });
    });
  }

  /**
   * Writes all queued entries to disk.
   */
  private async processBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const batch = this.buffer.splice(0, this.buffer.length);
    let devContent = '';
    let errorContent = '';

    for (const item of batch) {
      if (item.target === 'dev') {
        devContent += item.line;
      } else if (item.target === 'error') {
        errorContent += item.line;
      }
    }

    try {
      await this.ensureDirectory();

      const promises: Promise<void>[] = [];
      if (devContent) {
        promises.push(fs.promises.appendFile(this.devLogFilePath, devContent, 'utf-8'));
      }
      if (errorContent) {
        promises.push(fs.promises.appendFile(this.errorLogFilePath, errorContent, 'utf-8'));
      }

      await Promise.all(promises);
    } catch (err) {
      this.reportFsError('Failed to write log entries to disk', err);
    }
  }

  /**
   * Flushes all buffered log lines immediately (useful before process exit or test teardown).
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }
    await this.processBuffer();
  }

  /**
   * Safely warns if filesystem logging encounters permission or IO errors without throwing.
   */
  private reportFsError(context: string, err: unknown): void {
    if (!this.fsWarningReported) {
      this.fsWarningReported = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[DEV:WARN] [DEV_MODE_FS] ${context}: ${msg}`);
    }
  }
}

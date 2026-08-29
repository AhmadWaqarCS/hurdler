/**
 * Hurdler CLI Subsystem - Dev Mode Diagnostics Command
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printHeader, printSuccess, printKeyValues, printInfo } from '../formatters/output.js';
import { isDevMode, defaultDevMode, flushDevLogs } from '../../core/dev-mode/index.js';
import { getOptionNumber, getOptionBoolean } from '../parser.js';

export const handleDevStatus: CliCommandHandler = async (args, ctx) => {
  const active = isDevMode();
  const config = defaultDevMode.getConfig();
  const logsDir = path.resolve(ctx.projectRoot || process.cwd(), config.logsDirectory || 'logs');

  let devLogExists = false;
  let errorLogExists = false;
  let devLogSize = 0;
  let errorLogSize = 0;

  try {
    const stat = await fs.stat(path.join(logsDir, config.logFileName || 'dev.log'));
    devLogExists = true;
    devLogSize = stat.size;
  } catch {}

  try {
    const stat = await fs.stat(path.join(logsDir, config.errorLogFileName || 'error.log'));
    errorLogExists = true;
    errorLogSize = stat.size;
  } catch {}

  const data = {
    isDevMode: active,
    logLevel: config.logLevel,
    logsDirectory: logsDir,
    fileLogging: config.fileLogging,
    consoleLogging: config.consoleLogging,
    maskSensitive: config.maskSensitiveData,
    devLog: { exists: devLogExists, sizeBytes: devLogSize },
    errorLog: { exists: errorLogExists, sizeBytes: errorLogSize },
  };

  if (!ctx.isJson) {
    printHeader('Hurdler Dev Mode Diagnostic Status');
    printKeyValues({
      'Dev Mode Active': active ? 'ENABLED (active)' : 'DISABLED (standard mode)',
      'Log Level': config.logLevel,
      'Logs Directory': logsDir,
      'Console Logging': config.consoleLogging,
      'Disk File Logging': config.fileLogging,
      'Secret Masking': config.maskSensitiveData,
      'dev.log': devLogExists ? `${(devLogSize / 1024).toFixed(2)} KB` : 'Not created yet',
      'error.log': errorLogExists ? `${(errorLogSize / 1024).toFixed(2)} KB` : 'Not created yet',
    });
    printInfo('Tip: Pass `--dev` with any command to temporarily activate Dev Mode diagnostics.');
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data,
  };
};

export const handleDevLogs: CliCommandHandler = async (args, ctx) => {
  await flushDevLogs();
  const config = defaultDevMode.getConfig();
  const logsDir = path.resolve(ctx.projectRoot || process.cwd(), config.logsDirectory || 'logs');
  const isErrorOnly = getOptionBoolean(args.options, 'error', 'e', false);
  const tailCount = getOptionNumber(args.options, 'tail', 'n', 50) ?? 50;

  const targetFile = isErrorOnly
    ? path.join(logsDir, config.errorLogFileName || 'error.log')
    : path.join(logsDir, config.logFileName || 'dev.log');

  try {
    const content = await fs.readFile(targetFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const recentLines = lines.slice(-tailCount);

    if (!ctx.isJson) {
      printHeader(`Recent Logs: ${path.basename(targetFile)} (Showing last ${recentLines.length} lines)`);
      if (recentLines.length === 0) {
        console.log('  (Log file is currently empty)');
      } else {
        console.log(recentLines.join('\n'));
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: {
        file: targetFile,
        totalLines: lines.length,
        lines: recentLines,
      },
    };
  } catch (err) {
    if (!ctx.isJson) {
      console.log(`Log file not found: ${targetFile}`);
    }
    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: 'No log file found.',
      data: { file: targetFile, totalLines: 0, lines: [] },
    };
  }
};

export const handleDevClear: CliCommandHandler = async (args, ctx) => {
  const config = defaultDevMode.getConfig();
  const logsDir = path.resolve(ctx.projectRoot || process.cwd(), config.logsDirectory || 'logs');

  try {
    const devLog = path.join(logsDir, config.logFileName || 'dev.log');
    const errLog = path.join(logsDir, config.errorLogFileName || 'error.log');

    await fs.writeFile(devLog, '', 'utf-8').catch(() => {});
    await fs.writeFile(errLog, '', 'utf-8').catch(() => {});

    if (!ctx.isJson) {
      printSuccess('Dev logs cleared successfully.');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: 'Dev log files cleared.',
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to clear logs: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const devCommandDefinition: CliCommandDefinition = {
  name: 'dev',
  summary: 'Inspect diagnostic status, tail log files, and manage Dev Mode',
  description: 'Manage diagnostic logs in logs/ directory, inspect Dev Mode config, and view active traces.',
  usage: 'hurdler dev <status|logs|clear> [options]',
  handler: handleDevStatus,
  subcommands: {
    status: {
      name: 'status',
      summary: 'Show Dev Mode configuration and log file metrics',
      usage: 'hurdler dev status [options]',
      handler: handleDevStatus,
    },
    logs: {
      name: 'logs',
      summary: 'Read and tail diagnostic log files',
      usage: 'hurdler dev logs [--tail <n>] [--error]',
      options: [
        { name: 'tail', alias: 'n', description: 'Number of recent lines to display', type: 'number', defaultValue: 50 },
        { name: 'error', alias: 'e', description: 'Read error.log instead of dev.log', type: 'boolean' },
      ],
      handler: handleDevLogs,
    },
    clear: {
      name: 'clear',
      summary: 'Clear contents of all log files in logs/ directory',
      usage: 'hurdler dev clear',
      handler: handleDevClear,
    },
  },
  examples: [
    'hurdler dev status',
    'hurdler dev logs --tail 100',
    'hurdler dev logs --error',
    'hurdler dev clear',
  ],
};

/**
 * Hurdler CLI Subsystem - Init Command
 * Scaffolds project directories (.hurdler/, registries/, logs/, cache/) and config.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import { printSuccess, printInfo, printKeyValue } from '../formatters/output.js';
import { isGitRepository } from '../../git/status.js';

export const handleInitCommand: CliCommandHandler = async (args, ctx) => {
  const projectRoot = ctx.projectRoot || process.cwd();
  const hurdlerDir = path.join(projectRoot, '.hurdler');
  const registriesDir = path.join(hurdlerDir, 'registries');
  const logsDir = path.join(projectRoot, 'logs');
  const cacheDir = path.join(hurdlerDir, 'cache');
  const configPath = path.join(hurdlerDir, 'config.json');

  // Create required directory tree
  await fs.mkdir(registriesDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  // Scaffold default config if not present
  let configCreated = false;
  try {
    await fs.access(configPath);
  } catch {
    const defaultConfig = {
      version: '1.0.0',
      projectName: path.basename(projectRoot),
      defaultModel: 'anthropic/claude-3-7-sonnet',
      devMode: false,
      logLevel: 'info',
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    configCreated = true;
  }

  // Check Git status
  const isGit = await isGitRepository(projectRoot);

  const data = {
    projectRoot,
    hurdlerDir,
    configPath,
    configCreated,
    isGitRepository: isGit,
  };

  if (!ctx.isJson) {
    printSuccess('Hurdler workspace initialized successfully!');
    printKeyValue('Project Root', projectRoot);
    printKeyValue('Hurdler Directory', hurdlerDir);
    printKeyValue('Configuration', configCreated ? 'Created default config.json' : 'Existing config found');
    printKeyValue('Git Repository', isGit ? 'Initialized' : 'Not a Git repo (run `hurdler git init`)');
    if (!isGit) {
      printInfo('Tip: Run `git init` or `hurdler git init` to enable version control and agent attribution.');
    }
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    message: 'Hurdler workspace initialized successfully.',
    data,
  };
};

export const initCommandDefinition: CliCommandDefinition = {
  name: 'init',
  summary: 'Initialize a new Hurdler workspace and scaffold configuration',
  description: 'Creates the .hurdler/ directory structure, registries folders, logs directory, and default config.json.',
  usage: 'hurdler init [options]',
  handler: handleInitCommand,
  examples: [
    'hurdler init',
    'hurdler init --json',
  ],
};

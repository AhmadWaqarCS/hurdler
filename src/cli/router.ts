/**
 * Hurdler CLI Subsystem - Central Command Router & Dispatcher
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { CliContext, CliResult, ParsedCliArgs } from './types.js';
import { ExitCode } from './types.js';
import { parseCliArgs } from './parser.js';
import { COMMAND_REGISTRY } from './commands/index.js';
import { renderRootHelp, renderCommandHelp } from './help.js';
import { printJson } from './formatters/json.js';
import { printError } from './formatters/output.js';
import { enableDevMode, isDevMode, flushDevLogs, devInfo, devError } from '../core/dev-mode/index.js';
import { getEnvConfig } from '../core/config/env.js';

const PACKAGE_VERSION = '1.0.0';

/**
 * Executes a CLI invocation from raw argument strings.
 *
 * @param argv - Argument tokens (defaults to `process.argv.slice(2)`).
 * @returns Promise resolving to the structured CliResult.
 */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<CliResult> {
  const parsed = parseCliArgs(argv);
  const isJson = Boolean(parsed.globalOptions.json);
  const isQuiet = Boolean(parsed.globalOptions.quiet);

  // 1. Activate Dev Mode if --dev is passed
  if (parsed.globalOptions.dev) {
    enableDevMode({
      logLevel: 'debug',
      consoleLogging: true,
      fileLogging: true,
    });
    devInfo('CLI', 'Dev Mode enabled via CLI flag');
  }

  // 2. Handle --version / -v
  if (parsed.globalOptions.version) {
    if (isJson) {
      printJson({ version: PACKAGE_VERSION, name: 'hurdler' });
    } else {
      console.log(`hurdler version ${PACKAGE_VERSION}`);
    }
    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { version: PACKAGE_VERSION },
    };
  }

  // 3. Handle root --help / -h or empty arguments
  if (parsed.globalOptions.help && parsed.positionals.length === 0) {
    const helpText = renderRootHelp(COMMAND_REGISTRY);
    if (isJson) {
      printJson({ help: helpText });
    } else {
      console.log(helpText);
    }
    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { help: helpText },
    };
  }

  if (parsed.positionals.length === 0) {
    const helpText = renderRootHelp(COMMAND_REGISTRY);
    if (isJson) {
      printJson({ error: 'No command specified', help: helpText });
    } else {
      console.log(helpText);
    }
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'No command specified.',
    };
  }

  // 4. Resolve Top-Level Command
  const commandName = parsed.positionals[0].toLowerCase();
  const cmdDef = findCommand(commandName);

  if (!cmdDef) {
    const errorMsg = `Unknown command: '${commandName}'`;
    const suggestion = `Run 'hurdler --help' to view available commands.`;
    if (isJson) {
      printJson({ success: false, error: errorMsg, suggestion });
    } else {
      printError(errorMsg, suggestion);
    }
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: errorMsg,
      suggestion,
    };
  }

  // 5. Handle command-level --help
  if (parsed.globalOptions.help && parsed.positionals.length === 1) {
    const helpText = renderCommandHelp(cmdDef);
    if (isJson) {
      printJson({ command: cmdDef.name, help: helpText });
    } else {
      console.log(helpText);
    }
    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { help: helpText },
    };
  }

  // 6. Resolve Subcommands if present
  let activeCmd = cmdDef;
  let remainingPositionals = parsed.positionals.slice(1);
  let parentName = `hurdler ${cmdDef.name}`;

  if (cmdDef.subcommands && remainingPositionals.length > 0) {
    const potentialSubName = remainingPositionals[0].toLowerCase();
    const subDef = findSubcommand(cmdDef, potentialSubName);

    if (subDef) {
      activeCmd = subDef;
      remainingPositionals = remainingPositionals.slice(1);

      // Handle subcommand --help
      if (parsed.globalOptions.help) {
        const helpText = renderCommandHelp(activeCmd, parentName);
        if (isJson) {
          printJson({ command: `${cmdDef.name} ${subDef.name}`, help: helpText });
        } else {
          console.log(helpText);
        }
        return {
          success: true,
          exitCode: ExitCode.SUCCESS,
          data: { help: helpText },
        };
      }
    }
  }

  // 7. Check if active command has a handler
  if (!activeCmd.handler) {
    const helpText = renderCommandHelp(activeCmd);
    if (isJson) {
      printJson({ error: 'Command has no handler', help: helpText });
    } else {
      console.log(helpText);
    }
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: `Command '${activeCmd.name}' requires a subcommand.`,
    };
  }

  // 8. Construct Execution Context
  const projectRoot = parsed.globalOptions.cwd ? path.resolve(parsed.globalOptions.cwd) : process.cwd();
  let envConfig;
  try {
    envConfig = getEnvConfig();
  } catch {
    envConfig = {} as any;
  }

  const context: CliContext = {
    cwd: process.cwd(),
    projectRoot,
    config: envConfig,
    isDev: isDevMode(),
    isJson,
    isQuiet,
  };

  const commandArgs: ParsedCliArgs = {
    positionals: remainingPositionals,
    options: parsed.options,
    globalOptions: parsed.globalOptions,
    rawArgs: parsed.rawArgs,
  };

  // 9. Execute Handler
  try {
    const result = await activeCmd.handler(commandArgs, context);

    if (isJson) {
      printJson(result);
    }

    await flushDevLogs().catch(() => {});
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    devError('CLI', `Command '${commandName}' failed: ${errorMsg}`, { error: err });

    const result: CliResult = {
      success: false,
      exitCode: ExitCode.ERROR,
      error: errorMsg,
    };

    if (isJson) {
      printJson(result);
    } else if (!isQuiet) {
      printError(errorMsg);
    }

    await flushDevLogs().catch(() => {});
    return result;
  }
}

/**
 * Looks up a top-level command in the registry by name or alias.
 */
function findCommand(name: string) {
  if (COMMAND_REGISTRY[name]) return COMMAND_REGISTRY[name];
  for (const cmd of Object.values(COMMAND_REGISTRY)) {
    if (cmd.aliases && cmd.aliases.includes(name)) {
      return cmd;
    }
  }
  return undefined;
}

/**
 * Looks up a subcommand in a parent command definition by name or alias.
 */
function findSubcommand(parent: typeof COMMAND_REGISTRY[string], subName: string) {
  if (!parent.subcommands) return undefined;
  if (parent.subcommands[subName]) return parent.subcommands[subName];
  for (const sub of Object.values(parent.subcommands)) {
    if (sub.aliases && sub.aliases.includes(subName)) {
      return sub;
    }
  }
  return undefined;
}

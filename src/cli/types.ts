/**
 * Hurdler CLI Subsystem - Type Definitions
 * Unified interfaces for arguments, options, results, commands, and context.
 */

import type { EnvConfig } from '../core/config/types.js';

/**
 * Standard exit codes for the Hurdler CLI.
 */
export enum ExitCode {
  SUCCESS = 0,
  ERROR = 1,
  INVALID_ARGUMENTS = 2,
  NOT_FOUND = 3,
  UNAUTHORIZED = 4,
}

/**
 * Global CLI options supported across all commands.
 */
export interface CliGlobalOptions {
  /** Enables verbose Dev Mode with non-blocking logging to disk */
  dev?: boolean;
  /** Emits structured JSON to stdout for machine consumption */
  json?: boolean;
  /** Displays command or general help text */
  help?: boolean;
  /** Displays Hurdler CLI version */
  version?: boolean;
  /** Suppresses non-essential log / banner output */
  quiet?: boolean;
  /** Working directory override */
  cwd?: string;
  /** Explicit config file path override */
  config?: string;
}

/**
 * Tokenized CLI arguments after initial parsing.
 */
export interface ParsedCliArgs {
  /** Positional arguments passed after command routing */
  positionals: string[];
  /** Named options/flags (e.g. `--model=claude-3-5`, `-f`) */
  options: Record<string, string | boolean | number | string[]>;
  /** Global flags extracted from arguments */
  globalOptions: CliGlobalOptions;
  /** Raw unparsed arguments following `--` separator */
  rawArgs: string[];
}

/**
 * Runtime execution context passed to command handlers.
 */
export interface CliContext {
  /** Current working directory */
  cwd: string;
  /** Root directory of the Hurdler project */
  projectRoot: string;
  /** Resolved global configuration */
  config: EnvConfig;
  /** Whether Dev Mode is currently activated */
  isDev: boolean;
  /** Whether JSON output mode is activated */
  isJson: boolean;
  /** Whether Quiet mode is activated */
  isQuiet: boolean;
}

/**
 * Standardized command execution result.
 */
export interface CliResult<T = unknown> {
  /** Indicates whether the command succeeded */
  success: boolean;
  /** Process exit code */
  exitCode: number;
  /** Optional payload data returned by command */
  data?: T;
  /** Human-readable status message */
  message?: string;
  /** Error message if command failed */
  error?: string;
  /** Optional suggestion for resolving issues */
  suggestion?: string;
}

/**
 * Specification for a command option/flag.
 */
export interface CliOptionSpec {
  /** Long option name (e.g. 'model') */
  name: string;
  /** Single-character alias (e.g. 'm') */
  alias?: string;
  /** Description for help generation */
  description: string;
  /** Value type expected */
  type: 'string' | 'boolean' | 'number' | 'array';
  /** Default value if not specified */
  defaultValue?: string | boolean | number | string[];
  /** Whether this option is required */
  required?: boolean;
}

/**
 * Specification for a positional argument.
 */
export interface CliArgumentSpec {
  /** Name of the positional argument (e.g. 'command', 'file') */
  name: string;
  /** Description of what this argument represents */
  description: string;
  /** Whether this argument is required */
  required?: boolean;
  /** Default value if omitted */
  defaultValue?: string;
}

/**
 * Handler function for a CLI command or subcommand.
 */
export type CliCommandHandler = (
  args: ParsedCliArgs,
  context: CliContext
) => Promise<CliResult>;

/**
 * Complete definition of a CLI command or subcommand.
 */
export interface CliCommandDefinition {
  /** Primary command name */
  name: string;
  /** Alternate aliases for command (e.g. 'ls' for 'list') */
  aliases?: string[];
  /** One-line summary for root help */
  summary: string;
  /** Detailed description for command help */
  description?: string;
  /** Usage syntax string (e.g. 'hurdler llms list [options]') */
  usage?: string;
  /** Positional arguments specification */
  arguments?: CliArgumentSpec[];
  /** Named options/flags specification */
  options?: CliOptionSpec[];
  /** Nested subcommands if this is a command group */
  subcommands?: Record<string, CliCommandDefinition>;
  /** Command handler function (for leaf commands or default group actions) */
  handler?: CliCommandHandler;
  /** Example usages for help documentation */
  examples?: string[];
}

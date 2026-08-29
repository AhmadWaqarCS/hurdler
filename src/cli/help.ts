/**
 * Hurdler CLI Subsystem - Help Text Generator
 */

import type { CliCommandDefinition, CliOptionSpec, CliArgumentSpec } from './types.js';

/**
 * Renders the global root help screen.
 */
export function renderRootHelp(registry: Record<string, CliCommandDefinition>): string {
  const lines: string[] = [
    '🏃 HURDLER - AI Agentic Software Engineering Platform',
    '',
    'Usage:',
    '  hurdler <command> [subcommand] [arguments...] [options...]',
    '',
    'Global Options:',
    '  --dev, -d          Enable Dev Mode diagnostics and non-blocking logging to disk',
    '  --json, -j         Emit structured JSON to stdout for machine consumption',
    '  --help, -h         Display help information for a command',
    '  --version, -v      Display Hurdler CLI version',
    '  --quiet, -q        Suppress non-essential log / banner output',
    '  --cwd <path>       Set working directory for command execution',
    '  --config <path>    Path to custom configuration file',
    '',
    'Available Commands:',
  ];

  const maxNameLen = Math.max(...Object.keys(registry).map((k) => k.length), 12);

  for (const [name, cmd] of Object.entries(registry)) {
    const padded = name.padEnd(maxNameLen + 2);
    lines.push(`  ${padded}${cmd.summary}`);
  }

  lines.push('');
  lines.push(`Run 'hurdler <command> --help' for details on a specific command group.`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Renders help for a specific command or command group.
 */
export function renderCommandHelp(
  cmd: CliCommandDefinition,
  parentName?: string
): string {
  const fullName = parentName ? `${parentName} ${cmd.name}` : `hurdler ${cmd.name}`;
  const lines: string[] = [];

  lines.push(`Command: ${fullName}`);
  if (cmd.summary) {
    lines.push(`Description: ${cmd.summary}`);
  }
  if (cmd.description) {
    lines.push(`\n${cmd.description}`);
  }

  lines.push('\nUsage:');
  if (cmd.usage) {
    lines.push(`  ${cmd.usage}`);
  } else if (cmd.subcommands && Object.keys(cmd.subcommands).length > 0) {
    lines.push(`  ${fullName} <subcommand> [options]`);
  } else {
    lines.push(`  ${fullName} [options]`);
  }

  if (cmd.aliases && cmd.aliases.length > 0) {
    lines.push(`\nAliases: ${cmd.aliases.join(', ')}`);
  }

  if (cmd.arguments && cmd.arguments.length > 0) {
    lines.push('\nArguments:');
    renderArgumentsHelp(lines, cmd.arguments);
  }

  if (cmd.subcommands && Object.keys(cmd.subcommands).length > 0) {
    lines.push('\nSubcommands:');
    const maxSubLen = Math.max(...Object.keys(cmd.subcommands).map((k) => k.length), 10);
    for (const [subName, subCmd] of Object.entries(cmd.subcommands)) {
      const padded = subName.padEnd(maxSubLen + 2);
      lines.push(`  ${padded}${subCmd.summary}`);
    }
  }

  if (cmd.options && cmd.options.length > 0) {
    lines.push('\nOptions:');
    renderOptionsHelp(lines, cmd.options);
  }

  if (cmd.examples && cmd.examples.length > 0) {
    lines.push('\nExamples:');
    for (const ex of cmd.examples) {
      lines.push(`  ${ex}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function renderArgumentsHelp(lines: string[], args: CliArgumentSpec[]): void {
  const maxLen = Math.max(...args.map((a) => a.name.length), 8);
  for (const arg of args) {
    const requiredStr = arg.required ? '(required)' : '(optional)';
    const padded = arg.name.padEnd(maxLen + 2);
    lines.push(`  ${padded}${arg.description} ${requiredStr}`);
  }
}

function renderOptionsHelp(lines: string[], options: CliOptionSpec[]): void {
  const formattedOpts = options.map((opt) => {
    const aliasStr = opt.alias ? `-${opt.alias}, ` : '    ';
    const nameStr = `--${opt.name}`;
    const typeStr = opt.type === 'boolean' ? '' : ` <${opt.type}>`;
    return {
      flagStr: `${aliasStr}${nameStr}${typeStr}`,
      desc: opt.description + (opt.defaultValue !== undefined ? ` (default: ${opt.defaultValue})` : ''),
    };
  });

  const maxLen = Math.max(...formattedOpts.map((f) => f.flagStr.length), 16);
  for (const opt of formattedOpts) {
    const padded = opt.flagStr.padEnd(maxLen + 2);
    lines.push(`  ${padded}${opt.desc}`);
  }
}

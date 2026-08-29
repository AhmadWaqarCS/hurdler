/**
 * Hurdler CLI Subsystem - Pure Functional Argument & Option Parser
 */

import type { ParsedCliArgs, CliGlobalOptions } from './types.js';

/**
 * Parses raw command-line argument strings into a structured ParsedCliArgs object.
 *
 * @param argv - Array of argument strings (typically `process.argv.slice(2)`).
 * @returns Tokenized and normalized CLI arguments.
 */
export function parseCliArgs(argv: string[] = []): ParsedCliArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean | number | string[]> = {};
  const globalOptions: CliGlobalOptions = {};
  const rawArgs: string[] = [];

  let inRawSection = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (inRawSection) {
      rawArgs.push(arg);
      continue;
    }

    if (arg === '--') {
      inRawSection = true;
      continue;
    }

    // Long option: --key or --key=value or --no-key
    if (arg.startsWith('--')) {
      const optionContent = arg.slice(2);
      let key = optionContent;
      let value: string | boolean | number = true;

      if (optionContent.startsWith('no-')) {
        key = optionContent.slice(3);
        value = false;
      } else if (optionContent.includes('=')) {
        const eqIdx = optionContent.indexOf('=');
        key = optionContent.slice(0, eqIdx);
        const rawVal = optionContent.slice(eqIdx + 1);
        value = parseOptionValue(rawVal);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        // Value in next argument if it doesn't start with '-'
        const nextArg = argv[i + 1];
        value = parseOptionValue(nextArg);
        i++; // Consume next argument
      }

      setParsedOption(options, key, value);
      applyGlobalOption(globalOptions, key, value);
      continue;
    }

    // Short option: -k or -k=value or -abc (grouped booleans)
    if (arg.startsWith('-') && arg.length > 1 && !arg.startsWith('---')) {
      const shortContent = arg.slice(1);

      if (shortContent.includes('=')) {
        const eqIdx = shortContent.indexOf('=');
        const key = shortContent.slice(0, eqIdx);
        const rawVal = shortContent.slice(eqIdx + 1);
        const value = parseOptionValue(rawVal);
        setParsedOption(options, key, value);
        applyShortGlobalOption(globalOptions, key, value);
      } else if (shortContent.length === 1) {
        let value: string | boolean | number = true;
        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          value = parseOptionValue(argv[i + 1]);
          i++; // Consume
        }
        setParsedOption(options, shortContent, value);
        applyShortGlobalOption(globalOptions, shortContent, value);
      } else {
        // Multi-flag boolean group e.g. -jvd -> -j, -v, -d
        for (const char of shortContent) {
          setParsedOption(options, char, true);
          applyShortGlobalOption(globalOptions, char, true);
        }
      }
      continue;
    }

    // Positional argument
    positionals.push(arg);
  }

  return {
    positionals,
    options,
    globalOptions,
    rawArgs,
  };
}

/**
 * Parses raw string value into boolean, number, or string.
 */
function parseOptionValue(val: string): string | boolean | number {
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;

  // Only parse as number if valid finite number and does not have leading 0 followed by digits (like 0123)
  if (/^-?\d+(\.\d+)?$/.test(val)) {
    const num = Number(val);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      return num;
    }
  }

  return val;
}

/**
 * Sets an option in the options map, appending to an array if key already exists.
 */
function setParsedOption(
  options: Record<string, string | boolean | number | string[]>,
  key: string,
  value: string | boolean | number
): void {
  const existing = options[key];
  if (existing === undefined) {
    options[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(String(value));
  } else {
    options[key] = [String(existing), String(value)];
  }
}

/**
 * Applies recognized long global flags to CliGlobalOptions.
 */
function applyGlobalOption(
  globalOptions: CliGlobalOptions,
  key: string,
  value: string | boolean | number
): void {
  switch (key) {
    case 'dev':
      globalOptions.dev = Boolean(value);
      break;
    case 'json':
      globalOptions.json = Boolean(value);
      break;
    case 'help':
      globalOptions.help = Boolean(value);
      break;
    case 'version':
      globalOptions.version = Boolean(value);
      break;
    case 'quiet':
      globalOptions.quiet = Boolean(value);
      break;
    case 'cwd':
      globalOptions.cwd = String(value);
      break;
    case 'config':
      globalOptions.config = String(value);
      break;
  }
}

/**
 * Applies recognized short flags to CliGlobalOptions.
 */
function applyShortGlobalOption(
  globalOptions: CliGlobalOptions,
  key: string,
  value: string | boolean | number
): void {
  switch (key) {
    case 'd':
      globalOptions.dev = Boolean(value);
      break;
    case 'j':
      globalOptions.json = Boolean(value);
      break;
    case 'h':
      globalOptions.help = Boolean(value);
      break;
    case 'v':
      globalOptions.version = Boolean(value);
      break;
    case 'q':
      globalOptions.quiet = Boolean(value);
      break;
  }
}

/**
 * Utility helper to safely get a string option from options dictionary.
 */
export function getOptionString(
  options: Record<string, unknown>,
  key: string,
  alias?: string,
  defaultValue?: string
): string | undefined {
  const val = options[key] ?? (alias ? options[alias] : undefined);
  if (val === undefined || val === null) return defaultValue;
  if (Array.isArray(val)) return val[0] !== undefined ? String(val[0]) : defaultValue;
  return String(val);
}

/**
 * Utility helper to safely get a boolean option from options dictionary.
 */
export function getOptionBoolean(
  options: Record<string, unknown>,
  key: string,
  alias?: string,
  defaultValue = false
): boolean {
  const val = options[key] ?? (alias ? options[alias] : undefined);
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true' || val === '1') return true;
    if (val.toLowerCase() === 'false' || val === '0') return false;
  }
  return Boolean(val);
}

/**
 * Utility helper to safely get a number option from options dictionary.
 */
export function getOptionNumber(
  options: Record<string, unknown>,
  key: string,
  alias?: string,
  defaultValue?: number
): number | undefined {
  const val = options[key] ?? (alias ? options[alias] : undefined);
  if (val === undefined || val === null) return defaultValue;
  const num = Number(val);
  return Number.isFinite(num) ? num : defaultValue;
}

/**
 * Utility helper to safely get an array option from options dictionary.
 */
export function getOptionArray(
  options: Record<string, unknown>,
  key: string,
  alias?: string,
  defaultValue: string[] = []
): string[] {
  const val = options[key] ?? (alias ? options[alias] : undefined);
  if (val === undefined || val === null) return defaultValue;
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    return val.includes(',') ? val.split(',').map((s) => s.trim()) : [val.trim()];
  }
  return [String(val)];
}

/**
 * Utility helper to parse a JSON object option from a string or file reference.
 */
export function getOptionJson<T = Record<string, unknown>>(
  options: Record<string, unknown>,
  key: string,
  alias?: string
): T | undefined {
  const val = getOptionString(options, key, alias);
  if (!val) return undefined;
  try {
    return JSON.parse(val) as T;
  } catch (err) {
    throw new Error(`Failed to parse JSON option '--${key}': ${err instanceof Error ? err.message : String(err)}`);
  }
}

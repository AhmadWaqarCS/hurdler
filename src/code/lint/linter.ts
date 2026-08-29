import fs from 'node:fs/promises';
import { ESLint } from 'eslint';
import type {
  LintTextOptions,
  LintFileOptions,
  LintFilesOptions,
  LintResult,
  LintFixResult,
  LintMessage,
} from './types.js';
import { LintTextOptionsSchema, LintFileOptionsSchema, LintFilesOptionsSchema } from '../schema.js';
import { LintError } from '../errors.js';
import { createDefaultLintConfig } from './config.js';
import { sanitizeCodeFilePath, fileExists } from '../helpers.js';
import { devInfo, devError } from '../../core/dev-mode/index.js';

/**
 * Creates an ESLint instance configured with built-in default config or custom rules.
 */
function createESLintInstance(options: {
  fix?: boolean;
  ruleOverrides?: Record<string, unknown>;
  projectRoot?: string;
} = {}): ESLint {
  const baseConfig = createDefaultLintConfig({
    ruleOverrides: options.ruleOverrides,
    projectRoot: options.projectRoot,
  });

  return new ESLint({
    fix: Boolean(options.fix),
    overrideConfigFile: true,
    overrideConfig: baseConfig,
  });
}

/**
 * Maps raw ESLint messages to Hurdler LintMessage.
 */
function mapESLintMessages(messages: any[]): LintMessage[] {
  return messages.map((m) => ({
    ruleId: m.ruleId ?? null,
    severity: m.severity as 1 | 2,
    severityText: m.severity === 2 ? 'error' : 'warning',
    message: m.message,
    line: m.line ?? 1,
    column: m.column ?? 1,
    endLine: m.endLine,
    endColumn: m.endColumn,
    fatal: Boolean(m.fatal),
    fix: m.fix,
    suggestions: m.suggestions,
  }));
}

/**
 * Lints a string of code in-memory without requiring disk writes.
 */
export async function lintText(code: string, options: LintTextOptions = {}): Promise<LintResult> {
  const parsedOptions = LintTextOptionsSchema.parse(options);
  const eslint = createESLintInstance({
    fix: parsedOptions.fix,
    ruleOverrides: parsedOptions.ruleOverrides,
    projectRoot: parsedOptions.projectRoot,
  });

  const filePath = parsedOptions.filePath ?? 'snippet.ts';

  try {
    const rawResults = await eslint.lintText(code, {
      filePath,
      warnIgnored: false,
    });

    const firstResult = rawResults[0];
    if (!firstResult) {
      return {
        filePath,
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        messages: [],
        source: code,
      };
    }

    const messages = mapESLintMessages(firstResult.messages);
    const isValid = firstResult.errorCount === 0;

    const result: LintResult = {
      filePath,
      isValid,
      errorCount: firstResult.errorCount,
      warningCount: firstResult.warningCount,
      fixableErrorCount: firstResult.fixableErrorCount,
      fixableWarningCount: firstResult.fixableWarningCount,
      messages,
      output: firstResult.output,
      source: code,
    };

    if (!isValid) {
      devInfo('LINT_TEXT', `Linted "${filePath}" with ${result.errorCount} error(s) and ${result.warningCount} warning(s)`);
    }

    return result;
  } catch (err: any) {
    devError('LINT_TEXT_FAILED', `Failed to lint text for ${filePath}: ${err.message}`);
    throw new LintError(`Linting failed for ${filePath}: ${err.message}`, {
      filePath,
      cause: err,
    });
  }
}

/**
 * Lints a file located on disk.
 */
export async function lintFile(filePath: string, options: LintFileOptions = {}): Promise<LintResult> {
  const parsedOptions = LintFileOptionsSchema.parse(options);
  const resolvedPath = sanitizeCodeFilePath(filePath, parsedOptions.projectRoot);

  if (!fileExists(resolvedPath)) {
    throw new LintError(`File does not exist: ${resolvedPath}`, { filePath: resolvedPath });
  }

  const content = await fs.readFile(resolvedPath, 'utf8');
  const eslint = createESLintInstance({
    fix: parsedOptions.fix,
    ruleOverrides: parsedOptions.ruleOverrides,
    projectRoot: parsedOptions.projectRoot,
  });

  try {
    const rawResults = await eslint.lintFiles([resolvedPath]);
    const firstResult = rawResults[0];

    if (!firstResult) {
      return {
        filePath: resolvedPath,
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        messages: [],
        source: content,
      };
    }

    // If autofix was requested and changes were made, write them back
    if (parsedOptions.fix && firstResult.output && firstResult.output !== content) {
      await ESLint.outputFixes(rawResults);
    }

    const messages = mapESLintMessages(firstResult.messages);
    const isValid = firstResult.errorCount === 0;

    const result: LintResult = {
      filePath: resolvedPath,
      isValid,
      errorCount: firstResult.errorCount,
      warningCount: firstResult.warningCount,
      fixableErrorCount: firstResult.fixableErrorCount,
      fixableWarningCount: firstResult.fixableWarningCount,
      messages,
      output: firstResult.output,
      source: firstResult.output ?? content,
    };

    devInfo(
      'LINT_FILE',
      `Linted file "${resolvedPath}": ${isValid ? 'PASSED' : 'FAILED'} (${result.errorCount} errors, ${result.warningCount} warnings)`
    );

    return result;
  } catch (err: any) {
    devError('LINT_FILE_FAILED', `Failed to lint file ${resolvedPath}: ${err.message}`);
    throw new LintError(`Failed to lint file ${resolvedPath}: ${err.message}`, {
      filePath: resolvedPath,
      cause: err,
    });
  }
}

/**
 * Lints multiple files in batch with concurrency control.
 */
export async function lintFiles(
  filePaths: string[],
  options: LintFilesOptions = {}
): Promise<LintResult[]> {
  const parsedOptions = LintFilesOptionsSchema.parse(options);
  const concurrency = parsedOptions.concurrency ?? 4;
  const results: LintResult[] = new Array(filePaths.length);

  for (let i = 0; i < filePaths.length; i += concurrency) {
    const chunk = filePaths.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (filePath, idx) => {
      const globalIdx = i + idx;
      try {
        const res = await lintFile(filePath, {
          fix: parsedOptions.fix,
          projectRoot: parsedOptions.projectRoot,
          ruleOverrides: parsedOptions.ruleOverrides,
        });
        results[globalIdx] = res;
      } catch (err: any) {
        results[globalIdx] = {
          filePath,
          isValid: false,
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          messages: [
            {
              ruleId: 'hurdler/lint-exception',
              severity: 2,
              severityText: 'error',
              message: err.message,
              line: 1,
              column: 1,
            },
          ],
        };
      }
    });
    await Promise.all(chunkPromises);
  }

  return results;
}

/**
 * In-memory automatic fixing of lint errors.
 */
export async function fixLintText(code: string, options: LintTextOptions = {}): Promise<LintFixResult> {
  const result = await lintText(code, { ...options, fix: true });
  const output = result.output ?? code;
  const fixed = output !== code;

  return {
    filePath: result.filePath,
    fixed,
    output,
    remainingErrors: result.messages.filter((m) => m.severity === 2),
    errorCount: result.errorCount,
    warningCount: result.warningCount,
  };
}

/**
 * Automatically fixes lint errors on disk for a single file.
 */
export async function fixLintFile(filePath: string, options: LintFileOptions = {}): Promise<LintFixResult> {
  const result = await lintFile(filePath, { ...options, fix: true });
  const content = await fs.readFile(result.filePath ?? filePath, 'utf8');

  return {
    filePath: result.filePath,
    fixed: Boolean(result.output && result.output !== result.source),
    output: content,
    remainingErrors: result.messages.filter((m) => m.severity === 2),
    errorCount: result.errorCount,
    warningCount: result.warningCount,
  };
}

/**
 * Checks whether a code snippet or disk file contains any lint errors.
 *
 * @param codeOrPath - In-memory code string or file path on disk.
 * @param options - Optional linting options.
 * @returns Promise resolving to true if lint errors exist, false otherwise.
 */
export async function hasLintErrors(
  codeOrPath: string,
  options: LintTextOptions & LintFileOptions = {}
): Promise<boolean> {
  const isDiskFile = !codeOrPath.includes('\n') && codeOrPath.length < 500 && fileExists(codeOrPath);
  if (isDiskFile) {
    const res = await lintFile(codeOrPath, options);
    return !res.isValid || res.errorCount > 0;
  }
  const res = await lintText(codeOrPath, options);
  return !res.isValid || res.errorCount > 0;
}


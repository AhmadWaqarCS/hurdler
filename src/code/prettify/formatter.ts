import fs from 'node:fs/promises';
import prettier from 'prettier';
import type {
  PrettifyOptions,
  PrettifyFileOptions,
  PrettifyFilesOptions,
  PrettifyFileResult,
  PrettifyFilesResult,
} from './types.js';
import {
  PrettifyOptionsSchema,
  PrettifyFileOptionsSchema,
  PrettifyFilesOptionsSchema,
} from '../schema.js';
import { PrettierError } from '../errors.js';
import { resolvePrettierOptions } from './config.js';
import { sanitizeCodeFilePath, inferPrettierParser, fileExists } from '../helpers.js';
import { devInfo, devError } from '../../core/dev-mode/index.js';

/**
 * Prettifies code in-memory.
 */
export async function prettifyCode(code: string, options: PrettifyOptions = {}): Promise<string> {
  const parsed = PrettifyOptionsSchema.parse(options);
  const resolved = await resolvePrettierOptions(parsed.filePath, parsed);
  const parser = resolved.parser ?? (parsed.filePath ? inferPrettierParser(parsed.filePath) : 'typescript');

  try {
    const formatted = await prettier.format(code, {
      ...resolved,
      parser,
    });
    return formatted;
  } catch (err: any) {
    devError('PRETTIER_FORMAT_FAILED', `Prettify failed: ${err.message}`);
    throw new PrettierError(`Failed to format code: ${err.message}`, {
      filePath: parsed.filePath,
      cause: err,
    });
  }
}

/**
 * Checks if code in-memory is properly formatted.
 */
export async function checkPrettified(code: string, options: PrettifyOptions = {}): Promise<boolean> {
  const parsed = PrettifyOptionsSchema.parse(options);
  const resolved = await resolvePrettierOptions(parsed.filePath, parsed);
  const parser = resolved.parser ?? (parsed.filePath ? inferPrettierParser(parsed.filePath) : 'typescript');

  try {
    return await prettier.check(code, {
      ...resolved,
      parser,
    });
  } catch {
    return false;
  }
}

/**
 * Prettifies a single file on disk.
 */
export async function prettifyFile(
  filePath: string,
  options: PrettifyFileOptions = {}
): Promise<PrettifyFileResult> {
  const parsed = PrettifyFileOptionsSchema.parse(options);
  const resolvedPath = sanitizeCodeFilePath(filePath, parsed.projectRoot);

  if (!fileExists(resolvedPath)) {
    throw new PrettierError(`File does not exist: ${resolvedPath}`, { filePath: resolvedPath });
  }

  try {
    const originalContent = await fs.readFile(resolvedPath, 'utf8');
    const formattedContent = await prettifyCode(originalContent, {
      ...parsed.options,
      filePath: resolvedPath,
    });

    const isDifferent = originalContent !== formattedContent;

    if (parsed.overwrite && isDifferent) {
      await fs.writeFile(resolvedPath, formattedContent, 'utf8');
      devInfo('PRETTIER_FILE', `Formatted file: ${resolvedPath}`);
    }

    return {
      filePath: resolvedPath,
      formatted: isDifferent,
      content: formattedContent,
    };
  } catch (err: any) {
    devError('PRETTIER_FILE_FAILED', `Failed to prettify file ${resolvedPath}: ${err.message}`);
    if (err instanceof PrettierError) throw err;
    throw new PrettierError(`Failed to prettify file ${resolvedPath}: ${err.message}`, {
      filePath: resolvedPath,
      cause: err,
    });
  }
}

/**
 * Checks if a single file on disk is properly formatted.
 */
export async function checkFilePrettified(filePath: string): Promise<boolean> {
  const resolvedPath = sanitizeCodeFilePath(filePath);
  if (!fileExists(resolvedPath)) {
    return false;
  }

  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    return await checkPrettified(content, { filePath: resolvedPath });
  } catch {
    return false;
  }
}

/**
 * Prettifies multiple files in batch.
 */
export async function prettifyFiles(
  filePaths: string[],
  options: PrettifyFilesOptions = {}
): Promise<PrettifyFilesResult> {
  const parsed = PrettifyFilesOptionsSchema.parse(options);
  const formattedFiles: string[] = [];
  const unchangedFiles: string[] = [];
  const failedFiles: Array<{ filePath: string; error: string }> = [];

  for (const filePath of filePaths) {
    try {
      const res = await prettifyFile(filePath, {
        overwrite: parsed.overwrite,
        projectRoot: parsed.projectRoot,
        options: parsed.options,
      });

      if (res.formatted) {
        formattedFiles.push(res.filePath);
      } else {
        unchangedFiles.push(res.filePath);
      }
    } catch (err: any) {
      failedFiles.push({
        filePath,
        error: err.message,
      });
    }
  }

  return {
    totalFiles: filePaths.length,
    formattedFiles,
    unchangedFiles,
    failedFiles,
    success: failedFiles.length === 0,
  };
}

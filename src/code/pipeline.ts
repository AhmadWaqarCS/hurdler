import fs from 'node:fs/promises';
import type {
  ValidateAndPrettifyOptions,
  ValidateAndPrettifyResult,
  CodeContextOptions,
  CodeContextResult,
  BatchValidateAndPrettifyOptions,
  BatchValidateAndPrettifyResult,
} from './types.js';
import {
  ValidateAndPrettifyOptionsSchema,
  CodeContextOptionsSchema,
  BatchValidateAndPrettifyOptionsSchema,
} from './schema.js';
import { lintText, lintFile } from './lint/linter.js';
import { formatLintForLLM } from './lint/formatter.js';
import { prettifyCode, prettifyFile } from './prettify/formatter.js';
import { inspectSourceCode, inspectSourceFile } from './ast/ts-morph/inspector.js';
import { generateFileOutline } from './ast/ts-morph/outline.js';
import { compareSourceAst } from './ast/ts-morph/diff-context.js';
import { fileExists, sanitizeCodeFilePath } from './helpers.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Validates (lints) and prettifies code in a unified pipeline.
 * If lint passes without errors, formats code with Prettier.
 * If lint fails, returns diagnostic messages and guidance for LLM debug agents.
 */
export async function validateAndPrettify(
  codeOrPath: string,
  options: ValidateAndPrettifyOptions = {}
): Promise<ValidateAndPrettifyResult> {
  const parsed = ValidateAndPrettifyOptionsSchema.parse(options);
  const isDiskFile = !codeOrPath.includes('\n') && codeOrPath.length < 500 && fileExists(codeOrPath);

  if (isDiskFile) {
    const resolvedPath = sanitizeCodeFilePath(codeOrPath, parsed.projectRoot);
    const lintRes = await lintFile(resolvedPath, {
      fix: parsed.fixLint,
      projectRoot: parsed.projectRoot,
      ruleOverrides: parsed.ruleOverrides,
    });

    if (!lintRes.isValid) {
      const summary = formatLintForLLM(lintRes);
      return {
        filePath: resolvedPath,
        isValid: false,
        formatted: false,
        output: lintRes.output ?? (await fs.readFile(resolvedPath, 'utf8')),
        errorCount: lintRes.errorCount,
        warningCount: lintRes.warningCount,
        messages: lintRes.messages,
        llmDiagnosticSummary: summary,
      };
    }

    const prettifyRes = await prettifyFile(resolvedPath, {
      overwrite: true,
      projectRoot: parsed.projectRoot,
      options: parsed.prettierOptions,
    });

    return {
      filePath: resolvedPath,
      isValid: true,
      formatted: prettifyRes.formatted,
      output: prettifyRes.content,
      errorCount: lintRes.errorCount,
      warningCount: lintRes.warningCount,
      messages: lintRes.messages,
    };
  }

  // In-memory code
  const lintRes = await lintText(codeOrPath, {
    fix: parsed.fixLint,
    projectRoot: parsed.projectRoot,
    ruleOverrides: parsed.ruleOverrides,
  });

  const intermediateCode = lintRes.output ?? codeOrPath;

  if (!lintRes.isValid) {
    const summary = formatLintForLLM(lintRes);
    return {
      isValid: false,
      formatted: false,
      output: intermediateCode,
      errorCount: lintRes.errorCount,
      warningCount: lintRes.warningCount,
      messages: lintRes.messages,
      llmDiagnosticSummary: summary,
    };
  }

  const formattedCode = await prettifyCode(intermediateCode, parsed.prettierOptions);

  devInfo('PIPELINE_VALIDATE_PRETTIFY', `Validated and prettified code successfully (${lintRes.warningCount} warnings)`);

  return {
    isValid: true,
    formatted: formattedCode !== codeOrPath,
    output: formattedCode,
    errorCount: lintRes.errorCount,
    warningCount: lintRes.warningCount,
    messages: lintRes.messages,
  };
}

/**
 * Concurrently validates and prettifies multiple files on disk in batch.
 * If lint passes, formats with Prettier. If lint fails, returns diagnostic messages.
 */
export async function batchValidateAndPrettify(
  filePaths: string[],
  options: BatchValidateAndPrettifyOptions = {}
): Promise<BatchValidateAndPrettifyResult> {
  const parsed = BatchValidateAndPrettifyOptionsSchema.parse(options);
  const concurrency = parsed.concurrency ?? 4;
  const validFiles: string[] = [];
  const formattedFiles: string[] = [];
  const invalidFiles: Array<{
    filePath: string;
    errorCount: number;
    warningCount: number;
    messages: any[];
    llmDiagnosticSummary?: string;
  }> = [];

  for (let i = 0; i < filePaths.length; i += concurrency) {
    const chunk = filePaths.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (filePath) => {
      try {
        const res = await validateAndPrettify(filePath, {
          fixLint: parsed.fixLint,
          projectRoot: parsed.projectRoot,
          ruleOverrides: parsed.ruleOverrides,
          prettierOptions: parsed.prettierOptions,
        });

        if (res.isValid) {
          validFiles.push(filePath);
          if (res.formatted) {
            formattedFiles.push(filePath);
          }
        } else {
          invalidFiles.push({
            filePath,
            errorCount: res.errorCount,
            warningCount: res.warningCount,
            messages: res.messages,
            llmDiagnosticSummary: res.llmDiagnosticSummary,
          });
        }
      } catch (err: any) {
        invalidFiles.push({
          filePath,
          errorCount: 1,
          warningCount: 0,
          messages: [],
          llmDiagnosticSummary: `Pipeline exception on file: ${err.message}`,
        });
      }
    });
    await Promise.all(chunkPromises);
  }

  return {
    totalFiles: filePaths.length,
    validFiles,
    invalidFiles,
    formattedFiles,
    success: invalidFiles.length === 0,
  };
}

/**
 * Convenient alias for validateAndPrettify.
 */
export const lintAndPrettify = validateAndPrettify;

/**
 * Generates rich AST context (outline, symbol tree, diffs) for LLM prompts.
 */
export async function generateCodeContext(
  codeOrPath: string,
  options: CodeContextOptions = {}
): Promise<CodeContextResult> {
  const parsed = CodeContextOptionsSchema.parse(options);
  const isDiskFile = !codeOrPath.includes('\n') && codeOrPath.length < 500 && fileExists(codeOrPath);

  const filePath = isDiskFile ? codeOrPath : parsed.filePath ?? 'snippet.ts';
  const code = isDiskFile ? await fs.readFile(codeOrPath, 'utf8') : codeOrPath;

  const inspection = isDiskFile ? inspectSourceFile(filePath) : inspectSourceCode(code, filePath);
  const outline = generateFileOutline(code, { detailLevel: 'standard' });

  let astDiff;
  if (parsed.includeDiffFrom) {
    astDiff = compareSourceAst(parsed.includeDiffFrom, code, filePath);
  }

  return {
    filePath,
    outlineMarkdown: outline.markdown,
    inspection,
    astDiff,
  };
}


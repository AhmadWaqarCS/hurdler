/**
 * Hurdler CLI Subsystem - Code Engine Command
 * ESLint automated linting, Prettier formatting, AST inspection, symbol outlines, and full pipeline execution.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import {
  printHeader,
  printSuccess,
  printKeyValues,
  printCode,
} from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import { codeService } from '../../code/service.js';
import { getOptionBoolean, getOptionArray } from '../parser.js';

export const handleCodeLint: CliCommandHandler = async (args, ctx) => {
  const fileArgs = args.positionals.length > 0 ? args.positionals : getOptionArray(args.options, 'files', 'f');
  const fix = getOptionBoolean(args.options, 'fix', undefined, false);

  const targetFiles = fileArgs.length > 0 ? fileArgs : ['src/index.ts'];

  try {
    const results = await codeService.lint.files(targetFiles, { fix, projectRoot: ctx.projectRoot });
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const r of results) {
      totalErrors += r.errorCount;
      totalWarnings += r.warningCount;
    }

    if (!ctx.isJson) {
      printHeader(`ESLint Analysis (${results.length} files checked)`);
      printKeyValues({
        'Total Files': results.length,
        'Total Errors': totalErrors,
        'Total Warnings': totalWarnings,
        'Auto-Fix Mode': fix ? 'Enabled' : 'Disabled',
      });

      for (const res of results) {
        if (res.messages.length > 0) {
          console.log(`\n📄 ${res.filePath}:`);
          for (const msg of res.messages) {
            const level = msg.severity === 2 ? '❌ ERROR' : '⚠️ WARN';
            console.log(`  ${level} [${msg.line}:${msg.column}] ${msg.message} (${msg.ruleId || 'syntax'})`);
          }
        }
      }

      if (totalErrors === 0 && totalWarnings === 0) {
        printSuccess('All files passed ESLint checks with 0 errors.');
      }
    }

    return {
      success: totalErrors === 0,
      exitCode: totalErrors === 0 ? ExitCode.SUCCESS : ExitCode.ERROR,
      data: {
        totalFiles: results.length,
        totalErrors,
        totalWarnings,
        results,
      },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Linting failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleCodePrettify: CliCommandHandler = async (args, ctx) => {
  const fileArgs = args.positionals.length > 0 ? args.positionals : getOptionArray(args.options, 'files', 'f');
  const write = getOptionBoolean(args.options, 'write', 'w', false);
  const targetFiles = fileArgs.length > 0 ? fileArgs : ['src/index.ts'];

  try {
    const results = await codeService.prettier.formatFiles(targetFiles, { overwrite: write, projectRoot: ctx.projectRoot });

    if (!ctx.isJson) {
      printHeader(`Prettier Formatting Check (${results.totalFiles} files)`);
      for (const file of results.formattedFiles) {
        console.log(`  ✨ ${file} (formatted)`);
      }
      for (const file of results.unchangedFiles) {
        console.log(`  ✓ ${file} (properly formatted)`);
      }
      for (const fail of results.failedFiles) {
        console.log(`  ❌ ${fail.filePath} (${fail.error})`);
      }
    }

    return {
      success: results.success,
      exitCode: results.success ? ExitCode.SUCCESS : ExitCode.ERROR,
      data: results,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Prettify failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleCodePipeline: CliCommandHandler = async (args, ctx) => {
  const fileArgs = args.positionals.length > 0 ? args.positionals : getOptionArray(args.options, 'files', 'f');
  const targetFiles = fileArgs.length > 0 ? fileArgs : ['src/index.ts'];

  try {
    const result = await codeService.pipeline.batchValidateAndPrettify(targetFiles, {
      projectRoot: ctx.projectRoot,
      fixLint: true,
    });

    if (!ctx.isJson) {
      printHeader(`Code Processing Pipeline (${result.totalFiles} files)`);
      for (const valid of result.validFiles) {
        console.log(`  ✅ PASSED ${valid}`);
      }
      for (const invalid of result.invalidFiles) {
        console.log(`  ❌ FAILED ${invalid.filePath} (Errors: ${invalid.errorCount}, Warnings: ${invalid.warningCount})`);
      }
      for (const formatted of result.formattedFiles) {
        console.log(`  ✨ FORMATTED ${formatted}`);
      }
    }

    return {
      success: result.success,
      exitCode: result.success ? ExitCode.SUCCESS : ExitCode.ERROR,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Pipeline execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleCodeAstInspect: CliCommandHandler = async (args, ctx) => {
  const targetFile = args.positionals[0];
  if (!targetFile) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing file path for AST inspection.',
      suggestion: 'Usage: hurdler code ast inspect <file.ts>',
    };
  }

  try {
    const fullPath = path.resolve(ctx.projectRoot || process.cwd(), targetFile);
    const code = await fs.readFile(fullPath, 'utf-8');
    const result = codeService.ast.inspectText(code, targetFile);

    if (!ctx.isJson) {
      printHeader(`AST Structural Inspection: ${targetFile}`);
      printKeyValues({
        'Total Lines': result.totalLines,
        'Functions / Methods': result.functions.length,
        'Classes': result.classes.length,
        'Interfaces': result.interfaces.length,
        'Imports': result.imports.length,
        'Exports': result.exports.length,
      });

      if (result.functions.length > 0) {
        console.log('\n⚡ Functions & Methods:');
        const fnRows = result.functions.map((f) => ({
          name: f.name,
          async: f.isAsync ? 'async' : 'sync',
          params: (f.parameters || []).map((p) => p.name).join(', '),
          returnType: f.returnType || 'void',
          lines: `${f.lineStart}-${f.lineEnd}`,
        }));

        console.log(
          formatTable(
            fnRows,
            [
              { key: 'name', label: 'Function Name', minWidth: 24 },
              { key: 'async', label: 'Async', minWidth: 8 },
              { key: 'params', label: 'Parameters', maxWidth: 30, minWidth: 15 },
              { key: 'returnType', label: 'Return Type', minWidth: 14 },
              { key: 'lines', label: 'Lines', align: 'right', minWidth: 10 },
            ],
            { indent: '  ' }
          )
        );
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `AST Inspection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleCodeAstOutline: CliCommandHandler = async (args, ctx) => {
  const targetFile = args.positionals[0];
  if (!targetFile) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing file path for symbol outline.',
      suggestion: 'Usage: hurdler code ast outline <file.ts>',
    };
  }

  try {
    const fullPath = path.resolve(ctx.projectRoot || process.cwd(), targetFile);
    const outline = await codeService.ast.outline(fullPath);

    if (!ctx.isJson) {
      printHeader(`Symbol Outline: ${targetFile}`);
      printCode(outline.markdown, 'typescript');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { file: targetFile, outline },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Outline extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleCodeAstDiff: CliCommandHandler = async (args, ctx) => {
  const targetFile = args.positionals[0];
  if (!targetFile) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing file path for AST diff.',
      suggestion: 'Usage: hurdler code ast diff <file.ts>',
    };
  }

  try {
    const fullPath = path.resolve(ctx.projectRoot || process.cwd(), targetFile);
    const currentCode = await fs.readFile(fullPath, 'utf-8');
    const diff = codeService.ast.compare(currentCode, currentCode, targetFile);
    const diffContext = codeService.ast.formatDiff(diff);

    if (!ctx.isJson) {
      printHeader(`AST Structural Diff: ${targetFile}`);
      console.log(diffContext || 'No structural changes detected.');
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { file: targetFile, diffContext },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `AST Diff failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const codeCommandDefinition: CliCommandDefinition = {
  name: 'code',
  summary: 'Lint, format, inspect ASTs, and execute automated code pipelines',
  description: 'ESLint static analysis, Prettier formatting, Tree-sitter & TS-Morph AST symbol inspection and outlines.',
  usage: 'hurdler code <lint|prettify|pipeline|ast> [args] [options]',
  handler: handleCodeLint,
  subcommands: {
    lint: {
      name: 'lint',
      summary: 'Run ESLint static analysis and reporting',
      usage: 'hurdler code lint [files...] [--fix]',
      options: [{ name: 'fix', alias: 'f', description: 'Automatically fix autofixable lint errors', type: 'boolean' }],
      handler: handleCodeLint,
    },
    prettify: {
      name: 'prettify',
      summary: 'Check or apply Prettier code formatting',
      usage: 'hurdler code prettify [files...] [--write]',
      options: [{ name: 'write', alias: 'w', description: 'Write formatted code directly to files', type: 'boolean' }],
      handler: handleCodePrettify,
    },
    pipeline: {
      name: 'pipeline',
      summary: 'Execute full validation pipeline (lint -> fix -> prettify -> ast)',
      usage: 'hurdler code pipeline [files...]',
      handler: handleCodePipeline,
    },
    ast: {
      name: 'ast',
      summary: 'AST analysis, symbol outlines, and syntax trees',
      usage: 'hurdler code ast <inspect|outline|diff> <file>',
      subcommands: {
        inspect: {
          name: 'inspect',
          summary: 'Inspect AST symbol hierarchy and functions',
          usage: 'hurdler code ast inspect <file>',
          arguments: [{ name: 'file', description: 'File path to inspect', required: true }],
          handler: handleCodeAstInspect,
        },
        outline: {
          name: 'outline',
          summary: 'Generate compact symbol outline for LLM context',
          usage: 'hurdler code ast outline <file>',
          arguments: [{ name: 'file', description: 'File path', required: true }],
          handler: handleCodeAstOutline,
        },
        diff: {
          name: 'diff',
          summary: 'Generate AST-aware symbol diff',
          usage: 'hurdler code ast diff <file>',
          arguments: [{ name: 'file', description: 'File path', required: true }],
          handler: handleCodeAstDiff,
        },
      },
    },
  },
  examples: [
    'hurdler code lint src/index.ts --fix',
    'hurdler code prettify src/index.ts --write',
    'hurdler code pipeline src/cli/router.ts',
    'hurdler code ast inspect src/core/config/env.ts',
    'hurdler code ast outline src/git/service.ts',
  ],
};

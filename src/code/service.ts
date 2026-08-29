import { lintText, lintFile, lintFiles, fixLintText, fixLintFile } from './lint/linter.js';
import { formatLintForLLM, formatLintSummary } from './lint/formatter.js';
import {
  prettifyCode,
  prettifyFile,
  prettifyFiles,
  checkPrettified,
  checkFilePrettified,
} from './prettify/formatter.js';
import { inspectSourceCode, inspectSourceFile } from './ast/ts-morph/inspector.js';
import { generateFileOutline, generateCodebaseOutline } from './ast/ts-morph/outline.js';
import { compareSourceAst } from './ast/ts-morph/diff-context.js';
import { parseWithTreeSitter, generateSExpression, traverseSyntaxTree, findNodesByType } from './ast/tree-sitter/inspector.js';
import { executeTreeSitterQuery } from './ast/tree-sitter/queries.js';
import { getTreeSitterParser } from './ast/tree-sitter/parser.js';
import { validateAndPrettify, generateCodeContext } from './pipeline.js';

/**
 * Functional Code Service providing a unified interface across all Lint, Prettify, and AST subsystems.
 */
export const codeService = {
  // ESLint Subsystem
  lint: {
    text: lintText,
    file: lintFile,
    files: lintFiles,
    fixText: fixLintText,
    fixFile: fixLintFile,
    formatForLLM: formatLintForLLM,
    formatSummary: formatLintSummary,
  },

  // Prettier Subsystem
  prettier: {
    format: prettifyCode,
    formatFile: prettifyFile,
    formatFiles: prettifyFiles,
    check: checkPrettified,
    checkFile: checkFilePrettified,
  },

  // AST & Outline Subsystem
  ast: {
    inspectText: inspectSourceCode,
    inspectFile: inspectSourceFile,
    outline: generateFileOutline,
    codebaseOutline: generateCodebaseOutline,
    compare: compareSourceAst,
    treeSitter: {
      parse: parseWithTreeSitter,
      sExpression: generateSExpression,
      traverse: traverseSyntaxTree,
      findNodes: findNodesByType,
      query: executeTreeSitterQuery,
      getParser: getTreeSitterParser,
    },
  },

  // Integrated Pipelines
  pipeline: {
    validateAndPrettify,
    generateContext: generateCodeContext,
  },
};

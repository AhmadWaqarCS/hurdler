import { lintText, lintFile, lintFiles, fixLintText, fixLintFile, hasLintErrors } from './lint/linter.js';
import { formatLintForLLM, formatLintSummary } from './lint/formatter.js';
import {
  prettifyCode,
  prettifyFile,
  prettifyFiles,
  checkPrettified,
  checkFilePrettified,
} from './prettify/formatter.js';
import {
  inspectSourceCode,
  inspectSourceFile,
  extractFunctionsFromCode,
  extractClassesFromCode,
  extractInterfacesFromCode,
  extractComponentsFromCode,
  extractExportsFromCode,
  extractImportsFromCode,
} from './ast/ts-morph/inspector.js';
import { generateFileOutline, generateCodebaseOutline } from './ast/ts-morph/outline.js';
import { compareSourceAst, formatAstDiffForLLM } from './ast/ts-morph/diff-context.js';
import { parseWithTreeSitter, generateSExpression, traverseSyntaxTree, findNodesByType } from './ast/tree-sitter/inspector.js';
import { executeTreeSitterQuery } from './ast/tree-sitter/queries.js';
import { getTreeSitterParser } from './ast/tree-sitter/parser.js';
import { validateAndPrettify, batchValidateAndPrettify, lintAndPrettify, generateCodeContext } from './pipeline.js';
import {
  resolveCodeConfigPath,
  isCodeConfigFilePresent,
  loadCodeConfigFromDisk,
  saveCodeConfigToDisk,
  syncCodeConfigWithDisk,
} from './config.js';

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
    hasErrors: hasLintErrors,
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
    extractFunctions: extractFunctionsFromCode,
    extractClasses: extractClassesFromCode,
    extractInterfaces: extractInterfacesFromCode,
    extractComponents: extractComponentsFromCode,
    extractExports: extractExportsFromCode,
    extractImports: extractImportsFromCode,
    outline: generateFileOutline,
    codebaseOutline: generateCodebaseOutline,
    compare: compareSourceAst,
    formatDiff: formatAstDiffForLLM,
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
    batchValidateAndPrettify,
    lintAndPrettify,
    generateContext: generateCodeContext,
  },

  // Dynamic Project Configuration
  config: {
    resolvePath: resolveCodeConfigPath,
    isConfigFilePresent: isCodeConfigFilePresent,
    loadFromDisk: loadCodeConfigFromDisk,
    saveToDisk: saveCodeConfigToDisk,
    syncWithDisk: syncCodeConfigWithDisk,
  },
};

import { z } from 'zod';
import {
  scanCodebase,
  queryCodebase,
  getSymbolsByName,
  getFileMap,
  getRefactoringContext,
  hasCodebaseMap,
} from '../../../mapper/service.js';
import {
  FileCategorySchema,
  SymbolCategorySchema,
  SymbolKindSchema,
} from '../../../mapper/schema.js';
import type { NativeToolDefinition } from '../types.js';

/**
 * Native tool: map_codebase
 * Full scan and indexing of the codebase, saving maps to .hurdler/maps/.
 */
export const mapCodebaseTool: NativeToolDefinition = {
  name: 'map_codebase',
  description:
    'Scans and maps the codebase files, functions, documentation, comments, schemas, server actions, components, services, and types, persisting map files to .hurdler/maps/.',
  category: 'custom',
  tags: ['mapper', 'ast', 'indexing', 'knowledge-base'],
  readOnly: false,
  parameters: z.object({
    projectRoot: z.string().optional().describe('Root directory of the project to scan (defaults to workspace root)'),
    forceRescan: z.boolean().optional().default(false).describe('Whether to force a full re-scan from scratch'),
  }),
  execute: async (input, context) => {
    const root = input.projectRoot ?? context?.workspaceRoot ?? process.cwd();
    const map = await scanCodebase({
      projectRoot: root,
      forceRescan: input.forceRescan,
      writeToDisk: true,
    });

    return {
      success: true,
      projectName: map.projectName,
      totalFiles: map.totalFiles,
      totalSymbols: map.totalSymbols,
      filesByCategory: map.stats.filesByCategory,
      symbolsByCategory: map.stats.symbolsByCategory,
      generatedAt: map.generatedAt,
      summary: `Successfully mapped ${map.totalFiles} files and ${map.totalSymbols} symbols in '${map.projectName}'.`,
    };
  },
};

/**
 * Native tool: query_codebase_map
 * Searches the dynamic codebase map for symbols and files.
 */
export const queryCodebaseMapTool: NativeToolDefinition = {
  name: 'query_codebase_map',
  description:
    'Queries the dynamic codebase map for functions, components, services, routes, schemas, or files matching search criteria, category, or tags.',
  category: 'custom',
  tags: ['mapper', 'search', 'query', 'ast'],
  readOnly: true,
  parameters: z.object({
    query: z.string().optional().describe('Keyword search term matching symbol names, signatures, docstrings, or file paths'),
    category: FileCategorySchema.optional().describe('Filter by file category (e.g. api-route, service, schema, component, business-logic)'),
    symbolCategory: SymbolCategorySchema.optional().describe('Filter by symbol category (e.g. business-logic-function, schema, server-action, hook)'),
    symbolKind: SymbolKindSchema.optional().describe('Filter by symbol AST kind (function, method, component, hook, class, interface, type, schema)'),
    tags: z.array(z.string()).optional().describe('Filter by tags, e.g. ["zod", "auth", "server-action"]'),
    exportedOnly: z.boolean().optional().default(false).describe('Filter to only exported symbols'),
    limit: z.number().int().positive().optional().default(20).describe('Maximum number of results to return'),
  }),
  execute: async (input) => {
    if (!hasCodebaseMap()) {
      await scanCodebase({ writeToDisk: true });
    }

    const results = queryCodebase({
      query: input.query,
      category: input.category,
      symbolCategory: input.symbolCategory,
      symbolKind: input.symbolKind,
      tags: input.tags,
      exportedOnly: input.exportedOnly,
      limit: input.limit,
    });

    return {
      success: true,
      totalMatchingFiles: results.totalMatchingFiles,
      totalMatchingSymbols: results.totalMatchingSymbols,
      files: results.files.map((f) => ({
        filePath: f.filePath,
        category: f.category,
        totalLines: f.totalLines,
        symbolsCount: f.symbols.length,
        docstring: f.docstring,
      })),
      symbols: results.symbols.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        category: s.category,
        filePath: s.filePath,
        signature: s.signature,
        lineStart: s.lineStart,
        lineEnd: s.lineEnd,
        docstring: s.docstring,
        tags: s.tags,
      })),
    };
  },
};

/**
 * Native tool: get_symbol_map
 * Retrieves deep metadata, signatures, docstrings, and callers for a specific symbol.
 */
export const getSymbolMapTool: NativeToolDefinition = {
  name: 'get_symbol_map',
  description:
    'Retrieves deep metadata, signatures, docstrings, parameters, line numbers, and callers for a specific function, class, schema, or component.',
  category: 'custom',
  tags: ['mapper', 'symbol', 'metadata', 'inspect'],
  readOnly: true,
  parameters: z.object({
    symbolName: z.string().describe('Name of the symbol to retrieve (e.g. getUserById, calculateTax, AuthSchema)'),
    filePath: z.string().optional().describe('Optional file path to disambiguate if multiple symbols share the same name'),
  }),
  execute: async (input) => {
    if (!hasCodebaseMap()) {
      await scanCodebase({ writeToDisk: true });
    }

    const symbols = getSymbolsByName(input.symbolName);
    let matched = symbols;
    if (input.filePath) {
      matched = symbols.filter((s) => s.filePath.includes(input.filePath!));
    }

    if (matched.length === 0) {
      return {
        success: false,
        error: `Symbol '${input.symbolName}' not found in codebase map.`,
      };
    }

    return {
      success: true,
      totalMatches: matched.length,
      symbols: matched,
    };
  },
};

/**
 * Native tool: get_file_map
 * Retrieves the complete structural map for a specific file.
 */
export const getFileMapTool: NativeToolDefinition = {
  name: 'get_file_map',
  description:
    'Retrieves the structural map for a specific file, including all its functions, components, schemas, imports, exports, and dependencies.',
  category: 'custom',
  tags: ['mapper', 'file', 'structure'],
  readOnly: true,
  parameters: z.object({
    filePath: z.string().describe('Path of the file to inspect (e.g. src/services/user.service.ts)'),
  }),
  execute: async (input) => {
    if (!hasCodebaseMap()) {
      await scanCodebase({ writeToDisk: true });
    }

    const fileMap = getFileMap(input.filePath);
    if (!fileMap) {
      return {
        success: false,
        error: `File '${input.filePath}' is not indexed in the active codebase map.`,
      };
    }

    return {
      success: true,
      file: fileMap,
    };
  },
};

/**
 * Native tool: get_refactoring_context
 * Extracts symbols, upstream dependencies, and dependent callers for refactoring safely.
 */
export const getRefactoringContextTool: NativeToolDefinition = {
  name: 'get_refactoring_context',
  description:
    'Extracts full context (symbol signatures, upstream dependencies, and all dependent callers/importers) for safely refactoring a file or function without breaking changes.',
  category: 'custom',
  tags: ['mapper', 'refactoring', 'callers', 'dependencies'],
  readOnly: true,
  parameters: z.object({
    target: z.string().describe('File path or symbol name/ID to refactor (e.g. src/services/user.service.ts or getUserById)'),
    includeCallers: z.boolean().optional().default(true).describe('Whether to include dependent caller files and lines'),
    includeDependencies: z.boolean().optional().default(true).describe('Whether to include upstream imported files and symbols'),
  }),
  execute: async (input) => {
    if (!hasCodebaseMap()) {
      await scanCodebase({ writeToDisk: true });
    }

    try {
      const refactorCtx = getRefactoringContext(input.target, {
        includeCallers: input.includeCallers,
        includeDependencies: input.includeDependencies,
      });

      return {
        success: true,
        target: refactorCtx.target,
        kind: refactorCtx.kind,
        dependentsCount: refactorCtx.dependents.length,
        dependenciesCount: refactorCtx.dependencies.length,
        contextMarkdown: refactorCtx.contextMarkdown,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  },
};

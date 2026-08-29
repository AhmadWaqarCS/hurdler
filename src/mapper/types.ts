import type { z } from 'zod';
import type { CodeLanguage, ParameterInfo, ImportInfo, ExportInfo } from '../code/types.js';
import type {
  FileCategorySchema,
  SymbolCategorySchema,
  SymbolMapEntrySchema,
  FileMapEntrySchema,
  CodebaseMapSchema,
  MapQueryOptionsSchema,
  RefactoringContextOptionsSchema,
  CodebaseScanOptionsSchema,
  FileUpdateOptionsSchema,
  MapStatsSchema,
} from './schema.js';

// ==========================================
// Semantic Categorization Types
// ==========================================

export type FileCategory = z.infer<typeof FileCategorySchema>;
export type SymbolCategory = z.infer<typeof SymbolCategorySchema>;

// ==========================================
// Symbol & File Map Data Types
// ==========================================

export type SymbolKind =
  | 'function'
  | 'method'
  | 'component'
  | 'hook'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'schema';

export interface SymbolMapEntry {
  /** Unique symbol identifier, e.g., 'src/services/user.ts#getUserById' */
  id: string;
  /** Name of the symbol */
  name: string;
  /** Structural AST kind */
  kind: SymbolKind;
  /** Semantic functional category */
  category: SymbolCategory;
  /** Relative file path from project root */
  filePath: string;
  /** 1-indexed start line */
  lineStart: number;
  /** 1-indexed end line */
  lineEnd: number;
  /** TypeScript/JavaScript declaration signature */
  signature: string;
  /** Extracted JSDoc comment description */
  docstring?: string;
  /** Leading or inline code comments */
  commentSummary?: string;
  /** Whether the symbol is exported */
  isExported: boolean;
  /** Whether the symbol is the default export */
  isDefaultExport: boolean;
  /** Whether the symbol is asynchronous */
  isAsync: boolean;
  /** Parameter details */
  parameters: ParameterInfo[];
  /** Return type text */
  returnType?: string;
  /** Extracted symbol or module dependencies used within the body */
  dependencies: string[];
  /** Searchable classification tags, e.g. ['zod', 'server-action', 'hook', 'auth'] */
  tags?: string[];
}

export interface FileMapEntry {
  /** Relative file path from project root */
  filePath: string;
  /** Semantic category of the file */
  category: FileCategory;
  /** Programming language */
  language: CodeLanguage;
  /** File size in bytes */
  sizeBytes: number;
  /** Total number of lines */
  totalLines: number;
  /** SHA-256 content hash for fast change detection */
  contentHash: string;
  /** Last modification timestamp in milliseconds */
  lastModifiedMs: number;
  /** Whether the file contains Next.js `'use server'` directive */
  isServerActionFile: boolean;
  /** Whether the file contains Next.js `'use client'` directive */
  isClientComponentFile: boolean;
  /** Top-level module/file docstring */
  docstring?: string;
  /** List of imports */
  imports: ImportInfo[];
  /** List of exports */
  exports: ExportInfo[];
  /** All extracted symbols in this file */
  symbols: SymbolMapEntry[];
  /** Relative paths of other project files this file imports */
  internalDependencies: string[];
  /** Third-party packages or built-in modules imported */
  externalDependencies: string[];
}

export interface MapStats {
  filesByCategory: Record<FileCategory, number>;
  symbolsByCategory: Record<SymbolCategory, number>;
}

export interface CodebaseMap {
  /** Schema version */
  version: '1.0.0';
  /** Absolute project root path */
  projectRoot: string;
  /** Project name (from package.json or folder name) */
  projectName: string;
  /** Map generation ISO timestamp */
  generatedAt: string;
  /** Last update ISO timestamp */
  lastUpdatedAt: string;
  /** Total files mapped */
  totalFiles: number;
  /** Total symbols extracted */
  totalSymbols: number;
  /** Breakdown statistics */
  stats: MapStats;
  /** File dictionary keyed by relative file path */
  files: Record<string, FileMapEntry>;
  /** Bidirectional dependency graph */
  dependencyGraph: Record<string, { imports: string[]; importedBy: string[] }>;
  /** Symbol inverted index: symbolName -> symbolIds[] */
  symbolIndex: Record<string, string[]>;
}

// ==========================================
// Options & Queries Types
// ==========================================

export type MapQueryOptions = z.infer<typeof MapQueryOptionsSchema>;
export type RefactoringContextOptions = z.infer<typeof RefactoringContextOptionsSchema>;
export type CodebaseScanOptions = z.infer<typeof CodebaseScanOptionsSchema>;
export type FileUpdateOptions = z.infer<typeof FileUpdateOptionsSchema>;

export interface SymbolLookupResult {
  symbol: SymbolMapEntry;
  file: FileMapEntry;
  importedByFiles: string[];
}

export interface RefactoringContextResult {
  target: string;
  kind: 'file' | 'symbol';
  file?: FileMapEntry;
  symbol?: SymbolMapEntry;
  dependents: Array<{
    filePath: string;
    importedSymbols: string[];
    line?: number;
  }>;
  dependencies: Array<{
    filePath: string;
    symbols: string[];
  }>;
  contextMarkdown: string;
}

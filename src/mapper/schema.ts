import { z } from 'zod';

export const FileCategorySchema = z.enum([
  'api-route',
  'server-action',
  'component',
  'service',
  'business-logic',
  'schema',
  'type-definition',
  'common-util',
  'module-wrapper',
  'config',
  'test',
  'unknown',
]);

export const SymbolCategorySchema = z.enum([
  'business-logic-function',
  'common-function',
  'module-function',
  'server-action',
  'api-handler',
  'component',
  'hook',
  'schema',
  'service-method',
  'type-definition',
  'class-definition',
  'variable',
]);

export const SymbolKindSchema = z.enum([
  'function',
  'method',
  'component',
  'hook',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
  'schema',
]);

export const ParameterInfoSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean(),
  defaultValue: z.string().optional(),
});

export const SymbolMapEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: SymbolKindSchema,
  category: SymbolCategorySchema,
  filePath: z.string(),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  signature: z.string(),
  docstring: z.string().optional(),
  commentSummary: z.string().optional(),
  isExported: z.boolean(),
  isDefaultExport: z.boolean(),
  isAsync: z.boolean(),
  parameters: z.array(ParameterInfoSchema),
  returnType: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).optional(),
});

export const ImportInfoSchema = z.object({
  moduleSpecifier: z.string(),
  defaultImport: z.string().optional(),
  namedImports: z.array(
    z.object({
      name: z.string(),
      alias: z.string().optional(),
      isTypeOnly: z.boolean(),
    })
  ),
  namespaceImport: z.string().optional(),
  isTypeOnly: z.boolean(),
  line: z.number().int().positive(),
});

export const ExportInfoSchema = z.object({
  name: z.string().optional(),
  isDefault: z.boolean(),
  isTypeOnly: z.boolean(),
  moduleSpecifier: z.string().optional(),
  declarationType: z.string().optional(),
  line: z.number().int().positive(),
});

export const FileMapEntrySchema = z.object({
  filePath: z.string(),
  category: FileCategorySchema,
  language: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  totalLines: z.number().int().nonnegative(),
  contentHash: z.string(),
  lastModifiedMs: z.number().nonnegative(),
  isServerActionFile: z.boolean().default(false),
  isClientComponentFile: z.boolean().default(false),
  docstring: z.string().optional(),
  imports: z.array(ImportInfoSchema).default([]),
  exports: z.array(ExportInfoSchema).default([]),
  symbols: z.array(SymbolMapEntrySchema).default([]),
  internalDependencies: z.array(z.string()).default([]),
  externalDependencies: z.array(z.string()).default([]),
});

export const MapStatsSchema = z.object({
  filesByCategory: z.record(FileCategorySchema, z.number().int().nonnegative()),
  symbolsByCategory: z.record(SymbolCategorySchema, z.number().int().nonnegative()),
});

export const CodebaseMapSchema = z.object({
  version: z.literal('1.0.0'),
  projectRoot: z.string(),
  projectName: z.string(),
  generatedAt: z.string(),
  lastUpdatedAt: z.string(),
  totalFiles: z.number().int().nonnegative(),
  totalSymbols: z.number().int().nonnegative(),
  stats: MapStatsSchema,
  files: z.record(z.string(), FileMapEntrySchema),
  dependencyGraph: z.record(
    z.string(),
    z.object({
      imports: z.array(z.string()),
      importedBy: z.array(z.string()),
    })
  ),
  symbolIndex: z.record(z.string(), z.array(z.string())),
});

export const MapQueryOptionsSchema = z.object({
  query: z.string().optional(),
  category: FileCategorySchema.optional(),
  symbolCategory: SymbolCategorySchema.optional(),
  symbolKind: SymbolKindSchema.optional(),
  filePathPattern: z.string().optional(),
  tags: z.array(z.string()).optional(),
  exportedOnly: z.boolean().default(false),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const RefactoringContextOptionsSchema = z.object({
  target: z.string(),
  includeCallers: z.boolean().default(true),
  includeDependencies: z.boolean().default(true),
  includeDocstrings: z.boolean().default(true),
  maxCallers: z.number().int().positive().default(10),
  format: z.enum(['markdown', 'json']).default('markdown'),
});

export const CodebaseScanOptionsSchema = z.object({
  projectRoot: z.string().optional(),
  mapDir: z.string().optional(),
  includeExtensions: z.array(z.string()).default(['.ts', '.tsx', '.js', '.jsx', '.json']),
  excludePatterns: z
    .array(z.string())
    .default(['node_modules', '.git', 'dist', '.next', 'build', 'coverage', '.hurdler']),
  forceRescan: z.boolean().default(false),
  writeToDisk: z.boolean().default(true),
  maxFiles: z.number().int().positive().default(5000),
});

export const FileUpdateOptionsSchema = z.object({
  projectRoot: z.string().optional(),
  mapDir: z.string().optional(),
  writeToDisk: z.boolean().default(true),
  triggerClassifier: z.boolean().default(true),
});

export const MapperConfigSchema = z.object({
  projectRoot: z.string().default(process.cwd()),
  mapDir: z.string().default('.hurdler/maps'),
  autoSyncOnUpdate: z.boolean().default(true),
  includeExtensions: z.array(z.string()).default(['.ts', '.tsx', '.js', '.jsx', '.json']),
  excludePatterns: z
    .array(z.string())
    .default(['node_modules', '.git', 'dist', '.next', 'build', 'coverage', '.hurdler']),
  maxFiles: z.number().int().positive().default(5000),
  defaultLimit: z.number().int().positive().default(50),
  prettyJson: z.boolean().default(true),
});


import { z } from 'zod';

export const CodeLanguageSchema = z.enum([
  'typescript',
  'typescriptreact',
  'javascript',
  'javascriptreact',
  'json',
  'css',
  'scss',
  'html',
  'markdown',
  'yaml',
  'python',
  'unknown',
]);

// ==========================================
// ESLint Schemas
// ==========================================

export const LintTextOptionsSchema = z.object({
  filePath: z.string().optional(),
  language: CodeLanguageSchema.optional(),
  fix: z.boolean().optional().default(false),
  ruleOverrides: z.record(z.string(), z.unknown()).optional(),
  projectRoot: z.string().optional(),
});

export const LintFileOptionsSchema = z.object({
  fix: z.boolean().optional().default(false),
  projectRoot: z.string().optional(),
  ruleOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const LintFilesOptionsSchema = z.object({
  fix: z.boolean().optional().default(false),
  projectRoot: z.string().optional(),
  concurrency: z.number().int().positive().optional().default(4),
  ignorePatterns: z.array(z.string()).optional(),
  ruleOverrides: z.record(z.string(), z.unknown()).optional(),
});

// ==========================================
// Prettier Schemas
// ==========================================

export const PrettifyOptionsSchema = z.object({
  parser: z.string().optional(),
  filePath: z.string().optional(),
  tabWidth: z.number().int().min(1).max(8).optional().default(2),
  useTabs: z.boolean().optional().default(false),
  semi: z.boolean().optional().default(true),
  singleQuote: z.boolean().optional().default(true),
  quoteProps: z.enum(['as-needed', 'consistent', 'preserve']).optional().default('as-needed'),
  jsxSingleQuote: z.boolean().optional().default(false),
  trailingComma: z.enum(['all', 'es5', 'none']).optional().default('es5'),
  bracketSpacing: z.boolean().optional().default(true),
  bracketSameLine: z.boolean().optional().default(false),
  arrowParens: z.enum(['always', 'avoid']).optional().default('always'),
  printWidth: z.number().int().min(40).max(300).optional().default(100),
  endOfLine: z.enum(['auto', 'lf', 'crlf', 'cr']).optional().default('lf'),
  singleAttributePerLine: z.boolean().optional().default(false),
});

export const PrettifyFileOptionsSchema = z.object({
  overwrite: z.boolean().optional().default(true),
  projectRoot: z.string().optional(),
  options: PrettifyOptionsSchema.optional(),
});

export const PrettifyFilesOptionsSchema = z.object({
  overwrite: z.boolean().optional().default(true),
  projectRoot: z.string().optional(),
  concurrency: z.number().int().positive().optional().default(4),
  options: PrettifyOptionsSchema.optional(),
});

// ==========================================
// AST & Outline Schemas
// ==========================================

export const OutlineOptionsSchema = z.object({
  detailLevel: z.enum(['compact', 'standard', 'detailed']).optional().default('standard'),
  format: z.enum(['markdown', 'json']).optional().default('markdown'),
  includeImports: z.boolean().optional().default(false),
  includeExports: z.boolean().optional().default(true),
  includePrivate: z.boolean().optional().default(false),
  includeDocstrings: z.boolean().optional().default(true),
});

export const CodebaseOutlineOptionsSchema = z.object({
  includeExtensions: z
    .array(z.string())
    .optional()
    .default(['.ts', '.tsx', '.js', '.jsx', '.json']),
  excludePatterns: z
    .array(z.string())
    .optional()
    .default(['node_modules/**', 'dist/**', '.git/**', '.next/**', 'coverage/**']),
  maxFiles: z.number().int().positive().optional().default(200),
  detailLevel: z.enum(['compact', 'standard', 'detailed']).optional().default('compact'),
});

export const ASTDiffOptionsSchema = z.object({
  filePath: z.string().optional(),
  originalCode: z.string(),
  modifiedCode: z.string(),
});

// ==========================================
// Pipeline Schemas
// ==========================================

export const ValidateAndPrettifyOptionsSchema = z.object({
  fixLint: z.boolean().optional().default(false),
  projectRoot: z.string().optional(),
  ruleOverrides: z.record(z.string(), z.unknown()).optional(),
  prettierOptions: PrettifyOptionsSchema.optional(),
});

export const CodeContextOptionsSchema = z.object({
  filePath: z.string().optional(),
  includeOutline: z.boolean().optional().default(true),
  includeSymbols: z.boolean().optional().default(true),
  includeDiffFrom: z.string().optional(),
});

export const BatchValidateAndPrettifyOptionsSchema = z.object({
  fixLint: z.boolean().optional().default(false),
  projectRoot: z.string().optional(),
  concurrency: z.number().int().positive().optional().default(4),
  ruleOverrides: z.record(z.string(), z.unknown()).optional(),
  prettierOptions: PrettifyOptionsSchema.optional(),
});

export const ProjectCodeConfigSchema = z.object({
  lintRuleOverrides: z.record(z.string(), z.unknown()).optional().default({}),
  defaultPrettierOptions: PrettifyOptionsSchema.optional(),
  outlineDefaults: OutlineOptionsSchema.optional(),
  codebaseScanner: CodebaseOutlineOptionsSchema.optional(),
  concurrency: z.number().int().positive().optional().default(4),
});


import { z } from 'zod';

export const ToolCategorySchema = z.union([
  z.enum(['filesystem', 'search', 'editing', 'code_generation', 'utility', 'custom']),
  z.string().min(1, 'Custom category must be a non-empty string'),
]);

export const ToolExecutionContextSchema = z.object({
  /** Canonical root directory of the active workspace (defaults to current working directory) */
  workspaceRoot: z.string().optional(),
  /** Specific subagent ID if running within an agent context */
  agentId: z.string().optional(),
  /** Workflow ID if running within a workflow context */
  workflowId: z.string().optional(),
  /** Execution timeout in milliseconds */
  timeoutMs: z.number().int().positive().optional(),
  /** Abort signal for cancellation */
  abortSignal: z.instanceof(AbortSignal).optional(),
  /** Custom environment or metadata variables */
  environment: z.record(z.string(), z.unknown()).optional(),
});

export const ToolFilterOptionsSchema = z.object({
  /** Whitelist of specific tool names to include */
  names: z.array(z.string()).optional(),
  /** Include tools from these categories */
  categories: z.array(ToolCategorySchema).optional(),
  /** Include tools matching all/any of these tags */
  tags: z.array(z.string()).optional(),
  /** Exclude specific tool names */
  excludeNames: z.array(z.string()).optional(),
  /** If true, only returns read-only tools */
  readOnlyOnly: z.boolean().optional(),
});

// -------------------------------------------------------------
// Native Filesystem and Search Tool Parameter Schemas
// -------------------------------------------------------------

export const CreateFileInputSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  content: z.string().default(''),
  overwrite: z.boolean().default(false).describe('Whether to overwrite if file already exists'),
});

export const CreateManyFilesInputSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1, 'File path cannot be empty'),
      content: z.string().default(''),
      overwrite: z.boolean().default(false),
    })
  ).min(1, 'Must provide at least one file to create'),
  stopOnError: z.boolean().default(false).describe('If true, halts subsequent file creation on first error'),
});

export const ReadFileInputSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  startLine: z.number().int().positive().optional().describe('1-indexed start line (inclusive)'),
  endLine: z.number().int().positive().optional().describe('1-indexed end line (inclusive)'),
  maxBytes: z.number().int().positive().default(512 * 1024).describe('Maximum bytes to read (default 512KB)'),
});

export const ReadManyFilesInputSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, 'Must provide at least one file path'),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  maxBytesPerFile: z.number().int().positive().default(256 * 1024),
});

export const GetFileInfoInputSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
});

export const EditFileInputSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  targetContent: z.string().min(1, 'Target content to replace cannot be empty'),
  replacementContent: z.string().default(''),
  startLine: z.number().int().positive().optional().describe('Optional start line bound (1-indexed)'),
  endLine: z.number().int().positive().optional().describe('Optional end line bound (1-indexed)'),
  allowMultiple: z.boolean().default(false).describe('Allow replacing multiple occurrences if found'),
});

export const EditManyFilesInputSchema = z.object({
  edits: z.array(
    z.object({
      path: z.string().min(1, 'File path cannot be empty'),
      targetContent: z.string().min(1, 'Target content to replace cannot be empty'),
      replacementContent: z.string().default(''),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      allowMultiple: z.boolean().default(false),
    })
  ).min(1, 'Must provide at least one edit operation'),
  atomic: z.boolean().default(true).describe('If true, validates all edits before writing any to disk'),
});

export const AppendFileInputSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  content: z.string().min(1, 'Content to append cannot be empty'),
  addNewline: z.boolean().default(true).describe('Automatically add trailing newline if missing'),
});

export const ListDirectoryInputSchema = z.object({
  path: z.string().default('.').describe('Directory path relative to workspace root (defaults to ".")'),
  recursive: z.boolean().default(false).describe('Whether to list files recursively'),
  maxDepth: z.number().int().positive().default(3).describe('Maximum recursion depth'),
  ignorePatterns: z.array(z.string()).default(['node_modules', '.git', 'dist', '.next', 'build', '.turbo']),
  includeStats: z.boolean().default(true).describe('Include file sizes and directory metadata'),
});

export const SearchFilesInputSchema = z.object({
  query: z.string().min(1, 'Search query or pattern cannot be empty'),
  path: z.string().default('.').describe('Directory path to search in (defaults to workspace root)'),
  isRegex: z.boolean().default(false).describe('Treat query as regular expression'),
  caseInsensitive: z.boolean().default(true).describe('Perform case-insensitive search'),
  maxResults: z.number().int().positive().default(100).describe('Max matches to return'),
  includePatterns: z.array(z.string()).optional().describe('Glob/extension filter e.g. ["*.ts", "*.js"]'),
  excludePatterns: z.array(z.string()).default(['node_modules/**', '.git/**', 'dist/**', '.next/**']),
});

export const DeleteFileInputSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
  recursive: z.boolean().default(false).describe('Delete directory and its contents recursively'),
  force: z.boolean().default(false).describe('Ignore if target does not exist'),
});

export const CopyFileInputSchema = z.object({
  sourcePath: z.string().min(1, 'Source path cannot be empty'),
  destinationPath: z.string().min(1, 'Destination path cannot be empty'),
  overwrite: z.boolean().default(false),
});

export const MoveFileInputSchema = z.object({
  sourcePath: z.string().min(1, 'Source path cannot be empty'),
  destinationPath: z.string().min(1, 'Destination path cannot be empty'),
  overwrite: z.boolean().default(false),
});

export const CreateDirectoryInputSchema = z.object({
  path: z.string().min(1, 'Directory path cannot be empty'),
  recursive: z.boolean().default(true),
});

export const NativeToolDefinitionSchema = z.object({
  name: z.string().min(1, 'Tool name must not be empty').regex(/^[a-zA-Z0-9_-]+$/, 'Tool name must be alphanumeric, dashes or underscores'),
  description: z.string().min(1, 'Tool description must not be empty'),
  category: ToolCategorySchema.default('utility'),
  parameters: z.custom<z.ZodType<any>>((val) => typeof val === 'object' && val !== null, 'Parameters must be a Zod schema'),
  execute: z.custom<(...args: any[]) => Promise<any>>((val) => typeof val === 'function', 'Execute must be an async function'),
  readOnly: z.boolean().default(false),
  isDangerous: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  version: z.union([z.string(), z.number()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

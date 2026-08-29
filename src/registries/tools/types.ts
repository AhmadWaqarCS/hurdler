import type { z } from 'zod';
import type {
  ToolCategorySchema,
  ToolExecutionContextSchema,
  ToolFilterOptionsSchema,
  CreateFileInputSchema,
  CreateManyFilesInputSchema,
  ReadFileInputSchema,
  ReadManyFilesInputSchema,
  GetFileInfoInputSchema,
  EditFileInputSchema,
  EditManyFilesInputSchema,
  AppendFileInputSchema,
  ListDirectoryInputSchema,
  SearchFilesInputSchema,
  DeleteFileInputSchema,
  CopyFileInputSchema,
  MoveFileInputSchema,
  CreateDirectoryInputSchema,
} from './schema.js';

export type ToolCategory = z.infer<typeof ToolCategorySchema>;
export type ToolExecutionContext = z.infer<typeof ToolExecutionContextSchema>;
export type ToolFilterOptions = z.infer<typeof ToolFilterOptionsSchema>;

// Native tool input types inferred from schemas
export type CreateFileInput = z.infer<typeof CreateFileInputSchema>;
export type CreateManyFilesInput = z.infer<typeof CreateManyFilesInputSchema>;
export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;
export type ReadManyFilesInput = z.infer<typeof ReadManyFilesInputSchema>;
export type GetFileInfoInput = z.infer<typeof GetFileInfoInputSchema>;
export type EditFileInput = z.infer<typeof EditFileInputSchema>;
export type EditManyFilesInput = z.infer<typeof EditManyFilesInputSchema>;
export type AppendFileInput = z.infer<typeof AppendFileInputSchema>;
export type ListDirectoryInput = z.infer<typeof ListDirectoryInputSchema>;
export type SearchFilesInput = z.infer<typeof SearchFilesInputSchema>;
export type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;
export type CopyFileInput = z.infer<typeof CopyFileInputSchema>;
export type MoveFileInput = z.infer<typeof MoveFileInputSchema>;
export type CreateDirectoryInput = z.infer<typeof CreateDirectoryInputSchema>;

/**
 * Definition of a native tool inside the Hurdler platform.
 */
export interface NativeToolDefinition<TInput = any, TOutput = any> {
  /** Unique identifier for the tool (e.g., 'create_file', 'edit_file') */
  name: string;
  /** Clear human and LLM-readable description of the tool's purpose and usage */
  description: string;
  /** Functional category */
  category: ToolCategory;
  /** Zod schema for validating tool input parameters */
  parameters: z.ZodType<TInput>;
  /** Async execution handler for the tool */
  execute: (input: TInput, context?: ToolExecutionContext) => Promise<TOutput>;
  /** Whether the tool is read-only (does not modify filesystem or external state) */
  readOnly?: boolean;
  /** Whether the tool performs potentially destructive operations */
  isDangerous?: boolean;
  /** Searchable tags for workflow filtering (e.g. ['filesystem', 'read', 'batch']) */
  tags?: string[];
  /** Tool version string or number */
  version?: string | number;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Structured result returned from executing a tool runner.
 */
export interface ToolExecutionResult<TOutput = any> {
  toolName: string;
  success: boolean;
  output?: TOutput;
  error?: string;
  durationMs: number;
}

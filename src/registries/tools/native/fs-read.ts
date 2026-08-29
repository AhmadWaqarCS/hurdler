import fs from 'fs';
import { z } from 'zod';
import {
  ReadFileInputSchema,
  ReadManyFilesInputSchema,
  GetFileInfoInputSchema,
} from '../schema.js';
import { resolveWorkspacePath, validateFileSize } from '../security.js';
import { FileOperationError } from '../errors.js';
import type { NativeToolDefinition } from '../types.js';

export const readFileTool: NativeToolDefinition<z.infer<typeof ReadFileInputSchema>> = {
  name: 'read_file',
  description: 'Reads text content from a file within the workspace. Supports slicing by line range (1-indexed, inclusive) and enforcing byte safety limits.',
  category: 'filesystem',
  readOnly: true,
  tags: ['filesystem', 'read', 'file'],
  parameters: ReadFileInputSchema,
  execute: async (input: z.infer<typeof ReadFileInputSchema>, context) => {
    const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);

    if (!fs.existsSync(fullPath)) {
      throw new FileOperationError('read', input.path, `File does not exist at '${input.path}'`);
    }

    const stat = await validateFileSize(fullPath, input.maxBytes);
    if (stat && stat.isDirectory()) {
      throw new FileOperationError('read', input.path, `Target '${input.path}' is a directory, not a file.`);
    }

    const rawContent = await fs.promises.readFile(fullPath, 'utf-8');
    const lines = rawContent.split(/\r?\n/);
    const totalLines = lines.length;

    let selectedContent = rawContent;
    let startLine = input.startLine ?? 1;
    let endLine = input.endLine ?? totalLines;

    if (input.startLine !== undefined || input.endLine !== undefined) {
      const startIdx = Math.max(0, startLine - 1);
      const endIdx = Math.min(totalLines, endLine);
      selectedContent = lines.slice(startIdx, endIdx).join('\n');
    }

    return {
      path: input.path,
      content: selectedContent,
      totalLines,
      startLine,
      endLine,
      bytesRead: Buffer.byteLength(selectedContent, 'utf-8'),
    };
  },
};

export const readManyFilesTool: NativeToolDefinition<z.infer<typeof ReadManyFilesInputSchema>> = {
  name: 'read_many_files',
  description: 'Batch reads text content from multiple files in parallel within the workspace.',
  category: 'filesystem',
  readOnly: true,
  tags: ['filesystem', 'read', 'batch'],
  parameters: ReadManyFilesInputSchema,
  execute: async (input: z.infer<typeof ReadManyFilesInputSchema>, context) => {
    const results = await Promise.all(
      input.paths.map(async (filePath: string) => {
        try {
          const fullPath = resolveWorkspacePath(filePath, context?.workspaceRoot);
          if (!fs.existsSync(fullPath)) {
            return {
              path: filePath,
              content: '',
              success: false,
              error: `File not found at '${filePath}'`,
            };
          }

          const stat = await validateFileSize(fullPath, input.maxBytesPerFile);
          if (stat?.isDirectory()) {
            return {
              path: filePath,
              content: '',
              success: false,
              error: `Path '${filePath}' is a directory`,
            };
          }

          const rawContent = await fs.promises.readFile(fullPath, 'utf-8');
          const lines = rawContent.split(/\r?\n/);
          const totalLines = lines.length;

          let selectedContent = rawContent;
          if (input.startLine !== undefined || input.endLine !== undefined) {
            const startLine = input.startLine ?? 1;
            const endLine = input.endLine ?? totalLines;
            selectedContent = lines.slice(Math.max(0, startLine - 1), Math.min(totalLines, endLine)).join('\n');
          }

          return {
            path: filePath,
            content: selectedContent,
            success: true,
            totalLines,
            bytesRead: Buffer.byteLength(selectedContent, 'utf-8'),
          };
        } catch (err) {
          return {
            path: filePath,
            content: '',
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    const successfulFiles = results.filter((r) => r.success).length;

    return {
      files: results,
      totalFiles: input.paths.length,
      successfulFiles,
    };
  },
};

export const getFileInfoTool: NativeToolDefinition<z.infer<typeof GetFileInfoInputSchema>> = {
  name: 'get_file_info',
  description: 'Retrieves metadata about a file or directory (existence, size, timestamps, directory check).',
  category: 'filesystem',
  readOnly: true,
  tags: ['filesystem', 'metadata', 'stat'],
  parameters: GetFileInfoInputSchema,
  execute: async (input: z.infer<typeof GetFileInfoInputSchema>, context) => {
    try {
      const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);
      if (!fs.existsSync(fullPath)) {
        return {
          path: input.path,
          exists: false,
        };
      }

      const stat = await fs.promises.stat(fullPath);
      return {
        path: input.path,
        exists: true,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      };
    } catch (err) {
      throw new FileOperationError('get_file_info', input.path, err instanceof Error ? err.message : String(err), err);
    }
  },
};

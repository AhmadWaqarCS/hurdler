import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  CreateFileInputSchema,
  CreateManyFilesInputSchema,
  DeleteFileInputSchema,
  CopyFileInputSchema,
  MoveFileInputSchema,
} from '../schema.js';
import { resolveWorkspacePath } from '../security.js';
import { FileOperationError } from '../errors.js';
import type { NativeToolDefinition } from '../types.js';

export const createFileTool: NativeToolDefinition<z.infer<typeof CreateFileInputSchema>> = {
  name: 'create_file',
  description: 'Creates a new file with the specified content. Automatically creates parent directories if needed. Fails if file exists unless overwrite is true.',
  category: 'filesystem',
  readOnly: false,
  tags: ['filesystem', 'write', 'create'],
  parameters: CreateFileInputSchema,
  execute: async (input: z.infer<typeof CreateFileInputSchema>, context) => {
    const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);
    const exists = fs.existsSync(fullPath);

    if (exists && !input.overwrite) {
      throw new FileOperationError(
        'create_file',
        input.path,
        `File already exists at '${input.path}'. Set overwrite: true to overwrite.`
      );
    }

    const parentDir = path.dirname(fullPath);
    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(fullPath, input.content, 'utf-8');

    return {
      path: input.path,
      created: !exists,
      overwritten: exists && input.overwrite,
      bytesWritten: Buffer.byteLength(input.content, 'utf-8'),
    };
  },
};

export const createManyFilesTool: NativeToolDefinition<z.infer<typeof CreateManyFilesInputSchema>> = {
  name: 'create_many_files',
  description: 'Batch creates multiple files at once within the workspace with per-file status reports.',
  category: 'filesystem',
  readOnly: false,
  tags: ['filesystem', 'write', 'batch'],
  parameters: CreateManyFilesInputSchema,
  execute: async (input: z.infer<typeof CreateManyFilesInputSchema>, context) => {
    const results = [];

    for (const file of input.files) {
      try {
        const fullPath = resolveWorkspacePath(file.path, context?.workspaceRoot);
        const exists = fs.existsSync(fullPath);

        if (exists && !file.overwrite) {
          const err = `File already exists at '${file.path}'. Set overwrite: true to overwrite.`;
          results.push({ path: file.path, success: false, error: err, bytesWritten: 0 });
          if (input.stopOnError) {
            break;
          }
          continue;
        }

        const parentDir = path.dirname(fullPath);
        await fs.promises.mkdir(parentDir, { recursive: true });
        await fs.promises.writeFile(fullPath, file.content, 'utf-8');

        results.push({
          path: file.path,
          success: true,
          created: !exists,
          overwritten: exists && file.overwrite,
          bytesWritten: Buffer.byteLength(file.content, 'utf-8'),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({ path: file.path, success: false, error: errMsg, bytesWritten: 0 });
        if (input.stopOnError) {
          break;
        }
      }
    }

    const successfulFiles = results.filter((r) => r.success).length;

    return {
      results,
      totalFiles: input.files.length,
      successfulFiles,
    };
  },
};

export const deleteFileTool: NativeToolDefinition<z.infer<typeof DeleteFileInputSchema>> = {
  name: 'delete_file',
  description: 'Deletes a file or directory within the workspace.',
  category: 'filesystem',
  readOnly: false,
  isDangerous: true,
  tags: ['filesystem', 'delete', 'cleanup'],
  parameters: DeleteFileInputSchema,
  execute: async (input: z.infer<typeof DeleteFileInputSchema>, context) => {
    const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);

    if (!fs.existsSync(fullPath)) {
      if (input.force) {
        return { path: input.path, deleted: false, message: 'Target does not exist (ignored due to force: true)' };
      }
      throw new FileOperationError('delete_file', input.path, `Target does not exist at '${input.path}'`);
    }

    await fs.promises.rm(fullPath, { recursive: input.recursive, force: input.force });
    return {
      path: input.path,
      deleted: true,
    };
  },
};

export const copyFileTool: NativeToolDefinition<z.infer<typeof CopyFileInputSchema>> = {
  name: 'copy_file',
  description: 'Copies a file or directory to a destination path within the workspace.',
  category: 'filesystem',
  readOnly: false,
  tags: ['filesystem', 'copy'],
  parameters: CopyFileInputSchema,
  execute: async (input: z.infer<typeof CopyFileInputSchema>, context) => {
    const src = resolveWorkspacePath(input.sourcePath, context?.workspaceRoot);
    const dest = resolveWorkspacePath(input.destinationPath, context?.workspaceRoot);

    if (!fs.existsSync(src)) {
      throw new FileOperationError('copy_file', input.sourcePath, `Source path does not exist at '${input.sourcePath}'`);
    }

    if (fs.existsSync(dest) && !input.overwrite) {
      throw new FileOperationError('copy_file', input.destinationPath, `Destination already exists at '${input.destinationPath}'. Set overwrite: true.`);
    }

    const parentDir = path.dirname(dest);
    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.cp(src, dest, { recursive: true, force: input.overwrite });

    return {
      sourcePath: input.sourcePath,
      destinationPath: input.destinationPath,
      copied: true,
    };
  },
};

export const moveFileTool: NativeToolDefinition<z.infer<typeof MoveFileInputSchema>> = {
  name: 'move_file',
  description: 'Moves or renames a file or directory within the workspace.',
  category: 'filesystem',
  readOnly: false,
  tags: ['filesystem', 'move', 'rename'],
  parameters: MoveFileInputSchema,
  execute: async (input: z.infer<typeof MoveFileInputSchema>, context) => {
    const src = resolveWorkspacePath(input.sourcePath, context?.workspaceRoot);
    const dest = resolveWorkspacePath(input.destinationPath, context?.workspaceRoot);

    if (!fs.existsSync(src)) {
      throw new FileOperationError('move_file', input.sourcePath, `Source path does not exist at '${input.sourcePath}'`);
    }

    if (fs.existsSync(dest) && !input.overwrite) {
      throw new FileOperationError('move_file', input.destinationPath, `Destination already exists at '${input.destinationPath}'. Set overwrite: true.`);
    }

    const parentDir = path.dirname(dest);
    await fs.promises.mkdir(parentDir, { recursive: true });

    try {
      await fs.promises.rename(src, dest);
    } catch {
      // Fallback for cross-device or permission boundary
      await fs.promises.cp(src, dest, { recursive: true, force: input.overwrite });
      await fs.promises.rm(src, { recursive: true, force: true });
    }

    return {
      sourcePath: input.sourcePath,
      destinationPath: input.destinationPath,
      moved: true,
    };
  },
};

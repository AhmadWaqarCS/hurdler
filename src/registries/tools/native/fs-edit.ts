import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  EditFileInputSchema,
  EditManyFilesInputSchema,
  AppendFileInputSchema,
} from '../schema.js';
import { resolveWorkspacePath } from '../security.js';
import { FileOperationError } from '../errors.js';
import type { NativeToolDefinition } from '../types.js';

/**
 * Pure helper to perform targeted replacement within text content, optionally constrained by line range.
 */
export function applyTargetReplacement(
  fileContent: string,
  targetContent: string,
  replacementContent: string,
  options: { startLine?: number; endLine?: number; allowMultiple?: boolean } = {}
): { updatedContent: string; occurrences: number } {
  const lines = fileContent.split(/\r?\n/);
  const totalLines = lines.length;

  let searchRegion: string;
  let prefix = '';
  let suffix = '';

  if (options.startLine !== undefined || options.endLine !== undefined) {
    const start = Math.max(1, options.startLine ?? 1);
    const end = Math.min(totalLines, options.endLine ?? totalLines);

    if (start > end || start > totalLines) {
      throw new Error(`Invalid line range [${start}, ${end}] for file with ${totalLines} lines.`);
    }

    const beforeLines = lines.slice(0, start - 1);
    const rangeLines = lines.slice(start - 1, end);
    const afterLines = lines.slice(end);

    prefix = beforeLines.length > 0 ? beforeLines.join('\n') + '\n' : '';
    suffix = afterLines.length > 0 ? '\n' + afterLines.join('\n') : '';
    searchRegion = rangeLines.join('\n');
  } else {
    searchRegion = fileContent;
  }

  // Count occurrences
  let count = 0;
  let pos = searchRegion.indexOf(targetContent);
  while (pos !== -1) {
    count++;
    pos = searchRegion.indexOf(targetContent, pos + targetContent.length);
  }

  if (count === 0) {
    throw new Error('Target content was not found in the specified file or line range.');
  }

  if (count > 1 && !options.allowMultiple) {
    throw new Error(
      `Target content appears ${count} times in the file. Narrow down the line range or set allowMultiple: true.`
    );
  }

  let replacedRegion: string;
  if (options.allowMultiple) {
    replacedRegion = searchRegion.split(targetContent).join(replacementContent);
  } else {
    replacedRegion = searchRegion.replace(targetContent, replacementContent);
  }

  const updatedContent = `${prefix}${replacedRegion}${suffix}`;
  return { updatedContent, occurrences: count };
}

export const editFileTool: NativeToolDefinition<z.infer<typeof EditFileInputSchema>> = {
  name: 'edit_file',
  description: 'Edits an existing file by replacing exact target content with replacement content. Supports line range constraints and unique match validation.',
  category: 'editing',
  readOnly: false,
  tags: ['editing', 'file', 'replace'],
  parameters: EditFileInputSchema,
  execute: async (input: z.infer<typeof EditFileInputSchema>, context) => {
    const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);

    if (!fs.existsSync(fullPath)) {
      throw new FileOperationError('edit_file', input.path, `File does not exist at '${input.path}'`);
    }

    const currentContent = await fs.promises.readFile(fullPath, 'utf-8');

    try {
      const { updatedContent, occurrences } = applyTargetReplacement(
        currentContent,
        input.targetContent,
        input.replacementContent,
        {
          startLine: input.startLine,
          endLine: input.endLine,
          allowMultiple: input.allowMultiple,
        }
      );

      await fs.promises.writeFile(fullPath, updatedContent, 'utf-8');

      return {
        path: input.path,
        occurrencesReplaced: occurrences,
        bytesWritten: Buffer.byteLength(updatedContent, 'utf-8'),
      };
    } catch (err) {
      throw new FileOperationError('edit_file', input.path, err instanceof Error ? err.message : String(err), err);
    }
  },
};

export const editManyFilesTool: NativeToolDefinition<z.infer<typeof EditManyFilesInputSchema>> = {
  name: 'edit_many_files',
  description: 'Applies multiple targeted edits across one or multiple files in sequence with atomic validation.',
  category: 'editing',
  readOnly: false,
  tags: ['editing', 'batch', 'multi-file'],
  parameters: EditManyFilesInputSchema,
  execute: async (input: z.infer<typeof EditManyFilesInputSchema>, context) => {
    // If atomic, perform dry run on all files in memory first
    const plannedWrites: Array<{ fullPath: string; relPath: string; newContent: string; occurrences: number }> = [];

    // Map to keep track of current content per file across multiple edits to the same file
    const fileContentMap = new Map<string, string>();

    for (const edit of input.edits) {
      const fullPath = resolveWorkspacePath(edit.path, context?.workspaceRoot);

      if (!fs.existsSync(fullPath)) {
        if (input.atomic) {
          throw new FileOperationError('edit_many_files', edit.path, `File does not exist at '${edit.path}'`);
        }
        continue;
      }

      let content = fileContentMap.get(fullPath);
      if (content === undefined) {
        content = await fs.promises.readFile(fullPath, 'utf-8');
      }

      try {
        const { updatedContent, occurrences } = applyTargetReplacement(
          content,
          edit.targetContent,
          edit.replacementContent,
          {
            startLine: edit.startLine,
            endLine: edit.endLine,
            allowMultiple: edit.allowMultiple,
          }
        );

        fileContentMap.set(fullPath, updatedContent);
        plannedWrites.push({
          fullPath,
          relPath: edit.path,
          newContent: updatedContent,
          occurrences,
        });
      } catch (err) {
        if (input.atomic) {
          throw new FileOperationError(
            'edit_many_files',
            edit.path,
            `Edit validation failed: ${err instanceof Error ? err.message : String(err)}`,
            err
          );
        }
      }
    }

    // Write all modified contents to disk
    const results = [];
    for (const [fullPath, newContent] of fileContentMap.entries()) {
      await fs.promises.writeFile(fullPath, newContent, 'utf-8');
      const matchingEdits = plannedWrites.filter((p) => p.fullPath === fullPath);
      const totalOccurrences = matchingEdits.reduce((acc, curr) => acc + curr.occurrences, 0);

      results.push({
        path: matchingEdits[0]?.relPath ?? fullPath,
        success: true,
        occurrencesReplaced: totalOccurrences,
      });
    }

    return {
      results,
      totalFilesModified: fileContentMap.size,
      totalEditsApplied: plannedWrites.length,
    };
  },
};

export const appendFileTool: NativeToolDefinition<z.infer<typeof AppendFileInputSchema>> = {
  name: 'append_file',
  description: 'Appends text content to the end of an existing file (or creates it if missing).',
  category: 'editing',
  readOnly: false,
  tags: ['editing', 'append'],
  parameters: AppendFileInputSchema,
  execute: async (input: z.infer<typeof AppendFileInputSchema>, context) => {
    const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);
    const parentDir = path.dirname(fullPath);
    await fs.promises.mkdir(parentDir, { recursive: true });

    let textToAppend = input.content;
    if (input.addNewline && !textToAppend.endsWith('\n')) {
      textToAppend += '\n';
    }

    await fs.promises.appendFile(fullPath, textToAppend, 'utf-8');

    return {
      path: input.path,
      appendedBytes: Buffer.byteLength(textToAppend, 'utf-8'),
    };
  },
};

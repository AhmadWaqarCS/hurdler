import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  ListDirectoryInputSchema,
  CreateDirectoryInputSchema,
  SearchFilesInputSchema,
} from '../schema.js';
import { resolveWorkspacePath, getCanonicalWorkspaceRoot } from '../security.js';
import { FileOperationError } from '../errors.js';
import type { NativeToolDefinition } from '../types.js';

interface DirectoryEntry {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  isFile: boolean;
  sizeBytes?: number;
  modifiedAt?: string;
}

/**
 * Pure helper to test if a relative path matches any ignore patterns.
 */
function isIgnored(relPath: string, ignorePatterns: string[]): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  for (const pattern of ignorePatterns) {
    const cleanPattern = pattern.replace(/^\/|\/$/g, '');
    if (
      normalized === cleanPattern ||
      normalized.startsWith(cleanPattern + '/') ||
      normalized.includes('/' + cleanPattern + '/') ||
      normalized.endsWith('/' + cleanPattern)
    ) {
      return true;
    }
  }
  return false;
}

export const listDirectoryTool: NativeToolDefinition<z.infer<typeof ListDirectoryInputSchema>> = {
  name: 'list_directory',
  description: 'Lists files and subdirectories in a directory with recursion controls, depth limits, and ignore filters.',
  category: 'search',
  readOnly: true,
  tags: ['filesystem', 'directory', 'list', 'search'],
  parameters: ListDirectoryInputSchema,
  execute: async (input: z.infer<typeof ListDirectoryInputSchema>, context) => {
    const canonicalRoot = getCanonicalWorkspaceRoot(context?.workspaceRoot);
    const fullPath = resolveWorkspacePath(input.path, canonicalRoot);

    if (!fs.existsSync(fullPath)) {
      throw new FileOperationError('list_directory', input.path, `Directory does not exist at '${input.path}'`);
    }

    const stat = await fs.promises.stat(fullPath);
    if (!stat.isDirectory()) {
      throw new FileOperationError('list_directory', input.path, `Path '${input.path}' is a file, not a directory.`);
    }

    const entries: DirectoryEntry[] = [];
    const ignoreList = input.ignorePatterns ?? ['node_modules', '.git', 'dist', '.next', 'build'];

    async function walk(currentDir: string, currentDepth: number): Promise<void> {
      if (currentDepth > (input.maxDepth ?? 3)) {
        return;
      }

      const dirents = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const dirent of dirents) {
        const itemFullPath = path.join(currentDir, dirent.name);
        const itemRelPath = path.relative(canonicalRoot, itemFullPath);

        if (isIgnored(itemRelPath, ignoreList) || isIgnored(dirent.name, ignoreList)) {
          continue;
        }

        const isDir = dirent.isDirectory();
        const isFile = dirent.isFile();

        let sizeBytes: number | undefined;
        let modifiedAt: string | undefined;

        if (input.includeStats) {
          try {
            const itemStat = await fs.promises.stat(itemFullPath);
            sizeBytes = itemStat.size;
            modifiedAt = itemStat.mtime.toISOString();
          } catch {
            // Stat failed or permission denied, ignore
          }
        }

        entries.push({
          name: dirent.name,
          relativePath: itemRelPath,
          isDirectory: isDir,
          isFile,
          sizeBytes,
          modifiedAt,
        });

        if (isDir && input.recursive) {
          await walk(itemFullPath, currentDepth + 1);
        }
      }
    }

    await walk(fullPath, 1);

    return {
      path: input.path,
      entries,
      totalEntries: entries.length,
    };
  },
};

export const createDirectoryTool: NativeToolDefinition<z.infer<typeof CreateDirectoryInputSchema>> = {
  name: 'create_directory',
  description: 'Recursively creates a new directory if it does not already exist.',
  category: 'filesystem',
  readOnly: false,
  tags: ['filesystem', 'directory', 'mkdir'],
  parameters: CreateDirectoryInputSchema,
  execute: async (input: z.infer<typeof CreateDirectoryInputSchema>, context) => {
    const fullPath = resolveWorkspacePath(input.path, context?.workspaceRoot);
    const exists = fs.existsSync(fullPath);

    if (!exists) {
      await fs.promises.mkdir(fullPath, { recursive: input.recursive });
    }

    return {
      path: input.path,
      created: !exists,
      alreadyExisted: exists,
    };
  },
};

interface SearchMatch {
  file: string;
  lineNumber: number;
  lineContent: string;
  matchStart?: number;
  matchEnd?: number;
}

export const searchFilesTool: NativeToolDefinition<z.infer<typeof SearchFilesInputSchema>> = {
  name: 'search_files',
  description: 'Searches for text content or regular expressions across files within the workspace.',
  category: 'search',
  readOnly: true,
  tags: ['search', 'grep', 'regex', 'find'],
  parameters: SearchFilesInputSchema,
  execute: async (input: z.infer<typeof SearchFilesInputSchema>, context) => {
    const canonicalRoot = getCanonicalWorkspaceRoot(context?.workspaceRoot);
    const fullSearchPath = resolveWorkspacePath(input.path, canonicalRoot);

    if (!fs.existsSync(fullSearchPath)) {
      throw new FileOperationError('search_files', input.path, `Path does not exist at '${input.path}'`);
    }

    let regex: RegExp;
    if (input.isRegex) {
      regex = new RegExp(input.query, input.caseInsensitive ? 'i' : '');
    } else {
      const escaped = input.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, input.caseInsensitive ? 'i' : '');
    }

    const matches: SearchMatch[] = [];
    const maxResults = input.maxResults ?? 100;
    const excludes = input.excludePatterns ?? ['node_modules', '.git', 'dist', '.next'];

    async function searchDir(dir: string): Promise<void> {
      if (matches.length >= maxResults) return;

      const dirents = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const dirent of dirents) {
        if (matches.length >= maxResults) break;

        const itemFullPath = path.join(dir, dirent.name);
        const itemRelPath = path.relative(canonicalRoot, itemFullPath);

        if (isIgnored(itemRelPath, excludes) || isIgnored(dirent.name, excludes)) {
          continue;
        }

        if (dirent.isDirectory()) {
          await searchDir(itemFullPath);
        } else if (dirent.isFile()) {
          // Check extension / include patterns if specified
          if (input.includePatterns && input.includePatterns.length > 0) {
            const matchesInclude = input.includePatterns.some((pattern: string) => {
              const ext = pattern.replace(/^\*/, '');
              return itemRelPath.endsWith(ext);
            });
            if (!matchesInclude) continue;
          }

          // Skip known large binary files
          if (/\.(png|jpg|jpeg|gif|webp|ico|svg|pdf|zip|tar|gz|exe|dll|dylib|so|lock)$/i.test(dirent.name)) {
            continue;
          }

          try {
            const stat = await fs.promises.stat(itemFullPath);
            if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

            const content = await fs.promises.readFile(itemFullPath, 'utf-8');
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
              if (matches.length >= maxResults) break;
              const line = lines[i];
              const matchResult = regex.exec(line);
              if (matchResult) {
                matches.push({
                  file: itemRelPath,
                  lineNumber: i + 1,
                  lineContent: line.trim(),
                  matchStart: matchResult.index,
                  matchEnd: matchResult.index + matchResult[0].length,
                });
              }
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }

    const stat = await fs.promises.stat(fullSearchPath);
    if (stat.isFile()) {
      const content = await fs.promises.readFile(fullSearchPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxResults) break;
        const line = lines[i];
        const matchResult = regex.exec(line);
        if (matchResult) {
          matches.push({
            file: path.relative(canonicalRoot, fullSearchPath),
            lineNumber: i + 1,
            lineContent: line.trim(),
            matchStart: matchResult.index,
            matchEnd: matchResult.index + matchResult[0].length,
          });
        }
      }
    } else {
      await searchDir(fullSearchPath);
    }

    return {
      query: input.query,
      isRegex: input.isRegex,
      totalMatches: matches.length,
      matches,
      truncated: matches.length >= maxResults,
    };
  },
};

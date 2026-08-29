import path from 'node:path';
import fs from 'node:fs';
import type { CodeLanguage } from './types.js';
import { CodeSecurityError } from './errors.js';

/**
 * Maps common file extensions to Hurdler CodeLanguage.
 */
export function detectLanguageFromPath(filePath: string): CodeLanguage {
  if (!filePath) return 'unknown';
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.tsx':
      return 'typescriptreact';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.jsx':
      return 'javascriptreact';
    case '.json':
    case '.jsonc':
      return 'json';
    case '.css':
      return 'css';
    case '.scss':
    case '.sass':
      return 'scss';
    case '.html':
    case '.htm':
      return 'html';
    case '.md':
    case '.mdx':
      return 'markdown';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.py':
      return 'python';
    default:
      return 'unknown';
  }
}

/**
 * Infers appropriate Prettier parser for a given file path or language.
 */
export function inferPrettierParser(filePath: string, language?: CodeLanguage): string {
  const lang = language ?? detectLanguageFromPath(filePath);

  switch (lang) {
    case 'typescript':
      return 'typescript';
    case 'typescriptreact':
      return 'typescript';
    case 'javascript':
    case 'javascriptreact':
      return 'babel';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'html':
      return 'html';
    case 'markdown':
      return 'markdown';
    case 'yaml':
      return 'yaml';
    default: {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.ts' || ext === '.mts' || ext === '.cts' || ext === '.tsx') return 'typescript';
      if (ext === '.json') return 'json';
      if (ext === '.css') return 'css';
      if (ext === '.scss') return 'scss';
      if (ext === '.html') return 'html';
      if (ext === '.md' || ext === '.mdx') return 'markdown';
      if (ext === '.yaml' || ext === '.yml') return 'yaml';
      return 'babel';
    }
  }
}

/**
 * Infers Tree-sitter language string from file path.
 */
export function inferTreeSitterLanguage(filePath: string): 'typescript' | 'tsx' | 'javascript' | 'json' | 'unknown' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.jsx':
      return 'javascript';
    case '.json':
      return 'json';
    default:
      return 'unknown';
  }
}

/**
 * Validates and normalizes code file paths against directory traversal.
 */
export function sanitizeCodeFilePath(targetPath: string, allowedRoot?: string): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new CodeSecurityError('File path must be a non-empty string');
  }

  const root = allowedRoot ? path.resolve(allowedRoot) : process.cwd();
  const resolved = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(root, targetPath);

  if (allowedRoot) {
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new CodeSecurityError(`Target path escapes allowed project root: ${targetPath}`, {
        filePath: targetPath,
        details: { allowedRoot: root, resolvedPath: resolved },
      });
    }
  }

  return resolved;
}

/**
 * Extracts a code snippet around a specific line number with pointer indicators.
 */
export function extractCodeSnippet(
  code: string,
  line: number,
  column = 1,
  contextLines = 2
): string {
  if (!code) return '';
  const lines = code.split('\n');
  const targetIndex = line - 1;

  if (targetIndex < 0 || targetIndex >= lines.length) {
    return '';
  }

  const startIndex = Math.max(0, targetIndex - contextLines);
  const endIndex = Math.min(lines.length - 1, targetIndex + contextLines);

  const output: string[] = [];
  const maxLineDigits = String(endIndex + 1).length;

  for (let i = startIndex; i <= endIndex; i++) {
    const currentLineNum = i + 1;
    const paddedNum = String(currentLineNum).padStart(maxLineDigits, ' ');
    const isTarget = i === targetIndex;
    const marker = isTarget ? '>' : ' ';
    output.push(`${marker} ${paddedNum} | ${lines[i]}`);

    if (isTarget && column > 0) {
      const pointerIndent = ' '.repeat(marker.length + 1 + maxLineDigits + 3 + Math.max(0, column - 1));
      output.push(`${pointerIndent}^`);
    }
  }

  return output.join('\n');
}

/**
 * Formats a 1-indexed line and column into a standard location string (e.g. "L12:C5").
 */
export function formatLocation(line: number, column?: number): string {
  if (typeof column === 'number' && column > 0) {
    return `L${line}:C${column}`;
  }
  return `L${line}`;
}

/**
 * Checks if a file exists synchronously.
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Computes a deterministic SHA-256 hash of a string content.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Sanitizes a file path ensuring it is relative to project root with forward slashes.
 */
export function sanitizeRelativePath(filePath: string, projectRoot?: string): string {
  let relative = filePath;
  if (projectRoot && path.isAbsolute(filePath)) {
    relative = path.relative(projectRoot, filePath);
  } else if (path.isAbsolute(filePath)) {
    relative = path.relative(process.cwd(), filePath);
  }

  // Normalize Windows backslashes to POSIX forward slashes
  return relative.split(path.sep).join('/');
}

/**
 * Resolves a relative import specifier to a relative project file path if it points to a local file.
 * Returns null if the import is an external npm package.
 */
export function resolveImportPath(
  importSpecifier: string,
  currentFile: string,
  projectRoot: string
): string | null {
  if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('@/')) {
    // External package
    return null;
  }

  const currentDir = path.dirname(path.resolve(projectRoot, currentFile));
  let candidateBase: string;

  if (importSpecifier.startsWith('@/')) {
    // Next.js style root alias '@/...'
    candidateBase = path.resolve(projectRoot, importSpecifier.slice(2));
  } else {
    candidateBase = path.resolve(currentDir, importSpecifier);
  }

  // Potential extensions to check
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'];

  for (const ext of extensions) {
    const candidate = candidateBase + ext;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return sanitizeRelativePath(candidate, projectRoot);
      }
    } catch {
      // Continue searching
    }
  }

  // Fallback to relative guess without extension if file not present on disk
  const relGuess = sanitizeRelativePath(candidateBase, projectRoot);
  return relGuess;
}

/**
 * Extracts leading comments preceding a specific line number from source code.
 */
export function extractLeadingComments(sourceCode: string, lineStart: number): string | undefined {
  if (lineStart <= 1) return undefined;

  const lines = sourceCode.split('\n');
  const targetIdx = lineStart - 1; // 0-indexed line of declaration
  const commentLines: string[] = [];

  let idx = targetIdx - 1;
  while (idx >= 0) {
    const line = lines[idx].trim();
    if (line.startsWith('//')) {
      commentLines.unshift(line.replace(/^\/\/\s*/, ''));
      idx--;
    } else if (line.endsWith('*/')) {
      // Block comment
      const block: string[] = [];
      while (idx >= 0) {
        const bLine = lines[idx].trim();
        block.unshift(bLine.replace(/^\/\*+\s*|\s*\*+\/$/g, '').replace(/^\*\s*/, ''));
        if (bLine.startsWith('/*')) break;
        idx--;
      }
      commentLines.unshift(...block);
      idx--;
    } else {
      break;
    }
  }

  if (commentLines.length === 0) return undefined;
  return commentLines.filter(Boolean).join('\n');
}

/**
 * Extracts searchable semantic tags from a JSDoc docstring or comment text.
 */
export function extractTagsFromDocstring(docstring?: string): string[] {
  if (!docstring) return [];

  const tags = new Set<string>();
  const tagMatches = docstring.match(/@([a-zA-Z0-9_-]+)/g);
  if (tagMatches) {
    for (const t of tagMatches) {
      const clean = t.slice(1).toLowerCase();
      if (!['param', 'returns', 'return', 'type', 'template', 'typedef'].includes(clean)) {
        tags.add(clean);
      }
    }
  }

  const lower = docstring.toLowerCase();
  if (lower.includes('validation') || lower.includes('zod')) tags.add('validation');
  if (lower.includes('auth') || lower.includes('session') || lower.includes('permission')) tags.add('auth');
  if (lower.includes('database') || lower.includes('query') || lower.includes('sql') || lower.includes('prisma')) tags.add('database');
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) tags.add('api');
  if (lower.includes('cache') || lower.includes('redis')) tags.add('cache');

  return Array.from(tags);
}

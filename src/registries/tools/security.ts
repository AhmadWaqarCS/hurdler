import fs from 'fs';
import path from 'path';
import { PathSecurityError, FileOperationError } from './errors.js';

/**
 * Returns the canonical absolute path for a workspace root.
 */
export function getCanonicalWorkspaceRoot(root?: string): string {
  const target = root || process.cwd();
  return path.resolve(target);
}

/**
 * Checks if a target path resides within the authorized workspace root.
 */
export function isSafePath(targetPath: string, workspaceRoot?: string): boolean {
  try {
    const canonicalRoot = getCanonicalWorkspaceRoot(workspaceRoot);
    const resolvedPath = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(canonicalRoot, targetPath);

    const relative = path.relative(canonicalRoot, resolvedPath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

/**
 * Resolves a given path against the workspace root and strictly guards against directory traversal.
 * Throws PathSecurityError if the resolved path escapes the workspace root boundary.
 */
export function resolveWorkspacePath(
  targetPath: string,
  workspaceRoot?: string,
  options: { allowOutside?: boolean } = {}
): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new PathSecurityError(String(targetPath), workspaceRoot || process.cwd(), 'Path must be a non-empty string');
  }

  const canonicalRoot = getCanonicalWorkspaceRoot(workspaceRoot);
  const resolvedPath = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(canonicalRoot, targetPath);

  if (options.allowOutside) {
    return resolvedPath;
  }

  const relative = path.relative(canonicalRoot, resolvedPath);
  const escapesRoot = relative.startsWith('..') || path.isAbsolute(relative);

  if (escapesRoot) {
    throw new PathSecurityError(
      targetPath,
      canonicalRoot,
      `Resolved path '${resolvedPath}' escapes workspace root`
    );
  }

  return resolvedPath;
}

/**
 * Checks file size before reading to prevent out-of-memory or excessive token usage.
 */
export async function validateFileSize(
  fullPath: string,
  maxBytes = 10 * 1024 * 1024
): Promise<fs.Stats | null> {
  try {
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const stat = await fs.promises.stat(fullPath);
    if (stat.size > maxBytes) {
      throw new FileOperationError(
        'read',
        fullPath,
        `File size (${stat.size} bytes) exceeds maximum allowable limit (${maxBytes} bytes).`
      );
    }
    return stat;
  } catch (error) {
    if (error instanceof FileOperationError) {
      throw error;
    }
    throw new FileOperationError(
      'stat',
      fullPath,
      error instanceof Error ? error.message : String(error),
      error
    );
  }
}

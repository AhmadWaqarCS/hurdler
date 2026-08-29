import fs from 'node:fs';
import path from 'node:path';
import { simpleGit, type SimpleGit, type SimpleGitOptions } from 'simple-git';
import { devDebug, devError, devInfo } from '../core/dev-mode/index.js';
import {
  GitError,
  GitConflictError,
  GitBranchNotFoundError,
  GitBranchAlreadyExistsError,
  GitRepositoryNotFoundError,
} from './errors.js';

// Cache simple-git instances by resolved repository root path to reduce initialization overhead
const clientCache = new Map<string, SimpleGit>();

/**
 * Resolves and canonicalizes a repository path.
 */
export function canonicalizeRepoPath(repoPath: string): string {
  if (!repoPath || typeof repoPath !== 'string') {
    throw new GitError('Repository path must be a non-empty string.');
  }
  return path.resolve(repoPath.trim());
}

/**
 * Retrieves or creates a cached SimpleGit client for a repository path.
 */
export function getGitClient(repoPath: string, customOptions?: Partial<SimpleGitOptions>): SimpleGit {
  const canonicalPath = canonicalizeRepoPath(repoPath);

  if (clientCache.has(canonicalPath) && !customOptions) {
    return clientCache.get(canonicalPath)!;
  }

  const options: Partial<SimpleGitOptions> = {
    baseDir: canonicalPath,
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: true,
    ...customOptions,
  };

  const client = simpleGit(options);

  if (!customOptions) {
    clientCache.set(canonicalPath, client);
    devDebug('GIT_CLIENT', `Initialized and cached SimpleGit client for: ${canonicalPath}`);
  }

  return client;
}

/**
 * Clears the SimpleGit client cache.
 */
export function clearGitClientCache(): void {
  clientCache.clear();
  devDebug('GIT_CLIENT', 'Cleared SimpleGit client cache.');
}

/**
 * Higher-order wrapper for executing Git operations with standardized error handling,
 * performance measurement, and Dev Mode observability.
 */
export async function withGitErrorHandling<T>(
  operationName: string,
  repoPath: string,
  operation: (client: SimpleGit) => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let canonicalPath = '';

  try {
    canonicalPath = canonicalizeRepoPath(repoPath);

    if (!fs.existsSync(canonicalPath)) {
      throw new GitRepositoryNotFoundError(canonicalPath);
    }

    const client = getGitClient(canonicalPath);
    devDebug('GIT_OP', `[START] ${operationName} in ${canonicalPath}`);
    const result = await operation(client);
    const durationMs = Date.now() - startTime;
    devDebug('GIT_OP', `[SUCCESS] ${operationName} completed in ${durationMs}ms`);
    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const rawMessage = err instanceof Error ? err.message : String(err);

    devError('GIT_OP', `[FAILED] ${operationName} failed after ${durationMs}ms: ${rawMessage}`);

    // If it's already a specialized Hurdler GitError, rethrow directly
    if (err instanceof GitError) {
      throw err;
    }

    // Inspect error message for common Git scenarios
    if (
      rawMessage.includes('not a git repository') ||
      rawMessage.includes('Cannot use simple-git on a directory that does not exist') ||
      rawMessage.includes('does not exist')
    ) {
      throw new GitRepositoryNotFoundError(canonicalPath || repoPath, { cause: err });
    }


    if (rawMessage.includes('CONFLICT') || rawMessage.includes('fix conflicts and then commit the result')) {
      const conflictMatches = rawMessage.match(/CONFLICT \([^)]+\): (?:Merge conflict in )?([^\n\r]+)/g) ?? [];
      const conflictFiles = conflictMatches.map((m) => {
        const parts = m.split(':');
        return (parts[1] || '').trim().replace(/^Merge conflict in /, '');
      });
      throw new GitConflictError(conflictFiles, `Git conflict during ${operationName}: ${rawMessage}`, {
        cause: err,
        repoPath: canonicalPath,
        command: operationName,
      });
    }

    if (rawMessage.includes('pathspec') && rawMessage.includes('did not match any file(s) known to git')) {
      const match = rawMessage.match(/pathspec '([^']+)' did not match/);
      const branchName = match ? match[1] : 'unknown';
      throw new GitBranchNotFoundError(branchName, { cause: err, repoPath: canonicalPath });
    }

    if (rawMessage.includes('already exists')) {
      const match = rawMessage.match(/branch named '([^']+)' already exists/);
      const branchName = match ? match[1] : 'unknown';
      throw new GitBranchAlreadyExistsError(branchName, { cause: err, repoPath: canonicalPath });
    }

    throw new GitError(`Git operation '${operationName}' failed: ${rawMessage}`, {
      cause: err,
      command: operationName,
      repoPath: canonicalPath,
      stderr: rawMessage,
    });
  }
}

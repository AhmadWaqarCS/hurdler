import { withGitErrorHandling } from './client.js';
import type { MergeOptions, MergeResult, GitAuthor } from './types.js';
import { MergeOptionsSchema } from './schema.js';
import { getAgentAuthor, formatAuthorArg } from './authors.js';
import { devInfo, devWarn } from '../core/dev-mode/index.js';
import { GitConflictError, GitValidationError } from './errors.js';

/**
 * Merges a source branch into the target branch (or current active branch).
 *
 * @param repoPath - Repository root directory path.
 * @param options - Merge options (sourceBranch, targetBranch, author, agentId, fastForwardOnly, noFf, squash, message).
 * @returns Structured MergeResult indicating success, merged commit hash, or conflict list.
 *
 * @example
 * ```typescript
 * const result = await mergeBranch('/my-repo', {
 *   sourceBranch: 'feature/auth',
 *   targetBranch: 'main',
 *   noFf: true,
 *   agentId: 'orchestrator',
 * });
 * console.log(result.success, result.mergedCommitHash);
 * ```
 */
export async function mergeBranch(repoPath: string, options: MergeOptions): Promise<MergeResult> {
  const parsed = MergeOptionsSchema.parse(options);
  const author: GitAuthor = parsed.author ?? getAgentAuthor(parsed.agentId);
  const authorArg = formatAuthorArg(author);

  return withGitErrorHandling('mergeBranch', repoPath, async (client) => {
    // If targetBranch is specified, switch to it first
    if (parsed.targetBranch) {
      const current = (await client.revparse(['--abbrev-ref', 'HEAD'])).trim();
      if (current !== parsed.targetBranch) {
        await client.checkout(parsed.targetBranch);
      }
    }

    const mergeArgs: string[] = [parsed.sourceBranch];

    if (parsed.fastForwardOnly) {
      mergeArgs.push('--ff-only');
    } else if (parsed.noFf) {
      mergeArgs.push('--no-ff');
    }

    if (parsed.squash) {
      mergeArgs.push('--squash');
    }

    if (parsed.message) {
      mergeArgs.push('-m', parsed.message);
    }

    try {
      const mergeSummary = await client.merge(mergeArgs);

      // If no-ff or squash commit with author is needed
      if (parsed.noFf && parsed.message) {
        try {
          await client.commit(parsed.message, undefined, { '--author': authorArg });
        } catch {
          // Commit might already be complete
        }
      }

      const isAlreadyUpToDate =
        mergeSummary.result === 'Already up to date' ||
        (mergeSummary.merges && mergeSummary.merges.length === 0 && mergeSummary.files.length === 0);

      const latestCommit = (await client.revparse(['HEAD'])).trim();

      const result: MergeResult = {
        success: true,
        mergedCommitHash: latestCommit,
        conflicts: mergeSummary.conflicts.map((c) => (typeof c === 'string' ? c : (c as any).file || String(c))),
        fastForward: !parsed.noFf && !parsed.squash,
        alreadyUpToDate: isAlreadyUpToDate,
        message: mergeSummary.result,
      };

      devInfo(
        'GIT_MERGE',
        `Merged '${parsed.sourceBranch}' successfully into current branch. Commit: ${latestCommit} (alreadyUpToDate: ${result.alreadyUpToDate})`
      );

      return result;
    } catch (err: unknown) {
      if (err instanceof GitConflictError) {
        devWarn('GIT_MERGE', `Merge conflict detected while merging '${parsed.sourceBranch}': ${err.conflicts.join(', ')}`);
        return {
          success: false,
          conflicts: err.conflicts,
          fastForward: false,
          alreadyUpToDate: false,
          message: err.message,
        };
      }
      throw err;
    }
  });
}

/**
 * Aborts an in-progress merge with conflicts (`git merge --abort`).
 *
 * @param repoPath - Repository root directory path.
 *
 * @example
 * ```typescript
 * await abortMerge('/my-repo');
 * ```
 */
export async function abortMerge(repoPath: string): Promise<void> {
  return withGitErrorHandling('abortMerge', repoPath, async (client) => {
    await client.merge(['--abort']);
    devInfo('GIT_MERGE', 'Aborted in-progress merge.');
  });
}

/**
 * Retrieves the list of currently conflicted files in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @returns Array of conflicted file paths.
 *
 * @example
 * ```typescript
 * const conflicts = await getConflictFiles('/my-repo');
 * ```
 */
export async function getConflictFiles(repoPath: string): Promise<string[]> {
  return withGitErrorHandling('getConflictFiles', repoPath, async (client) => {
    const status = await client.status();
    return status.conflicted;
  });
}

/**
 * Marks a conflicted file as resolved by staging it.
 *
 * @param repoPath - Repository root directory path.
 * @param filePath - Path to the resolved file.
 *
 * @example
 * ```typescript
 * await resolveConflictFile('/my-repo', 'src/auth.ts');
 * ```
 */
export async function resolveConflictFile(repoPath: string, filePath: string): Promise<void> {
  if (!filePath || !filePath.trim()) {
    throw new GitValidationError('File path to resolve conflict cannot be empty.');
  }

  return withGitErrorHandling('resolveConflictFile', repoPath, async (client) => {
    await client.add(filePath.trim());
    devInfo('GIT_MERGE', `Marked conflict resolved for file: ${filePath}`);
  });
}

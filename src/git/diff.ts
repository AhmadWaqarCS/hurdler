import { withGitErrorHandling } from './client.js';
import type { DiffOptions, DiffResult } from './types.js';
import { parseCommaSeparatedList } from '../common/helpers.js';

/**
 * Retrieves full diff output and per-file change statistics between working directory, index, or branches.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Diff query options (staged, baseRef, targetRef, filePaths, ignoreWhitespace).
 * @returns Structured DiffResult containing raw patch text and parsed per-file statistics.
 *
 * @example
 * ```typescript
 * const diff = await getDiff('/my-repo', { staged: true });
 * console.log(diff.files[0]?.file, diff.files[0]?.insertions);
 * ```
 */
export async function getDiff(repoPath: string, options?: DiffOptions): Promise<DiffResult> {
  return withGitErrorHandling('getDiff', repoPath, async (client) => {
    const diffArgs: string[] = [];

    if (options?.staged) {
      diffArgs.push('--staged');
    }

    if (options?.ignoreWhitespace) {
      diffArgs.push('-w');
    }

    if (options?.baseRef && options?.targetRef) {
      diffArgs.push(`${options.baseRef}..${options.targetRef}`);
    } else if (options?.baseRef) {
      diffArgs.push(options.baseRef);
    }

    const filePaths = options?.filePaths ? parseCommaSeparatedList(options.filePaths) : [];
    if (filePaths.length > 0) {
      diffArgs.push('--', ...filePaths);
    }

    const rawDiff = await client.diff(diffArgs);
    const summaryArgs = [...diffArgs.filter((a) => a !== '--' && !filePaths.includes(a)), '--stat'];
    const rawSummary = await client.diffSummary(summaryArgs);

    return {
      raw: rawDiff,
      files: rawSummary.files.map((f) => ({
        file: f.file,
        changes: 'changes' in f ? Number(f.changes) : 0,
        insertions: 'insertions' in f ? Number(f.insertions) : 0,
        deletions: 'deletions' in f ? Number(f.deletions) : 0,
        binary: 'binary' in f ? Boolean(f.binary) : false,
      })),
    };
  });
}

/**
 * Retrieves concise diff statistics summary without the full patch payload.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Diff query options.
 * @returns Array of per-file change statistics.
 *
 * @example
 * ```typescript
 * const summary = await getDiffSummary('/my-repo', { baseRef: 'main', targetRef: 'feature/auth' });
 * ```
 */
export async function getDiffSummary(repoPath: string, options?: DiffOptions) {
  const result = await getDiff(repoPath, options);
  return result.files;
}

/**
 * Retrieves diff for a single specific file.
 *
 * @param repoPath - Repository root directory path.
 * @param filePath - Path to file relative to repo root.
 * @param options - Staged or base ref options.
 * @returns Raw diff patch string for the single file.
 *
 * @example
 * ```typescript
 * const fileDiff = await getFileDiff('/my-repo', 'src/index.ts', { staged: true });
 * ```
 */
export async function getFileDiff(
  repoPath: string,
  filePath: string,
  options?: { staged?: boolean; baseRef?: string }
): Promise<string> {
  return withGitErrorHandling('getFileDiff', repoPath, async (client) => {
    const args: string[] = [];
    if (options?.staged) {
      args.push('--staged');
    }
    if (options?.baseRef) {
      args.push(options.baseRef);
    }
    args.push('--', filePath);

    return await client.diff(args);
  });
}

/**
 * Shows the contents of a file at a specific commit, branch, or tag reference (`git show <ref>:<filePath>`).
 *
 * @param repoPath - Repository root directory path.
 * @param filePath - File path relative to repo root.
 * @param ref - Git ref (commit hash, branch, or tag). Defaults to 'HEAD'.
 * @returns Content string of the file at the specified historical ref.
 *
 * @example
 * ```typescript
 * const historicalContent = await getShowFile('/my-repo', 'src/auth.ts', 'v1.0.0');
 * ```
 */
export async function getShowFile(repoPath: string, filePath: string, ref = 'HEAD'): Promise<string> {
  return withGitErrorHandling('getShowFile', repoPath, async (client) => {
    return await client.show([`${ref}:${filePath}`]);
  });
}

/**
 * Returns a list of filenames changed between two branches (`git diff --name-only baseBranch..targetBranch`).
 *
 * @param repoPath - Repository root directory path.
 * @param baseBranch - Base comparison branch.
 * @param targetBranch - Target comparison branch.
 * @returns Array of changed file paths.
 *
 * @example
 * ```typescript
 * const files = await getChangedFilesBetweenBranches('/my-repo', 'main', 'feature/auth');
 * ```
 */
export async function getChangedFilesBetweenBranches(
  repoPath: string,
  baseBranch: string,
  targetBranch: string
): Promise<string[]> {
  return withGitErrorHandling('getChangedFilesBetweenBranches', repoPath, async (client) => {
    const raw = await client.diff(['--name-only', `${baseBranch}..${targetBranch}`]);
    return parseCommaSeparatedList(raw.split('\n'));
  });
}

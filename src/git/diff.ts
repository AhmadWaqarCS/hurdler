import { withGitErrorHandling } from './client.js';
import type { DiffOptions, DiffResult } from './types.js';
import { parseCommaSeparatedList } from '../common/helpers.js';

/**
 * Retrieves diff summary and patch between working directory, index, or branches.
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
 * Retrieves diff for a single file.
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
 */
export async function getShowFile(repoPath: string, filePath: string, ref = 'HEAD'): Promise<string> {
  return withGitErrorHandling('getShowFile', repoPath, async (client) => {
    return await client.show([`${ref}:${filePath}`]);
  });
}

/**
 * Returns a list of filenames changed between two branches (`git diff --name-only baseBranch..targetBranch`).
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

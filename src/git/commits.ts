import { withGitErrorHandling } from './client.js';
import type {
  CommitOptions,
  CommitResult,
  CommitLogEntry,
  CommitDetails,
  GitLogOptions,
  GitAuthor,
  AmendOptions,
  RevertOptions,
  CherryPickOptions,
} from './types.js';
import {
  CommitOptionsSchema,
  AmendOptionsSchema,
  RevertOptionsSchema,
  CherryPickOptionsSchema,
} from './schema.js';
import { getAgentAuthor, formatAuthorArg } from './authors.js';
import { parseCommaSeparatedList } from '../common/helpers.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Commits staged changes with an explicit author identity (e.g. agent author).
 *
 * @param repoPath - Repository root directory path.
 * @param options - Commit options (message, author, agentId, files, amend, allowEmpty, noVerify).
 * @returns Structured CommitResult with commit hash, author metadata, and change statistics.
 *
 * @example
 * ```typescript
 * const result = await commit('/my-repo', {
 *   message: 'feat: add user authentication',
 *   agentId: 'business-logic',
 * });
 * console.log(result.hash, result.branch);
 * ```
 */
export async function commit(repoPath: string, options: CommitOptions): Promise<CommitResult> {
  const parsed = CommitOptionsSchema.parse(options);
  const author: GitAuthor = parsed.author ?? getAgentAuthor(parsed.agentId);
  const authorArg = formatAuthorArg(author);

  return withGitErrorHandling('commit', repoPath, async (client) => {
    const customArgs: Record<string, string | null> = {
      '--author': authorArg,
    };

    if (parsed.allowEmpty) {
      customArgs['--allow-empty'] = null;
    }
    if (parsed.amend) {
      customArgs['--amend'] = null;
    }
    if (parsed.noVerify) {
      customArgs['--no-verify'] = null;
    }

    const files = parsed.files ? parseCommaSeparatedList(parsed.files) : [];
    const rawResult = await client.commit(parsed.message, files.length > 0 ? files : undefined, customArgs);

    const result: CommitResult = {
      hash: rawResult.commit,
      branch: rawResult.branch,
      summary: {
        changes: rawResult.summary.changes,
        insertions: rawResult.summary.insertions,
        deletions: rawResult.summary.deletions,
      },
      author,
      message: parsed.message,
      timestamp: new Date().toISOString(),
    };

    devInfo(
      'GIT_COMMIT',
      `Committed [${result.branch} ${result.hash || 'HEAD'}] by ${authorArg}: "${parsed.message}" (+${result.summary.insertions}/-${result.summary.deletions})`
    );

    return result;
  });
}

/**
 * Convenience helper to stage specific files and commit them atomically with an agent author identity.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Staging and commit parameters.
 * @returns Structured CommitResult.
 *
 * @example
 * ```typescript
 * const result = await stageAndCommit('/my-repo', {
 *   files: ['src/services/auth.ts', 'src/types/auth.ts'],
 *   message: 'feat(auth): implement token generator',
 *   agentId: 'business-logic',
 * });
 * ```
 */
export async function stageAndCommit(
  repoPath: string,
  options: {
    files: string | string[];
    message: string;
    author?: GitAuthor;
    agentId?: string;
    allowEmpty?: boolean;
  }
): Promise<CommitResult> {
  const fileList = parseCommaSeparatedList(options.files);
  return withGitErrorHandling('stageAndCommit', repoPath, async (client) => {
    if (fileList.length > 0) {
      await client.add(fileList);
    }
    return commit(repoPath, {
      message: options.message,
      author: options.author,
      agentId: options.agentId,
      allowEmpty: options.allowEmpty,
    });
  });
}

/**
 * Amends the previous commit with updated message, files, or author.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Amend options.
 * @returns Structured CommitResult for the amended commit.
 *
 * @example
 * ```typescript
 * const amended = await amendCommit('/my-repo', { message: 'feat: add auth (updated)' });
 * ```
 */
export async function amendCommit(repoPath: string, options: AmendOptions): Promise<CommitResult> {
  const parsed = AmendOptionsSchema.parse(options);
  const head = await getHeadCommit(repoPath);
  const message = parsed.message ?? head?.message ?? 'chore: amended commit';
  const author = parsed.author ?? (parsed.agentId ? getAgentAuthor(parsed.agentId) : undefined);

  return commit(repoPath, {
    message,
    author,
    agentId: parsed.agentId,
    files: parsed.files,
    amend: true,
  });
}

/**
 * Reverts a previous commit by creating a new inverse commit.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Revert options with commit hash.
 *
 * @example
 * ```typescript
 * await revertCommit('/my-repo', { commitHash: 'abc1234' });
 * ```
 */
export async function revertCommit(repoPath: string, options: RevertOptions): Promise<void> {
  const parsed = RevertOptionsSchema.parse(options);
  return withGitErrorHandling('revertCommit', repoPath, async (client) => {
    const args = ['revert'];
    if (parsed.noCommit) {
      args.push('--no-commit');
    }
    args.push(parsed.commitHash);
    await client.raw(args);
    devInfo('GIT_COMMIT', `Reverted commit '${parsed.commitHash}'`);
  });
}

/**
 * Cherry-picks a commit from another branch into the current working branch.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Cherry pick options.
 *
 * @example
 * ```typescript
 * await cherryPickCommit('/my-repo', { commitHash: 'abc1234' });
 * ```
 */
export async function cherryPickCommit(repoPath: string, options: CherryPickOptions): Promise<void> {
  const parsed = CherryPickOptionsSchema.parse(options);
  return withGitErrorHandling('cherryPickCommit', repoPath, async (client) => {
    const args = ['cherry-pick'];
    if (parsed.noCommit) {
      args.push('-n');
    }
    args.push(parsed.commitHash);
    await client.raw(args);
    devInfo('GIT_COMMIT', `Cherry-picked commit '${parsed.commitHash}'`);
  });
}

/**
 * Retrieves commit history log entries.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Optional query filters (maxCount, fromRef, author, file, includeDiff).
 * @returns Array of CommitLogEntry objects.
 *
 * @example
 * ```typescript
 * const logs = await getCommitLog('/my-repo', { maxCount: 10, author: 'Orchestrator' });
 * ```
 */
export async function getCommitLog(repoPath: string, options?: GitLogOptions): Promise<CommitLogEntry[]> {
  return withGitErrorHandling('getCommitLog', repoPath, async (client) => {
    const logOptions: Record<string, any> = {
      maxCount: options?.maxCount ?? 50,
    };

    if (options?.fromRef) {
      logOptions.from = options.fromRef;
    }
    if (options?.file) {
      logOptions.file = options.file;
    }

    const rawLog = await client.log(logOptions);

    let entries: CommitLogEntry[] = rawLog.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author_name: entry.author_name,
      author_email: entry.author_email,
      body: entry.body || undefined,
      refs: entry.refs || undefined,
    }));

    if (options?.author) {
      const lowerAuthor = options.author.toLowerCase();
      entries = entries.filter(
        (e) => e.author_name.toLowerCase().includes(lowerAuthor) || e.author_email.toLowerCase().includes(lowerAuthor)
      );
    }

    return entries;
  });
}

/**
 * Retrieves full details for a single commit including changed files and diff summary.
 *
 * @param repoPath - Repository root directory path.
 * @param hash - The commit hash to inspect.
 * @returns Detailed CommitDetails object with diff and touched files.
 *
 * @example
 * ```typescript
 * const details = await getCommitDetails('/my-repo', 'HEAD');
 * console.log(details.files, details.diff);
 * ```
 */
export async function getCommitDetails(repoPath: string, hash: string): Promise<CommitDetails> {
  return withGitErrorHandling('getCommitDetails', repoPath, async (client) => {
    const rawLog = await client.log({ maxCount: 1, from: hash });
    const entry = rawLog.latest;

    if (!entry) {
      throw new Error(`Commit with hash '${hash}' not found.`);
    }

    const showRaw = await client.show([hash, '--stat', '--summary']);
    const nameOnlyRaw = await client.show([hash, '--name-only', '--format=']);
    const files = parseCommaSeparatedList(nameOnlyRaw.split('\n'));

    return {
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author_name: entry.author_name,
      author_email: entry.author_email,
      body: entry.body || undefined,
      refs: entry.refs || undefined,
      diff: showRaw,
      files,
    };
  });
}

/**
 * Retrieves the latest HEAD commit or returns null if repository has no commits.
 *
 * @param repoPath - Repository root directory path.
 * @returns The HEAD commit entry, or null if no commits exist.
 *
 * @example
 * ```typescript
 * const head = await getHeadCommit('/my-repo');
 * ```
 */
export async function getHeadCommit(repoPath: string): Promise<CommitLogEntry | null> {
  try {
    const logs = await getCommitLog(repoPath, { maxCount: 1 });
    return logs.length > 0 ? logs[0] : null;
  } catch {
    return null;
  }
}

/**
 * Returns the total number of commits reachable from HEAD or a specific branch.
 *
 * @param repoPath - Repository root directory path.
 * @param branch - Branch or ref name (defaults to 'HEAD').
 * @returns Count of reachable commits.
 *
 * @example
 * ```typescript
 * const count = await getCommitCount('/my-repo', 'main');
 * ```
 */
export async function getCommitCount(repoPath: string, branch = 'HEAD'): Promise<number> {
  return withGitErrorHandling('getCommitCount', repoPath, async (client) => {
    const countStr = await client.raw(['rev-list', '--count', branch]);
    return parseInt(countStr.trim(), 10) || 0;
  });
}

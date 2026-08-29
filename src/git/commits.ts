import { withGitErrorHandling } from './client.js';
import type {
  CommitOptions,
  CommitResult,
  CommitLogEntry,
  CommitDetails,
  GitLogOptions,
  GitAuthor,
} from './types.js';
import { CommitOptionsSchema } from './schema.js';
import { getAgentAuthor, formatAuthorArg } from './authors.js';
import { parseCommaSeparatedList } from '../common/helpers.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Commits staged changes with an explicit author identity (e.g. agent author).
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
 * Retrieves commit history log entries.
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
 */
export async function getCommitCount(repoPath: string, branch = 'HEAD'): Promise<number> {
  return withGitErrorHandling('getCommitCount', repoPath, async (client) => {
    const countStr = await client.raw(['rev-list', '--count', branch]);
    return parseInt(countStr.trim(), 10) || 0;
  });
}

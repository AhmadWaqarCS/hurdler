import { withGitErrorHandling } from './client.js';
import type { StashOptions, StashEntry, StashDetails } from './types.js';
import { devInfo } from '../core/dev-mode/index.js';
import { GitStashNotFoundError } from './errors.js';
import { parseCommaSeparatedList } from '../common/helpers.js';

/**
 * Stashes uncommitted working tree changes.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Optional stash message and includeUntracked preferences.
 * @returns Raw Git output string.
 *
 * @example
 * ```typescript
 * await stashChanges('/my-repo', { message: 'wip: auth feature', includeUntracked: true });
 * ```
 */
export async function stashChanges(repoPath: string, options?: StashOptions): Promise<string> {
  return withGitErrorHandling('stashChanges', repoPath, async (client) => {
    const stashArgs: string[] = ['push'];

    if (options?.includeUntracked) {
      stashArgs.push('-u');
    }

    if (options?.message) {
      stashArgs.push('-m', options.message);
    }

    const output = await client.stash(stashArgs);
    devInfo('GIT_STASH', `Stashed changes: ${options?.message ? `"${options.message}"` : '(default)'}`);
    return output;
  });
}

/**
 * Applies and drops the stash at the given index (default: 0 / stash@{0}).
 *
 * @param repoPath - Repository root directory path.
 * @param index - Index in stash list (default: 0).
 *
 * @example
 * ```typescript
 * await popStash('/my-repo', 0);
 * ```
 */
export async function popStash(repoPath: string, index = 0): Promise<void> {
  return withGitErrorHandling('popStash', repoPath, async (client) => {
    await client.stash(['pop', `stash@{${index}}`]);
    devInfo('GIT_STASH', `Popped stash@{${index}}`);
  });
}

/**
 * Applies the stash at the given index without dropping it from the stash list.
 *
 * @param repoPath - Repository root directory path.
 * @param index - Index in stash list (default: 0).
 *
 * @example
 * ```typescript
 * await applyStash('/my-repo', 0);
 * ```
 */
export async function applyStash(repoPath: string, index = 0): Promise<void> {
  return withGitErrorHandling('applyStash', repoPath, async (client) => {
    await client.stash(['apply', `stash@{${index}}`]);
    devInfo('GIT_STASH', `Applied stash@{${index}}`);
  });
}

/**
 * Lists all stashed entries in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @returns Array of StashEntry objects.
 *
 * @example
 * ```typescript
 * const stashes = await listStashes('/my-repo');
 * console.log(stashes.length, stashes[0]?.message);
 * ```
 */
export async function listStashes(repoPath: string): Promise<StashEntry[]> {
  return withGitErrorHandling('listStashes', repoPath, async (client) => {
    const stashList = await client.stashList();
    return stashList.all.map((item, idx) => ({
      index: idx,
      message: item.message,
      hash: item.hash,
      date: item.date,
    }));
  });
}

/**
 * Retrieves detailed inspection for a specific stash entry including diff and changed files.
 *
 * @param repoPath - Repository root directory path.
 * @param index - Stash index (default: 0).
 * @returns StashDetails object.
 * @throws GitStashNotFoundError if index is out of bounds.
 *
 * @example
 * ```typescript
 * const details = await getStashDetails('/my-repo', 0);
 * ```
 */
export async function getStashDetails(repoPath: string, index = 0): Promise<StashDetails> {
  const stashes = await listStashes(repoPath);
  const entry = stashes.find((s) => s.index === index);

  if (!entry) {
    throw new GitStashNotFoundError(index, { repoPath });
  }

  return withGitErrorHandling('getStashDetails', repoPath, async (client) => {
    const diff = await client.raw(['stash', 'show', '-p', `stash@{${index}}`]);
    const filesRaw = await client.raw(['stash', 'show', '--name-only', `stash@{${index}}`]);
    const changedFiles = parseCommaSeparatedList(filesRaw.split('\n'));

    return {
      ...entry,
      diff,
      changedFiles,
    };
  });
}

/**
 * Drops a specific stash entry without applying it.
 *
 * @param repoPath - Repository root directory path.
 * @param index - Stash index to drop (default: 0).
 *
 * @example
 * ```typescript
 * await dropStash('/my-repo', 0);
 * ```
 */
export async function dropStash(repoPath: string, index = 0): Promise<void> {
  return withGitErrorHandling('dropStash', repoPath, async (client) => {
    await client.stash(['drop', `stash@{${index}}`]);
    devInfo('GIT_STASH', `Dropped stash@{${index}}`);
  });
}

/**
 * Clears all stashed entries from the repository.
 *
 * @param repoPath - Repository root directory path.
 *
 * @example
 * ```typescript
 * await clearStashes('/my-repo');
 * ```
 */
export async function clearStashes(repoPath: string): Promise<void> {
  return withGitErrorHandling('clearStashes', repoPath, async (client) => {
    await client.stash(['clear']);
    devInfo('GIT_STASH', 'Cleared all stash entries.');
  });
}

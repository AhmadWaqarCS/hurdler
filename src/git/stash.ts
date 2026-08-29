import { withGitErrorHandling } from './client.js';
import type { StashOptions, StashEntry } from './types.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Stashes uncommitted working tree changes.
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
 */
export async function popStash(repoPath: string, index = 0): Promise<void> {
  return withGitErrorHandling('popStash', repoPath, async (client) => {
    await client.stash(['pop', `stash@{${index}}`]);
    devInfo('GIT_STASH', `Popped stash@{${index}}`);
  });
}

/**
 * Lists all stashed entries.
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
 * Drops a specific stash entry without applying it.
 */
export async function dropStash(repoPath: string, index = 0): Promise<void> {
  return withGitErrorHandling('dropStash', repoPath, async (client) => {
    await client.stash(['drop', `stash@{${index}}`]);
    devInfo('GIT_STASH', `Dropped stash@{${index}}`);
  });
}

/**
 * Clears all stashed entries.
 */
export async function clearStashes(repoPath: string): Promise<void> {
  return withGitErrorHandling('clearStashes', repoPath, async (client) => {
    await client.stash(['clear']);
    devInfo('GIT_STASH', 'Cleared all stash entries.');
  });
}

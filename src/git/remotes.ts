import { withGitErrorHandling } from './client.js';
import type { RemoteEntry } from './types.js';
import { devInfo } from '../core/dev-mode/index.js';
import { GitValidationError } from './errors.js';

/**
 * Lists all configured remotes with their fetch and push URLs.
 *
 * @param repoPath - Repository root directory path.
 * @returns Array of RemoteEntry objects.
 *
 * @example
 * ```typescript
 * const remotes = await getRemotes('/my-repo');
 * console.log(remotes[0]?.name, remotes[0]?.refs.fetch);
 * ```
 */
export async function getRemotes(repoPath: string): Promise<RemoteEntry[]> {
  return withGitErrorHandling('getRemotes', repoPath, async (client) => {
    const remotes = await client.getRemotes(true);
    return remotes.map((r) => ({
      name: r.name,
      refs: {
        fetch: r.refs.fetch || '',
        push: r.refs.push || '',
      },
    }));
  });
}

/**
 * Adds a new remote to the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param name - Remote name (e.g. 'origin', 'upstream').
 * @param url - Remote Git URL.
 *
 * @example
 * ```typescript
 * await addRemote('/my-repo', 'origin', 'https://github.com/user/repo.git');
 * ```
 */
export async function addRemote(repoPath: string, name: string, url: string): Promise<void> {
  if (!name.trim()) throw new GitValidationError('Remote name cannot be empty.');
  if (!url.trim()) throw new GitValidationError('Remote URL cannot be empty.');

  return withGitErrorHandling('addRemote', repoPath, async (client) => {
    await client.addRemote(name.trim(), url.trim());
    devInfo('GIT_REMOTE', `Added remote '${name}': ${url}`);
  });
}

/**
 * Sets or updates the URL for an existing remote.
 *
 * @param repoPath - Repository root directory path.
 * @param name - Remote name.
 * @param newUrl - The new remote URL.
 *
 * @example
 * ```typescript
 * await setRemoteUrl('/my-repo', 'origin', 'git@github.com:user/repo.git');
 * ```
 */
export async function setRemoteUrl(repoPath: string, name: string, newUrl: string): Promise<void> {
  if (!name.trim()) throw new GitValidationError('Remote name cannot be empty.');
  if (!newUrl.trim()) throw new GitValidationError('Remote URL cannot be empty.');

  return withGitErrorHandling('setRemoteUrl', repoPath, async (client) => {
    await client.raw(['remote', 'set-url', name.trim(), newUrl.trim()]);
    devInfo('GIT_REMOTE', `Updated remote URL for '${name}' -> ${newUrl}`);
  });
}

/**
 * Removes an existing remote from the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param name - Remote name to remove.
 *
 * @example
 * ```typescript
 * await removeRemote('/my-repo', 'upstream');
 * ```
 */
export async function removeRemote(repoPath: string, name: string): Promise<void> {
  return withGitErrorHandling('removeRemote', repoPath, async (client) => {
    await client.removeRemote(name);
    devInfo('GIT_REMOTE', `Removed remote '${name}'`);
  });
}

/**
 * Fetches updates from a remote repository.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Remote name and prune preferences.
 *
 * @example
 * ```typescript
 * await fetchRemote('/my-repo', { remote: 'origin', prune: true });
 * ```
 */
export async function fetchRemote(
  repoPath: string,
  options?: { remote?: string; prune?: boolean }
): Promise<void> {
  return withGitErrorHandling('fetchRemote', repoPath, async (client) => {
    const remote = options?.remote ?? 'origin';
    const fetchArgs: string[] = [remote];
    if (options?.prune) {
      fetchArgs.push('--prune');
    }
    await client.fetch(fetchArgs);
    devInfo('GIT_REMOTE', `Fetched from remote '${remote}'`);
  });
}

/**
 * Pulls changes from a remote branch.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Remote name, branch name, and rebase preferences.
 *
 * @example
 * ```typescript
 * await pullFromRemote('/my-repo', { remote: 'origin', branch: 'main' });
 * ```
 */
export async function pullFromRemote(
  repoPath: string,
  options?: { remote?: string; branch?: string; rebase?: boolean }
): Promise<void> {
  return withGitErrorHandling('pullFromRemote', repoPath, async (client) => {
    const remote = options?.remote ?? 'origin';
    const pullOptions: Record<string, string | null> = {};
    if (options?.rebase) {
      pullOptions['--rebase'] = null;
    }
    await client.pull(remote, options?.branch, pullOptions);
    devInfo('GIT_REMOTE', `Pulled from remote '${remote}' (branch: ${options?.branch ?? 'current'})`);
  });
}

/**
 * Pushes local branch commits to a remote repository.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Remote name, branch name, upstream flag, tags, and force push options.
 *
 * @example
 * ```typescript
 * await pushToRemote('/my-repo', { remote: 'origin', branch: 'main', setUpstream: true });
 * ```
 */
export async function pushToRemote(
  repoPath: string,
  options?: {
    remote?: string;
    branch?: string;
    setUpstream?: boolean;
    tags?: boolean;
    force?: boolean;
  }
): Promise<void> {
  return withGitErrorHandling('pushToRemote', repoPath, async (client) => {
    const remote = options?.remote ?? 'origin';
    const pushArgs: string[] = [remote];

    if (options?.branch) {
      pushArgs.push(options.branch);
    }
    if (options?.setUpstream) {
      pushArgs.push('-u');
    }
    if (options?.tags) {
      pushArgs.push('--tags');
    }
    if (options?.force) {
      pushArgs.push('--force');
    }

    await client.push(pushArgs);
    devInfo('GIT_REMOTE', `Pushed to remote '${remote}' (branch: ${options?.branch ?? 'current'})`);
  });
}

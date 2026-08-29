import { withGitErrorHandling } from './client.js';
import type { RemoteEntry } from './types.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Lists all configured remotes.
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
 * Adds a new remote.
 */
export async function addRemote(repoPath: string, name: string, url: string): Promise<void> {
  return withGitErrorHandling('addRemote', repoPath, async (client) => {
    await client.addRemote(name, url);
    devInfo('GIT_REMOTE', `Added remote '${name}': ${url}`);
  });
}

/**
 * Removes an existing remote.
 */
export async function removeRemote(repoPath: string, name: string): Promise<void> {
  return withGitErrorHandling('removeRemote', repoPath, async (client) => {
    await client.removeRemote(name);
    devInfo('GIT_REMOTE', `Removed remote '${name}'`);
  });
}

/**
 * Fetches from remote.
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
 * Pulls changes from remote.
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
 * Pushes changes to remote.
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

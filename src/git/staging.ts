import { withGitErrorHandling } from './client.js';
import type { DiscardChangesOptions } from './types.js';
import { parseCommaSeparatedList } from '../common/helpers.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Stages specific file paths or patterns.
 *
 * @param repoPath - Repository root directory path.
 * @param files - File path or array of file paths to stage.
 * @returns Array of staged file paths.
 *
 * @example
 * ```typescript
 * await stageFiles('/my-repo', ['src/index.ts', 'src/auth.ts']);
 * ```
 */
export async function stageFiles(repoPath: string, files: string | string[]): Promise<string[]> {
  const fileList = parseCommaSeparatedList(files);
  if (fileList.length === 0) {
    return [];
  }

  return withGitErrorHandling('stageFiles', repoPath, async (client) => {
    await client.add(fileList);
    devInfo('GIT_STAGING', `Staged ${fileList.length} file(s): ${fileList.join(', ')}`);
    return fileList;
  });
}

/**
 * Stages all modified, created, and deleted files in the working directory (`git add -A`).
 *
 * @param repoPath - Repository root directory path.
 *
 * @example
 * ```typescript
 * await stageAll('/my-repo');
 * ```
 */
export async function stageAll(repoPath: string): Promise<void> {
  return withGitErrorHandling('stageAll', repoPath, async (client) => {
    await client.add('-A');
    devInfo('GIT_STAGING', `Staged all changes in repository.`);
  });
}

/**
 * Unstages previously staged files (`git restore --staged <files>` or `git reset HEAD <files>`).
 *
 * @param repoPath - Repository root directory path.
 * @param files - File path or array of file paths to unstage.
 *
 * @example
 * ```typescript
 * await unstageFiles('/my-repo', 'src/temp.ts');
 * ```
 */
export async function unstageFiles(repoPath: string, files: string | string[]): Promise<void> {
  const fileList = parseCommaSeparatedList(files);
  if (fileList.length === 0) {
    return;
  }

  return withGitErrorHandling('unstageFiles', repoPath, async (client) => {
    await client.reset(['HEAD', '--', ...fileList]);
    devInfo('GIT_STAGING', `Unstaged ${fileList.length} file(s): ${fileList.join(', ')}`);
  });
}

/**
 * Discards working directory changes for tracked files, and optionally removes untracked files.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Files to discard and untracked cleanup preference.
 *
 * @example
 * ```typescript
 * await discardChanges('/my-repo', { files: ['src/experiment.ts'], untracked: true });
 * ```
 */
export async function discardChanges(repoPath: string, options?: DiscardChangesOptions): Promise<void> {
  return withGitErrorHandling('discardChanges', repoPath, async (client) => {
    const files = options?.files ? parseCommaSeparatedList(options.files) : [];

    if (files.length > 0) {
      await client.checkout(['--', ...files]);
      devInfo('GIT_STAGING', `Discarded changes for files: ${files.join(', ')}`);
    } else {
      await client.checkout(['--force', 'HEAD']);
      devInfo('GIT_STAGING', `Discarded all tracked working tree changes.`);
    }

    if (options?.untracked) {
      await client.clean('f', ['-d']);
      devInfo('GIT_STAGING', `Cleaned untracked files and directories.`);
    }
  });
}

/**
 * Removes untracked files and directories from the working tree (`git clean -fd`).
 *
 * @param repoPath - Repository root directory path.
 *
 * @example
 * ```typescript
 * await cleanUntracked('/my-repo');
 * ```
 */
export async function cleanUntracked(repoPath: string): Promise<void> {
  return withGitErrorHandling('cleanUntracked', repoPath, async (client) => {
    await client.clean('f', ['-d']);
    devInfo('GIT_STAGING', `Removed untracked files from working tree.`);
  });
}

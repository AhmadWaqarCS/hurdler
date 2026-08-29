import fs from 'node:fs/promises';
import path from 'node:path';
import { withGitErrorHandling, getGitClient } from './client.js';
import type { GitStatusResult, InitRepoOptions } from './types.js';
import { InitRepoOptionsSchema } from './schema.js';
import { getAgentAuthor, formatAuthorArg } from './authors.js';
import { devInfo } from '../core/dev-mode/index.js';
import { GitRepositoryNotFoundError } from './errors.js';

/**
 * Checks if a given path is inside or points to a valid Git repository.
 *
 * @param targetPath - Path to verify.
 * @returns Promise resolving to true if directory is a Git repository.
 *
 * @example
 * ```typescript
 * const isRepo = await isGitRepository('/my-project');
 * ```
 */
export async function isGitRepository(targetPath: string): Promise<boolean> {
  try {
    const client = getGitClient(targetPath);
    return await client.checkIsRepo();
  } catch {
    return false;
  }
}

/**
 * Resolves the root directory of the Git repository for a given target path.
 *
 * @param targetPath - Path to resolve root from.
 * @returns The absolute path to top-level repository directory.
 * @throws GitRepositoryNotFoundError if targetPath is not in a git repo.
 *
 * @example
 * ```typescript
 * const root = await getGitRoot('/my-project/src/sub');
 * ```
 */
export async function getGitRoot(targetPath: string): Promise<string> {
  return withGitErrorHandling('getGitRoot', targetPath, async (client) => {
    const isRepo = await client.checkIsRepo();
    if (!isRepo) {
      throw new GitRepositoryNotFoundError(targetPath);
    }
    const root = await client.revparse(['--show-toplevel']);
    return root.trim();
  });
}

/**
 * Initializes a new Git repository at the specified path.
 *
 * @param repoPath - Repository directory to create and initialize.
 * @param options - Default branch, initial commit, gitignore entries, and author options.
 *
 * @example
 * ```typescript
 * await initRepository('/my-new-project', {
 *   defaultBranch: 'main',
 *   initialCommit: true,
 *   agentId: 'system',
 * });
 * ```
 */
export async function initRepository(repoPath: string, options?: InitRepoOptions): Promise<void> {
  const parsed = InitRepoOptionsSchema.parse(options ?? {});
  const resolvedPath = path.resolve(repoPath);

  await fs.mkdir(resolvedPath, { recursive: true });

  await withGitErrorHandling('initRepository', resolvedPath, async (client) => {
    await client.init({ '--initial-branch': parsed.defaultBranch });
    devInfo('GIT_STATUS', `Initialized Git repository at ${resolvedPath} with default branch '${parsed.defaultBranch}'`);

    // Create default .gitignore if not present
    const gitignorePath = path.join(resolvedPath, '.gitignore');
    let gitignoreCreated = false;
    try {
      await fs.access(gitignorePath);
    } catch {
      const defaultEntries = parsed.gitignoreEntries ?? [
        'node_modules/',
        'dist/',
        '.env',
        '.env.*',
        '!.env.example',
        '*.log',
        '.DS_Store',
        'coverage/',
        '.hurdler/cache/',
      ];
      await fs.writeFile(gitignorePath, defaultEntries.join('\n') + '\n', 'utf-8');
      gitignoreCreated = true;
    }

    // Optionally create an initial commit
    if (parsed.initialCommit) {
      const author = parsed.author ?? getAgentAuthor(parsed.agentId ?? 'system');
      await client.add('.gitignore');

      const authorArg = formatAuthorArg(author);
      await client.commit(parsed.initialCommitMessage, ['.gitignore'], {
        '--author': authorArg,
      });

      devInfo('GIT_STATUS', `Created initial commit on '${parsed.defaultBranch}' by ${authorArg}`);
    }
  });
}

/**
 * Retrieves rich structured status of the working tree.
 *
 * @param repoPath - Repository root directory path.
 * @returns GitStatusResult containing branch, staged/modified/untracked files, ahead/behind counts.
 *
 * @example
 * ```typescript
 * const status = await getGitStatus('/my-repo');
 * console.log(status.isClean, status.current, status.modified);
 * ```
 */
export async function getGitStatus(repoPath: string): Promise<GitStatusResult> {
  return withGitErrorHandling('getGitStatus', repoPath, async (client) => {
    const status = await client.status();

    return {
      current: status.current || 'HEAD',
      tracking: status.tracking || undefined,
      isClean: status.isClean(),
      modified: status.modified,
      staged: status.staged,
      not_added: status.not_added,
      deleted: status.deleted,
      renamed: status.renamed.map((r) => ({ from: r.from, to: r.to })),
      conflicted: status.conflicted,
      ahead: status.ahead,
      behind: status.behind,
      files: status.files.map((f) => ({
        path: f.path,
        index: f.index,
        working_dir: f.working_dir,
      })),
    };
  });
}

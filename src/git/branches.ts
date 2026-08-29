import { withGitErrorHandling } from './client.js';
import type { BranchSummary, CreateBranchOptions, CheckoutBranchOptions } from './types.js';
import { GitRefNameSchema } from './schema.js';
import { GitValidationError } from './errors.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Validates a branch or reference name according to Git naming conventions.
 */
export function validateRefName(name: string): string {
  const parseResult = GitRefNameSchema.safeParse(name);
  if (!parseResult.success) {
    throw new GitValidationError(
      `Invalid Git reference/branch name '${name}': ${parseResult.error.issues.map((i) => i.message).join(', ')}`
    );
  }
  return parseResult.data;
}

/**
 * Lists all local and remote branches in the repository.
 */
export async function listBranches(repoPath: string): Promise<BranchSummary> {
  return withGitErrorHandling('listBranches', repoPath, async (client) => {
    const branchSummary = await client.branchLocal();
    const branches: Record<string, { current: boolean; name: string; commit: string; label: string }> = {};

    for (const [name, info] of Object.entries(branchSummary.branches)) {
      branches[name] = {
        current: info.current,
        name: info.name,
        commit: info.commit,
        label: info.label,
      };
    }

    return {
      current: branchSummary.current,
      all: branchSummary.all,
      branches,
    };
  });
}

/**
 * Retrieves the name of the currently active branch.
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  return withGitErrorHandling('getCurrentBranch', repoPath, async (client) => {
    const branch = await client.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  });
}

/**
 * Checks if a branch exists locally.
 */
export async function branchExists(repoPath: string, branchName: string): Promise<boolean> {
  const summary = await listBranches(repoPath);
  return summary.all.includes(branchName);
}

/**
 * Creates a new branch off a specified starting point or HEAD.
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  options?: CreateBranchOptions
): Promise<void> {
  const validatedName = validateRefName(branchName);

  return withGitErrorHandling('createBranch', repoPath, async (client) => {
    if (options?.checkout) {
      if (options.startPoint) {
        await client.checkoutBranch(validatedName, options.startPoint);
      } else {
        await client.checkoutLocalBranch(validatedName);
      }
      devInfo('GIT_BRANCH', `Created and checked out branch '${validatedName}'`);
    } else {
      if (options?.startPoint) {
        await client.branch([validatedName, options.startPoint]);
      } else {
        await client.branch([validatedName]);
      }
      devInfo('GIT_BRANCH', `Created branch '${validatedName}'`);
    }
  });
}

/**
 * Checks out an existing branch or creates and checks out a new branch.
 */
export async function checkoutBranch(
  repoPath: string,
  branchName: string,
  options?: CheckoutBranchOptions
): Promise<void> {
  const validatedName = validateRefName(branchName);

  return withGitErrorHandling('checkoutBranch', repoPath, async (client) => {
    if (options?.createNew) {
      if (options.startPoint) {
        await client.checkoutBranch(validatedName, options.startPoint);
      } else {
        await client.checkoutLocalBranch(validatedName);
      }
      devInfo('GIT_BRANCH', `Created and switched to new branch '${validatedName}'`);
    } else {
      const args = options?.force ? ['-f', validatedName] : [validatedName];
      await client.checkout(args);
      devInfo('GIT_BRANCH', `Switched to branch '${validatedName}'`);
    }
  });
}

/**
 * Deletes a branch locally.
 */
export async function deleteBranch(
  repoPath: string,
  branchName: string,
  options?: { force?: boolean }
): Promise<void> {
  const validatedName = validateRefName(branchName);

  return withGitErrorHandling('deleteBranch', repoPath, async (client) => {
    await client.deleteLocalBranch(validatedName, options?.force ?? false);
    devInfo('GIT_BRANCH', `Deleted branch '${validatedName}' (force: ${options?.force ?? false})`);
  });
}

/**
 * Renames an existing branch.
 */
export async function renameBranch(
  repoPath: string,
  oldName: string,
  newName: string
): Promise<void> {
  const validatedOld = validateRefName(oldName);
  const validatedNew = validateRefName(newName);

  return withGitErrorHandling('renameBranch', repoPath, async (client) => {
    await client.branch(['-m', validatedOld, validatedNew]);
    devInfo('GIT_BRANCH', `Renamed branch '${validatedOld}' to '${validatedNew}'`);
  });
}

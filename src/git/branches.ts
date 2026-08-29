import { withGitErrorHandling } from './client.js';
import type { BranchSummary, CreateBranchOptions, CheckoutBranchOptions, BranchDetails } from './types.js';
import { GitRefNameSchema } from './schema.js';
import { GitValidationError, GitBranchNotFoundError } from './errors.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Validates a branch or reference name according to standard Git naming conventions.
 *
 * @param name - The ref or branch name string to validate.
 * @returns The validated ref name string.
 * @throws GitValidationError if ref name is invalid.
 *
 * @example
 * ```typescript
 * const validName = validateRefName('feature/user-auth');
 * ```
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
 * Lists all local and tracking branches in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @returns BranchSummary containing current active branch and map of branch details.
 *
 * @example
 * ```typescript
 * const branches = await listBranches('/my-repo');
 * console.log(branches.current, branches.all);
 * ```
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
 * Retrieves the name of the currently active Git branch.
 *
 * @param repoPath - Repository root directory path.
 * @returns Active branch name (e.g. 'main', 'feature/login').
 *
 * @example
 * ```typescript
 * const current = await getCurrentBranch('/my-repo');
 * ```
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  return withGitErrorHandling('getCurrentBranch', repoPath, async (client) => {
    const branch = await client.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  });
}

/**
 * Checks if a specific branch exists locally in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param branchName - Branch name to check.
 * @returns True if branch exists.
 *
 * @example
 * ```typescript
 * if (await branchExists('/my-repo', 'feature/login')) { ... }
 * ```
 */
export async function branchExists(repoPath: string, branchName: string): Promise<boolean> {
  const summary = await listBranches(repoPath);
  return summary.all.includes(branchName);
}

/**
 * Retrieves detailed information about a specific branch.
 *
 * @param repoPath - Repository root directory path.
 * @param branchName - Name of the branch.
 * @returns BranchDetails object.
 * @throws GitBranchNotFoundError if branch does not exist.
 *
 * @example
 * ```typescript
 * const details = await getBranchDetails('/my-repo', 'main');
 * ```
 */
export async function getBranchDetails(repoPath: string, branchName: string): Promise<BranchDetails> {
  const validatedName = validateRefName(branchName);
  const summary = await listBranches(repoPath);

  if (!summary.all.includes(validatedName)) {
    throw new GitBranchNotFoundError(validatedName, { repoPath });
  }

  const info = summary.branches[validatedName];
  return {
    name: validatedName,
    current: summary.current === validatedName,
    commit: info?.commit ?? '',
    label: info?.label ?? validatedName,
  };
}

/**
 * Creates a new branch off a specified starting point or HEAD.
 *
 * @param repoPath - Repository root directory path.
 * @param branchName - Name of the new branch.
 * @param options - Starting point and checkout preferences.
 *
 * @example
 * ```typescript
 * await createBranch('/my-repo', 'feature/ui-nav', { checkout: true });
 * ```
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
 *
 * @param repoPath - Repository root directory path.
 * @param branchName - Branch name to switch to.
 * @param options - Create new flag or force discard.
 *
 * @example
 * ```typescript
 * await checkoutBranch('/my-repo', 'main');
 * ```
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
 *
 * @param repoPath - Repository root directory path.
 * @param branchName - Branch name to delete.
 * @param options - Force delete flag.
 *
 * @example
 * ```typescript
 * await deleteBranch('/my-repo', 'feature/old-experiment', { force: true });
 * ```
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
 *
 * @param repoPath - Repository root directory path.
 * @param oldName - Old branch name.
 * @param newName - New branch name.
 *
 * @example
 * ```typescript
 * await renameBranch('/my-repo', 'feature/temp', 'feature/final');
 * ```
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

/**
 * Sets the tracking upstream reference for a local branch.
 *
 * @param repoPath - Repository root directory path.
 * @param branchName - Local branch name.
 * @param upstreamRef - Upstream tracking reference (e.g. 'origin/main').
 *
 * @example
 * ```typescript
 * await setUpstreamBranch('/my-repo', 'main', 'origin/main');
 * ```
 */
export async function setUpstreamBranch(
  repoPath: string,
  branchName: string,
  upstreamRef: string
): Promise<void> {
  const validatedBranch = validateRefName(branchName);

  return withGitErrorHandling('setUpstreamBranch', repoPath, async (client) => {
    await client.branch(['--set-upstream-to', upstreamRef, validatedBranch]);
    devInfo('GIT_BRANCH', `Set upstream for '${validatedBranch}' -> '${upstreamRef}'`);
  });
}

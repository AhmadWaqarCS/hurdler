import type {
  PullRequest,
  PullRequestFilter,
  PullRequestReview,
  MergeResult,
  DiffResult,
  CommitLogEntry,
  GitAuthor,
} from './types.js';
import { PullRequestSchema } from './schema.js';
import { GitPRNotFoundError, GitValidationError } from './errors.js';
import { getAgentAuthor } from './authors.js';
import { mergeBranch } from './merge.js';
import { getDiff } from './diff.js';
import { getCommitLog } from './commits.js';
import { listBranches } from './branches.js';
import { devInfo } from '../core/dev-mode/index.js';
import { loadPullRequestsFromDisk, savePullRequestsToDisk } from './storage.js';

/**
 * Creates a new local Pull Request within the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Pull request creation parameters.
 * @returns The newly created and saved PullRequest.
 * @throws GitValidationError if source/target branch does not exist.
 *
 * @example
 * ```typescript
 * const pr = await createPullRequest('/my-repo', {
 *   title: 'Implement user auth service',
 *   sourceBranch: 'feature/auth',
 *   targetBranch: 'main',
 *   agentId: 'business-logic',
 * });
 * ```
 */
export async function createPullRequest(
  repoPath: string,
  options: {
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch?: string;
    author?: GitAuthor;
    agentId?: string;
  }
): Promise<PullRequest> {
  const branches = await listBranches(repoPath);
  const targetBranch = options.targetBranch ?? branches.current ?? 'main';

  if (!branches.all.includes(options.sourceBranch)) {
    throw new GitValidationError(`Source branch '${options.sourceBranch}' does not exist.`);
  }
  if (!branches.all.includes(targetBranch)) {
    throw new GitValidationError(`Target branch '${targetBranch}' does not exist.`);
  }

  const existingPrs = await loadPullRequestsFromDisk(repoPath);
  const nextId = `pr-${existingPrs.length + 1}`;
  const now = new Date().toISOString();
  const author = options.author ?? getAgentAuthor(options.agentId);

  const newPr: PullRequest = PullRequestSchema.parse({
    id: nextId,
    title: options.title,
    description: options.description ?? '',
    sourceBranch: options.sourceBranch,
    targetBranch,
    author,
    agentId: options.agentId,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    reviews: [],
  });

  existingPrs.push(newPr);
  await savePullRequestsToDisk(repoPath, existingPrs);

  devInfo('GIT_PR', `Created Pull Request #${newPr.id}: "${newPr.title}" (${newPr.sourceBranch} -> ${newPr.targetBranch})`);
  return newPr;
}

/**
 * Lists Pull Requests in the repository with optional filtering.
 *
 * @param repoPath - Repository root directory path.
 * @param filter - Optional filter parameters (status, sourceBranch, targetBranch, agentId, author).
 * @returns Filtered array of PullRequest items.
 *
 * @example
 * ```typescript
 * const openPrs = await listPullRequests('/my-repo', { status: 'open' });
 * ```
 */
export async function listPullRequests(
  repoPath: string,
  filter?: PullRequestFilter
): Promise<PullRequest[]> {
  const prs = await loadPullRequestsFromDisk(repoPath);

  return prs.filter((pr) => {
    if (filter?.status && pr.status !== filter.status) {
      return false;
    }
    if (filter?.sourceBranch && pr.sourceBranch !== filter.sourceBranch) {
      return false;
    }
    if (filter?.targetBranch && pr.targetBranch !== filter.targetBranch) {
      return false;
    }
    if (filter?.agentId && pr.agentId !== filter.agentId) {
      return false;
    }
    if (filter?.author) {
      const lowerAuthor = filter.author.toLowerCase();
      const matches =
        pr.author.name.toLowerCase().includes(lowerAuthor) ||
        pr.author.email.toLowerCase().includes(lowerAuthor);
      if (!matches) return false;
    }
    return true;
  });
}

/**
 * Retrieves a Pull Request by ID with its commit list and diff summary.
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier (e.g. 'pr-1').
 * @returns PullRequest object with populated commits and diffSummary.
 * @throws GitPRNotFoundError if the PR ID does not exist.
 *
 * @example
 * ```typescript
 * const prDetails = await getPullRequest('/my-repo', 'pr-1');
 * console.log(prDetails.commits.length, prDetails.diffSummary.files.length);
 * ```
 */
export async function getPullRequest(
  repoPath: string,
  prId: string
): Promise<PullRequest & { commits: CommitLogEntry[]; diffSummary: DiffResult }> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const pr = prs.find((p) => p.id === prId);

  if (!pr) {
    throw new GitPRNotFoundError(prId, { repoPath });
  }

  // Get commits and diff between source and target
  let commits: CommitLogEntry[] = [];
  let diffSummary: DiffResult = { raw: '', files: [] };

  try {
    commits = await getCommitLog(repoPath, {
      fromRef: `${pr.targetBranch}..${pr.sourceBranch}`,
    });
    diffSummary = await getDiff(repoPath, {
      baseRef: pr.targetBranch,
      targetRef: pr.sourceBranch,
    });
  } catch {
    // If branches are currently in unusual state, provide empty fallbacks
  }

  return {
    ...pr,
    commits,
    diffSummary,
  };
}

/**
 * Updates a Pull Request's metadata (title, description, targetBranch).
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier.
 * @param updates - Properties to update.
 * @returns Updated PullRequest object.
 * @throws GitPRNotFoundError if PR not found.
 *
 * @example
 * ```typescript
 * const updated = await updatePullRequest('/my-repo', 'pr-1', { title: 'Updated PR Title' });
 * ```
 */
export async function updatePullRequest(
  repoPath: string,
  prId: string,
  updates: Partial<Pick<PullRequest, 'title' | 'description' | 'targetBranch'>>
): Promise<PullRequest> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const prIndex = prs.findIndex((p) => p.id === prId);

  if (prIndex === -1) {
    throw new GitPRNotFoundError(prId, { repoPath });
  }

  const pr = prs[prIndex];
  const now = new Date().toISOString();

  if (updates.title !== undefined) pr.title = updates.title;
  if (updates.description !== undefined) pr.description = updates.description;
  if (updates.targetBranch !== undefined) pr.targetBranch = updates.targetBranch;
  pr.updatedAt = now;

  prs[prIndex] = pr;
  await savePullRequestsToDisk(repoPath, prs);

  devInfo('GIT_PR', `Updated Pull Request #${prId}`);
  return pr;
}

/**
 * Submits a review on a Pull Request.
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier.
 * @param review - The review details.
 * @returns Updated PullRequest object.
 * @throws GitPRNotFoundError if PR not found.
 *
 * @example
 * ```typescript
 * await reviewPullRequest('/my-repo', 'pr-1', {
 *   agentId: 'security-reviewer',
 *   status: 'approved',
 *   comment: 'Security review passed.',
 * });
 * ```
 */
export async function reviewPullRequest(
  repoPath: string,
  prId: string,
  review: {
    author?: GitAuthor;
    agentId?: string;
    status: 'approved' | 'changes_requested' | 'commented';
    comment: string;
  }
): Promise<PullRequest> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const prIndex = prs.findIndex((p) => p.id === prId);

  if (prIndex === -1) {
    throw new GitPRNotFoundError(prId, { repoPath });
  }

  const pr = prs[prIndex];
  const reviewerAuthor = review.author ?? getAgentAuthor(review.agentId);
  const now = new Date().toISOString();

  const reviewEntry: PullRequestReview = {
    author: reviewerAuthor,
    agentId: review.agentId,
    status: review.status,
    comment: review.comment,
    createdAt: now,
  };

  pr.reviews.push(reviewEntry);
  pr.updatedAt = now;

  if (review.status === 'changes_requested' && pr.status === 'open') {
    pr.status = 'changes_requested';
  } else if (review.status === 'approved' && pr.status === 'changes_requested') {
    pr.status = 'open';
  }

  prs[prIndex] = pr;
  await savePullRequestsToDisk(repoPath, prs);

  devInfo('GIT_PR', `Added review [${review.status}] to PR #${prId} by ${reviewerAuthor.name}`);
  return pr;
}

/**
 * Merges a Pull Request and updates its status to 'merged'.
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier.
 * @param options - Merge method and author options.
 * @returns Object with merged PullRequest and Git MergeResult.
 * @throws GitPRNotFoundError if PR not found.
 * @throws GitValidationError if PR is already merged or closed.
 *
 * @example
 * ```typescript
 * const { pr, mergeResult } = await mergePullRequest('/my-repo', 'pr-1', { mergeMethod: 'no-ff' });
 * ```
 */
export async function mergePullRequest(
  repoPath: string,
  prId: string,
  options?: {
    mergeMethod?: 'merge' | 'squash' | 'no-ff';
    author?: GitAuthor;
    agentId?: string;
  }
): Promise<{ pr: PullRequest; mergeResult: MergeResult }> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const prIndex = prs.findIndex((p) => p.id === prId);

  if (prIndex === -1) {
    throw new GitPRNotFoundError(prId, { repoPath });
  }

  const pr = prs[prIndex];
  if (pr.status === 'merged') {
    throw new GitValidationError(`Pull Request #${prId} has already been merged.`);
  }
  if (pr.status === 'closed') {
    throw new GitValidationError(`Cannot merge closed Pull Request #${prId}.`);
  }

  const mergerAuthor = options?.author ?? getAgentAuthor(options?.agentId);
  const squash = options?.mergeMethod === 'squash';
  const noFf = options?.mergeMethod === 'no-ff';

  const mergeResult = await mergeBranch(repoPath, {
    sourceBranch: pr.sourceBranch,
    targetBranch: pr.targetBranch,
    author: mergerAuthor,
    squash,
    noFf,
    message: `Merge PR #${pr.id}: ${pr.title}`,
  });

  if (!mergeResult.success) {
    return { pr, mergeResult };
  }

  const now = new Date().toISOString();
  pr.status = 'merged';
  pr.mergedAt = now;
  pr.mergedBy = mergerAuthor;
  pr.updatedAt = now;

  prs[prIndex] = pr;
  await savePullRequestsToDisk(repoPath, prs);

  devInfo('GIT_PR', `Merged PR #${pr.id} into '${pr.targetBranch}' successfully.`);
  return { pr, mergeResult };
}

/**
 * Closes a Pull Request without merging.
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier.
 * @param reason - Optional explanation for closing.
 * @returns Closed PullRequest object.
 * @throws GitPRNotFoundError if PR not found.
 *
 * @example
 * ```typescript
 * const closed = await closePullRequest('/my-repo', 'pr-1', 'Superceded by pr-2');
 * ```
 */
export async function closePullRequest(
  repoPath: string,
  prId: string,
  reason?: string
): Promise<PullRequest> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const prIndex = prs.findIndex((p) => p.id === prId);

  if (prIndex === -1) {
    throw new GitPRNotFoundError(prId, { repoPath });
  }

  const pr = prs[prIndex];
  const now = new Date().toISOString();

  pr.status = 'closed';
  pr.closeReason = reason;
  pr.updatedAt = now;

  prs[prIndex] = pr;
  await savePullRequestsToDisk(repoPath, prs);

  devInfo('GIT_PR', `Closed PR #${pr.id}: ${reason ?? '(no reason given)'}`);
  return pr;
}

/**
 * Reopens a closed Pull Request.
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier.
 * @returns Reopened PullRequest object.
 * @throws GitPRNotFoundError if PR not found.
 * @throws GitValidationError if PR is already merged or open.
 *
 * @example
 * ```typescript
 * const reopened = await reopenPullRequest('/my-repo', 'pr-1');
 * ```
 */
export async function reopenPullRequest(
  repoPath: string,
  prId: string
): Promise<PullRequest> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const prIndex = prs.findIndex((p) => p.id === prId);

  if (prIndex === -1) {
    throw new GitPRNotFoundError(prId, { repoPath });
  }

  const pr = prs[prIndex];
  if (pr.status === 'merged') {
    throw new GitValidationError(`Cannot reopen merged Pull Request #${prId}.`);
  }
  if (pr.status === 'open') {
    throw new GitValidationError(`Pull Request #${prId} is already open.`);
  }

  const now = new Date().toISOString();
  pr.status = 'open';
  pr.closeReason = undefined;
  pr.updatedAt = now;

  prs[prIndex] = pr;
  await savePullRequestsToDisk(repoPath, prs);

  devInfo('GIT_PR', `Reopened PR #${pr.id}`);
  return pr;
}

/**
 * Deletes a Pull Request permanently from local storage.
 *
 * @param repoPath - Repository root directory path.
 * @param prId - The PR identifier.
 * @returns True if deleted, false if not found.
 *
 * @example
 * ```typescript
 * const deleted = await deletePullRequest('/my-repo', 'pr-1');
 * ```
 */
export async function deletePullRequest(
  repoPath: string,
  prId: string
): Promise<boolean> {
  const prs = await loadPullRequestsFromDisk(repoPath);
  const prIndex = prs.findIndex((p) => p.id === prId);

  if (prIndex === -1) {
    return false;
  }

  prs.splice(prIndex, 1);
  await savePullRequestsToDisk(repoPath, prs);

  devInfo('GIT_PR', `Deleted PR #${prId}`);
  return true;
}

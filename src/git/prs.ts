import fs from 'node:fs/promises';
import path from 'node:path';
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

function getPrStorePath(repoPath: string): string {
  return path.join(path.resolve(repoPath), '.hurdler', 'git', 'prs.json');
}

async function loadPullRequests(repoPath: string): Promise<PullRequest[]> {
  const storePath = getPrStorePath(repoPath);
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function savePullRequests(repoPath: string, prs: PullRequest[]): Promise<void> {
  const storePath = getPrStorePath(repoPath);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(prs, null, 2), 'utf-8');
}

/**
 * Creates a new Pull Request.
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

  const existingPrs = await loadPullRequests(repoPath);
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
  await savePullRequests(repoPath, existingPrs);

  devInfo('GIT_PR', `Created Pull Request #${newPr.id}: "${newPr.title}" (${newPr.sourceBranch} -> ${newPr.targetBranch})`);
  return newPr;
}

/**
 * Lists Pull Requests with optional filtering.
 */
export async function listPullRequests(
  repoPath: string,
  filter?: PullRequestFilter
): Promise<PullRequest[]> {
  const prs = await loadPullRequests(repoPath);

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
 */
export async function getPullRequest(
  repoPath: string,
  prId: string
): Promise<PullRequest & { commits: CommitLogEntry[]; diffSummary: DiffResult }> {
  const prs = await loadPullRequests(repoPath);
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
 * Submits a review on a Pull Request.
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
  const prs = await loadPullRequests(repoPath);
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
  await savePullRequests(repoPath, prs);

  devInfo('GIT_PR', `Added review [${review.status}] to PR #${prId} by ${reviewerAuthor.name}`);
  return pr;
}

/**
 * Merges a Pull Request and updates its status to 'merged'.
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
  const prs = await loadPullRequests(repoPath);
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
  await savePullRequests(repoPath, prs);

  devInfo('GIT_PR', `Merged PR #${pr.id} into '${pr.targetBranch}' successfully.`);
  return { pr, mergeResult };
}

/**
 * Closes a Pull Request without merging.
 */
export async function closePullRequest(
  repoPath: string,
  prId: string,
  reason?: string
): Promise<PullRequest> {
  const prs = await loadPullRequests(repoPath);
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
  await savePullRequests(repoPath, prs);

  devInfo('GIT_PR', `Closed PR #${pr.id}: ${reason ?? '(no reason given)'}`);
  return pr;
}

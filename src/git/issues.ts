import type { GitIssue, GitIssueFilter, GitAuthor, IssueComment } from './types.js';
import { GitIssueSchema } from './schema.js';
import { GitIssueNotFoundError, GitValidationError } from './errors.js';
import { getAgentAuthor } from './authors.js';
import { devInfo } from '../core/dev-mode/index.js';
import { loadIssuesFromDisk, saveIssuesToDisk } from './storage.js';

/**
 * Creates a new Issue for tracking bugs, tasks, or features in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param options - Issue creation parameters.
 * @returns The newly created and saved GitIssue object.
 *
 * @example
 * ```typescript
 * const issue = await createIssue('/my-repo', {
 *   title: 'Fix edge-case in token verification',
 *   description: 'Expired tokens return 500 instead of 401',
 *   agentId: 'tester',
 *   labels: ['bug', 'security'],
 *   assignee: 'business-logic',
 * });
 * ```
 */
export async function createIssue(
  repoPath: string,
  options: {
    title: string;
    description?: string;
    author?: GitAuthor;
    agentId?: string;
    labels?: string[];
    assignee?: string;
  }
): Promise<GitIssue> {
  const issues = await loadIssuesFromDisk(repoPath);
  const nextId = `issue-${issues.length + 1}`;
  const now = new Date().toISOString();
  const author = options.author ?? getAgentAuthor(options.agentId);

  const newIssue: GitIssue = GitIssueSchema.parse({
    id: nextId,
    title: options.title,
    description: options.description ?? '',
    author,
    agentId: options.agentId,
    status: 'open',
    labels: options.labels ?? [],
    assignee: options.assignee,
    createdAt: now,
    updatedAt: now,
    comments: [],
  });

  issues.push(newIssue);
  await saveIssuesToDisk(repoPath, issues);

  devInfo('GIT_ISSUE', `Created Issue #${newIssue.id}: "${newIssue.title}" [Labels: ${newIssue.labels.join(', ')}]`);
  return newIssue;
}

/**
 * Lists Issues in the repository with optional filtering.
 *
 * @param repoPath - Repository root directory path.
 * @param filter - Optional filter parameters (status, assignee, agentId, label).
 * @returns Filtered array of GitIssue items.
 *
 * @example
 * ```typescript
 * const openBugs = await listIssues('/my-repo', { status: 'open', label: 'bug' });
 * ```
 */
export async function listIssues(
  repoPath: string,
  filter?: GitIssueFilter
): Promise<GitIssue[]> {
  const issues = await loadIssuesFromDisk(repoPath);

  return issues.filter((issue) => {
    if (filter?.status && issue.status !== filter.status) {
      return false;
    }
    if (filter?.assignee && issue.assignee !== filter.assignee) {
      return false;
    }
    if (filter?.agentId && issue.agentId !== filter.agentId) {
      return false;
    }
    if (filter?.label && !issue.labels.includes(filter.label)) {
      return false;
    }
    return true;
  });
}

/**
 * Retrieves a single Issue by ID.
 *
 * @param repoPath - Repository root directory path.
 * @param issueId - The issue identifier (e.g. 'issue-1').
 * @returns The matching GitIssue object.
 * @throws GitIssueNotFoundError if issue ID does not exist.
 *
 * @example
 * ```typescript
 * const issue = await getIssue('/my-repo', 'issue-1');
 * ```
 */
export async function getIssue(repoPath: string, issueId: string): Promise<GitIssue> {
  const issues = await loadIssuesFromDisk(repoPath);
  const issue = issues.find((i) => i.id === issueId);

  if (!issue) {
    throw new GitIssueNotFoundError(issueId, { repoPath });
  }

  return issue;
}

/**
 * Updates an Issue's properties (title, description, status, labels, assignee).
 *
 * @param repoPath - Repository root directory path.
 * @param issueId - The issue identifier.
 * @param updates - Partial issue properties to update.
 * @returns The updated GitIssue object.
 * @throws GitIssueNotFoundError if issue not found.
 *
 * @example
 * ```typescript
 * const updated = await updateIssue('/my-repo', 'issue-1', {
 *   assignee: 'debugger',
 *   labels: ['bug', 'in-progress'],
 * });
 * ```
 */
export async function updateIssue(
  repoPath: string,
  issueId: string,
  updates: Partial<Pick<GitIssue, 'title' | 'description' | 'status' | 'labels' | 'assignee'>>
): Promise<GitIssue> {
  const issues = await loadIssuesFromDisk(repoPath);
  const index = issues.findIndex((i) => i.id === issueId);

  if (index === -1) {
    throw new GitIssueNotFoundError(issueId, { repoPath });
  }

  const issue = issues[index];
  const now = new Date().toISOString();

  if (updates.title !== undefined) issue.title = updates.title;
  if (updates.description !== undefined) issue.description = updates.description;
  if (updates.status !== undefined) issue.status = updates.status;
  if (updates.labels !== undefined) issue.labels = updates.labels;
  if (updates.assignee !== undefined) issue.assignee = updates.assignee;
  issue.updatedAt = now;

  issues[index] = issue;
  await saveIssuesToDisk(repoPath, issues);

  devInfo('GIT_ISSUE', `Updated Issue #${issueId}`);
  return issue;
}

/**
 * Closes an Issue with an optional reason.
 *
 * @param repoPath - Repository root directory path.
 * @param issueId - The issue identifier.
 * @param reason - Optional explanation for closing.
 * @returns Closed GitIssue object.
 * @throws GitIssueNotFoundError if issue not found.
 *
 * @example
 * ```typescript
 * const closed = await closeIssue('/my-repo', 'issue-1', 'Resolved via PR #pr-1');
 * ```
 */
export async function closeIssue(
  repoPath: string,
  issueId: string,
  reason?: string
): Promise<GitIssue> {
  const issues = await loadIssuesFromDisk(repoPath);
  const index = issues.findIndex((i) => i.id === issueId);

  if (index === -1) {
    throw new GitIssueNotFoundError(issueId, { repoPath });
  }

  const issue = issues[index];
  const now = new Date().toISOString();

  issue.status = 'closed';
  issue.closedAt = now;
  issue.closeReason = reason;
  issue.updatedAt = now;

  issues[index] = issue;
  await saveIssuesToDisk(repoPath, issues);

  devInfo('GIT_ISSUE', `Closed Issue #${issueId}: ${reason ?? '(no reason given)'}`);
  return issue;
}

/**
 * Reopens a closed Issue.
 *
 * @param repoPath - Repository root directory path.
 * @param issueId - The issue identifier.
 * @returns Reopened GitIssue object.
 * @throws GitIssueNotFoundError if issue not found.
 * @throws GitValidationError if issue is already open.
 *
 * @example
 * ```typescript
 * const reopened = await reopenIssue('/my-repo', 'issue-1');
 * ```
 */
export async function reopenIssue(
  repoPath: string,
  issueId: string
): Promise<GitIssue> {
  const issues = await loadIssuesFromDisk(repoPath);
  const index = issues.findIndex((i) => i.id === issueId);

  if (index === -1) {
    throw new GitIssueNotFoundError(issueId, { repoPath });
  }

  const issue = issues[index];
  if (issue.status === 'open') {
    throw new GitValidationError(`Issue #${issueId} is already open.`);
  }

  const now = new Date().toISOString();
  issue.status = 'open';
  issue.closedAt = undefined;
  issue.closeReason = undefined;
  issue.updatedAt = now;

  issues[index] = issue;
  await saveIssuesToDisk(repoPath, issues);

  devInfo('GIT_ISSUE', `Reopened Issue #${issueId}`);
  return issue;
}

/**
 * Deletes an Issue permanently from local storage.
 *
 * @param repoPath - Repository root directory path.
 * @param issueId - The issue identifier.
 * @returns True if deleted, false if not found.
 *
 * @example
 * ```typescript
 * const deleted = await deleteIssue('/my-repo', 'issue-1');
 * ```
 */
export async function deleteIssue(
  repoPath: string,
  issueId: string
): Promise<boolean> {
  const issues = await loadIssuesFromDisk(repoPath);
  const index = issues.findIndex((i) => i.id === issueId);

  if (index === -1) {
    return false;
  }

  issues.splice(index, 1);
  await saveIssuesToDisk(repoPath, issues);

  devInfo('GIT_ISSUE', `Deleted Issue #${issueId}`);
  return true;
}

/**
 * Appends a comment to an Issue discussion thread.
 *
 * @param repoPath - Repository root directory path.
 * @param issueId - The issue identifier.
 * @param comment - The comment details.
 * @returns Updated GitIssue object.
 * @throws GitIssueNotFoundError if issue not found.
 *
 * @example
 * ```typescript
 * const issue = await addIssueComment('/my-repo', 'issue-1', {
 *   comment: 'Reproduced in test environment on node v22.',
 *   agentId: 'tester',
 * });
 * ```
 */
export async function addIssueComment(
  repoPath: string,
  issueId: string,
  comment: {
    comment: string;
    author?: GitAuthor;
    agentId?: string;
  }
): Promise<GitIssue> {
  const issues = await loadIssuesFromDisk(repoPath);
  const index = issues.findIndex((i) => i.id === issueId);

  if (index === -1) {
    throw new GitIssueNotFoundError(issueId, { repoPath });
  }

  const issue = issues[index];
  const commentAuthor = comment.author ?? getAgentAuthor(comment.agentId);
  const now = new Date().toISOString();

  const commentEntry: IssueComment = {
    id: `comment-${(issue.comments?.length ?? 0) + 1}`,
    author: commentAuthor,
    agentId: comment.agentId,
    comment: comment.comment,
    createdAt: now,
  };

  if (!issue.comments) {
    issue.comments = [];
  }
  issue.comments.push(commentEntry);
  issue.updatedAt = now;

  issues[index] = issue;
  await saveIssuesToDisk(repoPath, issues);

  devInfo('GIT_ISSUE', `Added comment to Issue #${issueId} by ${commentAuthor.name}`);
  return issue;
}

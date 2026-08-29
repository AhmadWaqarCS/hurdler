import fs from 'node:fs/promises';
import path from 'node:path';
import type { GitIssue, GitIssueFilter, GitAuthor } from './types.js';
import { GitIssueSchema } from './schema.js';
import { GitIssueNotFoundError } from './errors.js';
import { getAgentAuthor } from './authors.js';
import { devInfo } from '../core/dev-mode/index.js';

function getIssueStorePath(repoPath: string): string {
  return path.join(path.resolve(repoPath), '.hurdler', 'git', 'issues.json');
}

async function loadIssues(repoPath: string): Promise<GitIssue[]> {
  const storePath = getIssueStorePath(repoPath);
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveIssues(repoPath: string, issues: GitIssue[]): Promise<void> {
  const storePath = getIssueStorePath(repoPath);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(issues, null, 2), 'utf-8');
}

/**
 * Creates a new Issue for tracking bugs, tasks, or features.
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
  const issues = await loadIssues(repoPath);
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
  });

  issues.push(newIssue);
  await saveIssues(repoPath, issues);

  devInfo('GIT_ISSUE', `Created Issue #${newIssue.id}: "${newIssue.title}" [Labels: ${newIssue.labels.join(', ')}]`);
  return newIssue;
}

/**
 * Lists Issues with optional filtering.
 */
export async function listIssues(
  repoPath: string,
  filter?: GitIssueFilter
): Promise<GitIssue[]> {
  const issues = await loadIssues(repoPath);

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
 */
export async function getIssue(repoPath: string, issueId: string): Promise<GitIssue> {
  const issues = await loadIssues(repoPath);
  const issue = issues.find((i) => i.id === issueId);

  if (!issue) {
    throw new GitIssueNotFoundError(issueId, { repoPath });
  }

  return issue;
}

/**
 * Updates an Issue's properties (title, description, status, labels, assignee).
 */
export async function updateIssue(
  repoPath: string,
  issueId: string,
  updates: Partial<Pick<GitIssue, 'title' | 'description' | 'status' | 'labels' | 'assignee'>>
): Promise<GitIssue> {
  const issues = await loadIssues(repoPath);
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
  await saveIssues(repoPath, issues);

  devInfo('GIT_ISSUE', `Updated Issue #${issueId}`);
  return issue;
}

/**
 * Closes an Issue.
 */
export async function closeIssue(
  repoPath: string,
  issueId: string,
  reason?: string
): Promise<GitIssue> {
  const issues = await loadIssues(repoPath);
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
  await saveIssues(repoPath, issues);

  devInfo('GIT_ISSUE', `Closed Issue #${issueId}: ${reason ?? '(no reason given)'}`);
  return issue;
}

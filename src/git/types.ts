import type { z } from 'zod';
import type {
  GitAuthorSchema,
  GitStatusResultSchema,
  CommitOptionsSchema,
  CommitResultSchema,
  CommitLogEntrySchema,
  BranchSummarySchema,
  MergeOptionsSchema,
  MergeResultSchema,
  DiffOptionsSchema,
  DiffResultSchema,
  StashOptionsSchema,
  StashEntrySchema,
  TagOptionsSchema,
  RemoteEntrySchema,
  PullRequestReviewSchema,
  PullRequestSchema,
  PullRequestFilterSchema,
  GitIssueSchema,
  GitIssueFilterSchema,
  IssueCommentSchema,
  InitRepoOptionsSchema,
  GitConfigSchema,
  PersistedGitAuthorsSchema,
  PersistedGitConfigSchema,
  RevertOptionsSchema,
  CherryPickOptionsSchema,
  AmendOptionsSchema,
} from './schema.js';

export type GitAuthor = z.infer<typeof GitAuthorSchema>;
export type GitStatusResult = z.infer<typeof GitStatusResultSchema>;
export type CommitOptions = z.input<typeof CommitOptionsSchema>;
export type CommitResult = z.infer<typeof CommitResultSchema>;
export type CommitLogEntry = z.infer<typeof CommitLogEntrySchema>;
export type BranchSummary = z.infer<typeof BranchSummarySchema>;
export type MergeOptions = z.input<typeof MergeOptionsSchema>;
export type MergeResult = z.infer<typeof MergeResultSchema>;
export type DiffOptions = z.input<typeof DiffOptionsSchema>;
export type DiffResult = z.infer<typeof DiffResultSchema>;
export type StashOptions = z.input<typeof StashOptionsSchema>;
export type StashEntry = z.infer<typeof StashEntrySchema>;
export type TagOptions = z.input<typeof TagOptionsSchema>;
export type RemoteEntry = z.infer<typeof RemoteEntrySchema>;
export type PullRequestReview = z.infer<typeof PullRequestReviewSchema>;
export type PullRequest = z.infer<typeof PullRequestSchema>;
export type PullRequestFilter = z.input<typeof PullRequestFilterSchema>;
export type GitIssue = z.infer<typeof GitIssueSchema>;
export type GitIssueFilter = z.input<typeof GitIssueFilterSchema>;
export type IssueComment = z.infer<typeof IssueCommentSchema>;
export type InitRepoOptions = z.input<typeof InitRepoOptionsSchema>;
export type GitConfig = z.infer<typeof GitConfigSchema>;
export type GitConfigInput = z.input<typeof GitConfigSchema>;
export type PersistedGitAuthors = z.infer<typeof PersistedGitAuthorsSchema>;
export type PersistedGitConfig = z.infer<typeof PersistedGitConfigSchema>;
export type RevertOptions = z.input<typeof RevertOptionsSchema>;
export type CherryPickOptions = z.input<typeof CherryPickOptionsSchema>;
export type AmendOptions = z.input<typeof AmendOptionsSchema>;

/**
 * Options for creating a new branch.
 */
export interface CreateBranchOptions {
  /** The starting point / commit / branch to branch off of (defaults to HEAD) */
  startPoint?: string;
  /** Whether to immediately checkout the newly created branch (default: false) */
  checkout?: boolean;
}

/**
 * Options for checking out a branch.
 */
export interface CheckoutBranchOptions {
  /** If true, creates the branch if it doesn't exist (`git checkout -b <name>`) */
  createNew?: boolean;
  /** The starting point commit/branch if creating a new branch */
  startPoint?: string;
  /** Force checkout discarding uncommitted working tree changes */
  force?: boolean;
}

/**
 * Options for discarding changes.
 */
export interface DiscardChangesOptions {
  /** Specific files to discard changes for (if omitted, discards all) */
  files?: string[];
  /** Whether to also remove untracked files */
  untracked?: boolean;
}

/**
 * Options for git log queries.
 */
export interface GitLogOptions {
  /** Maximum number of commits to retrieve (default: 50) */
  maxCount?: number;
  /** Specific branch, tag, or commit hash to view log from */
  fromRef?: string;
  /** Filter commits by author name or email */
  author?: string;
  /** Filter commits touching a specific file path */
  file?: string;
  /** Whether to include diff summary for each commit */
  includeDiff?: boolean;
}

/**
 * Detailed information for a single commit.
 */
export interface CommitDetails extends CommitLogEntry {
  diff?: string;
  files: string[];
}

/**
 * Detailed information for a single branch.
 */
export interface BranchDetails {
  name: string;
  current: boolean;
  commit: string;
  label: string;
  ahead?: number;
  behind?: number;
  upstream?: string;
}

/**
 * Detailed information for a Git tag.
 */
export interface TagDetails {
  name: string;
  commit: string;
  message?: string;
  tagger?: GitAuthor;
  date?: string;
}

/**
 * Detailed information for a Stash item.
 */
export interface StashDetails extends StashEntry {
  changedFiles?: string[];
  diff?: string;
}

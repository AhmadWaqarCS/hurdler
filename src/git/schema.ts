import { z } from 'zod';

/**
 * Standard Git Author representation.
 */
export const GitAuthorSchema = z.object({
  name: z.string().min(1, 'Git author name cannot be empty'),
  email: z.string().email('Git author email must be a valid email address'),
  timestamp: z.number().int().positive().optional(),
});

/**
 * Persisted Git Authors schema for `.hurdler/git/authors.json`.
 */
export const PersistedGitAuthorsSchema = z.object({
  version: z.string().default('1.0.0'),
  updatedAt: z.string(),
  authors: z.record(z.string(), GitAuthorSchema),
});

/**
 * Git reference (branch, tag) name validation.
 * Enforces standard git ref rules (disallows spaces, ~^:?*[\, .., leading/trailing slashes, .lock).
 */
export const GitRefNameSchema = z
  .string()
  .min(1, 'Git ref name cannot be empty')
  .max(255, 'Git ref name cannot exceed 255 characters')
  .regex(
    /^(?!\/)(?!.*\/\/)(?!.*\.lock$)(?!.*\.\.)[a-zA-Z0-9._\-\/]+(?<!\/)$/,
    'Invalid Git ref name format (must not contain spaces, control characters, .., or invalid symbols)'
  );

/**
 * Repository filesystem path schema.
 */
export const GitRepoPathSchema = z.string().min(1, 'Repository path cannot be empty');

/**
 * Structured Git Status schema.
 */
export const GitStatusResultSchema = z.object({
  current: z.string(),
  tracking: z.string().optional(),
  isClean: z.boolean(),
  modified: z.array(z.string()),
  staged: z.array(z.string()),
  not_added: z.array(z.string()),
  deleted: z.array(z.string()),
  renamed: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
  conflicted: z.array(z.string()),
  ahead: z.number().int().nonnegative().default(0),
  behind: z.number().int().nonnegative().default(0),
  files: z.array(
    z.object({
      path: z.string(),
      index: z.string(),
      working_dir: z.string(),
    })
  ),
});

/**
 * Commit options schema.
 */
export const CommitOptionsSchema = z.object({
  message: z.string().min(1, 'Commit message cannot be empty'),
  author: GitAuthorSchema.optional(),
  agentId: z.string().optional(),
  files: z.array(z.string()).optional(),
  amend: z.boolean().default(false),
  allowEmpty: z.boolean().default(false),
  noVerify: z.boolean().default(false),
});

/**
 * Commit result schema.
 */
export const CommitResultSchema = z.object({
  hash: z.string(),
  branch: z.string(),
  summary: z.object({
    changes: z.number().int().nonnegative(),
    insertions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
  }),
  author: GitAuthorSchema,
  message: z.string(),
  timestamp: z.string(),
});

/**
 * Commit log entry schema.
 */
export const CommitLogEntrySchema = z.object({
  hash: z.string(),
  date: z.string(),
  message: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  body: z.string().optional(),
  refs: z.string().optional(),
});

/**
 * Branch summary schema.
 */
export const BranchSummarySchema = z.object({
  current: z.string(),
  all: z.array(z.string()),
  branches: z.record(
    z.string(),
    z.object({
      current: z.boolean(),
      name: z.string(),
      commit: z.string(),
      label: z.string(),
    })
  ),
});

/**
 * Merge options schema.
 */
export const MergeOptionsSchema = z.object({
  sourceBranch: GitRefNameSchema,
  targetBranch: GitRefNameSchema.optional(),
  author: GitAuthorSchema.optional(),
  agentId: z.string().optional(),
  message: z.string().optional(),
  fastForwardOnly: z.boolean().default(false),
  noFf: z.boolean().default(false),
  squash: z.boolean().default(false),
});

/**
 * Merge result schema.
 */
export const MergeResultSchema = z.object({
  success: z.boolean(),
  mergedCommitHash: z.string().optional(),
  conflicts: z.array(z.string()).optional(),
  fastForward: z.boolean().default(false),
  alreadyUpToDate: z.boolean().default(false),
  message: z.string().optional(),
});

/**
 * Diff options schema.
 */
export const DiffOptionsSchema = z.object({
  staged: z.boolean().default(false),
  baseRef: z.string().optional(),
  targetRef: z.string().optional(),
  filePaths: z.array(z.string()).optional(),
  ignoreWhitespace: z.boolean().default(false),
});

/**
 * Diff result schema.
 */
export const DiffResultSchema = z.object({
  raw: z.string(),
  files: z.array(
    z.object({
      file: z.string(),
      changes: z.number().int().nonnegative(),
      insertions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
      binary: z.boolean().default(false),
    })
  ),
});

/**
 * Stash options schema.
 */
export const StashOptionsSchema = z.object({
  message: z.string().optional(),
  includeUntracked: z.boolean().default(false),
});

/**
 * Stash entry schema.
 */
export const StashEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  message: z.string(),
  hash: z.string().optional(),
  date: z.string().optional(),
});

/**
 * Tag options schema.
 */
export const TagOptionsSchema = z.object({
  message: z.string().optional(),
  ref: z.string().optional(),
  author: GitAuthorSchema.optional(),
  annotate: z.boolean().default(true),
});

/**
 * Remote entry schema.
 */
export const RemoteEntrySchema = z.object({
  name: z.string(),
  refs: z.object({
    fetch: z.string(),
    push: z.string(),
  }),
});

/**
 * Pull Request review schema.
 */
export const PullRequestReviewSchema = z.object({
  author: GitAuthorSchema,
  agentId: z.string().optional(),
  status: z.enum(['approved', 'changes_requested', 'commented']),
  comment: z.string(),
  createdAt: z.string(),
});

/**
 * Pull Request schema.
 */
export const PullRequestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'PR title cannot be empty'),
  description: z.string().default(''),
  sourceBranch: GitRefNameSchema,
  targetBranch: GitRefNameSchema,
  author: GitAuthorSchema,
  agentId: z.string().optional(),
  status: z.enum(['open', 'merged', 'closed', 'changes_requested']).default('open'),
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().optional(),
  mergedBy: GitAuthorSchema.optional(),
  closeReason: z.string().optional(),
  reviews: z.array(PullRequestReviewSchema).default([]),
});

/**
 * Pull Request filter schema.
 */
export const PullRequestFilterSchema = z.object({
  status: z.enum(['open', 'merged', 'closed', 'changes_requested']).optional(),
  author: z.string().optional(),
  agentId: z.string().optional(),
  sourceBranch: z.string().optional(),
  targetBranch: z.string().optional(),
});

/**
 * Issue comment schema.
 */
export const IssueCommentSchema = z.object({
  id: z.string().min(1),
  author: GitAuthorSchema,
  agentId: z.string().optional(),
  comment: z.string().min(1, 'Comment cannot be empty'),
  createdAt: z.string(),
});

/**
 * Git Issue schema.
 */
export const GitIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Issue title cannot be empty'),
  description: z.string().default(''),
  author: GitAuthorSchema,
  agentId: z.string().optional(),
  status: z.enum(['open', 'closed']).default('open'),
  labels: z.array(z.string()).default([]),
  assignee: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().optional(),
  closeReason: z.string().optional(),
  comments: z.array(IssueCommentSchema).default([]),
});

/**
 * Git Issue filter schema.
 */
export const GitIssueFilterSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  label: z.string().optional(),
  assignee: z.string().optional(),
  agentId: z.string().optional(),
});

/**
 * Init repository options schema.
 */
export const InitRepoOptionsSchema = z.object({
  defaultBranch: GitRefNameSchema.default('main'),
  initialCommit: z.boolean().default(true),
  initialCommitMessage: z.string().default('chore: initial repository structure'),
  author: GitAuthorSchema.optional(),
  agentId: z.string().optional(),
  gitignoreEntries: z.array(z.string()).optional(),
});

/**
 * Git Configuration schema.
 */
export const GitConfigSchema = z.object({
  defaultBranch: GitRefNameSchema.default('main'),
  autoStage: z.boolean().default(false),
  defaultCommitPrefix: z.string().default('chore:'),
  requireLinearHistory: z.boolean().default(false),
  defaultRemote: z.string().default('origin'),
  authorFallbackAgentId: z.string().default('orchestrator'),
  gitignoreDefaults: z
    .array(z.string())
    .default([
      'node_modules/',
      'dist/',
      '.env',
      '.env.*',
      '!.env.example',
      '*.log',
      '.DS_Store',
      'coverage/',
      '.hurdler/cache/',
    ]),
});

/**
 * Persisted Git Config schema for `.hurdler/git/config.json`.
 */
export const PersistedGitConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  updatedAt: z.string(),
  config: GitConfigSchema,
});

/**
 * Revert options schema.
 */
export const RevertOptionsSchema = z.object({
  commitHash: z.string().min(1, 'Commit hash is required'),
  noCommit: z.boolean().default(false),
  message: z.string().optional(),
  author: GitAuthorSchema.optional(),
  agentId: z.string().optional(),
});

/**
 * Cherry pick options schema.
 */
export const CherryPickOptionsSchema = z.object({
  commitHash: z.string().min(1, 'Commit hash is required'),
  noCommit: z.boolean().default(false),
  author: GitAuthorSchema.optional(),
  agentId: z.string().optional(),
});

/**
 * Amend options schema.
 */
export const AmendOptionsSchema = z.object({
  message: z.string().optional(),
  files: z.array(z.string()).optional(),
  author: GitAuthorSchema.optional(),
  agentId: z.string().optional(),
  noEdit: z.boolean().default(false),
});

import { z } from 'zod';
import type { NativeToolDefinition } from '../types.js';
import { resolveWorkspacePath } from '../security.js';
import { getGitStatus } from '../../../git/status.js';
import { getDiff, getShowFile } from '../../../git/diff.js';
import { getCommitLog } from '../../../git/commits.js';
import { listBranches, createBranch, checkoutBranch } from '../../../git/branches.js';
import { stageAndCommit } from '../../../git/commits.js';
import { mergeBranch } from '../../../git/merge.js';
import {
  createPullRequest,
  listPullRequests,
  reviewPullRequest,
} from '../../../git/prs.js';
import {
  createIssue,
  listIssues,
} from '../../../git/issues.js';
import { GitRefNameSchema } from '../../../git/schema.js';

const BaseGitToolInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe('Path to repository directory relative to workspace root (defaults to workspace root).'),
});

export const GitStatusInputSchema = BaseGitToolInputSchema;

export const GitDiffInputSchema = BaseGitToolInputSchema.extend({
  staged: z.boolean().default(false).describe('Whether to view staged changes (diff against HEAD).'),
  baseRef: z.string().optional().describe('Base commit or branch reference to compare from.'),
  targetRef: z.string().optional().describe('Target commit or branch reference to compare to.'),
  filePaths: z.array(z.string()).optional().describe('Specific file paths to limit diff to.'),
});

export const GitLogInputSchema = BaseGitToolInputSchema.extend({
  maxCount: z.number().int().positive().default(20).describe('Maximum number of commit entries to return.'),
  fromRef: z.string().optional().describe('Branch, tag, or commit hash to view log starting from.'),
  author: z.string().optional().describe('Filter commits by author name or email.'),
  file: z.string().optional().describe('Filter commits touching a specific file path.'),
});

export const GitBranchListInputSchema = BaseGitToolInputSchema;

export const GitBranchCreateInputSchema = BaseGitToolInputSchema.extend({
  branchName: GitRefNameSchema.describe('Name of the new branch to create (e.g. "feature/user-auth").'),
  checkout: z.boolean().default(true).describe('Whether to immediately switch/checkout the new branch.'),
  startPoint: z.string().optional().describe('Starting commit or branch to branch off of (defaults to HEAD).'),
});

export const GitBranchCheckoutInputSchema = BaseGitToolInputSchema.extend({
  branchName: GitRefNameSchema.describe('Name of the branch to switch to.'),
  createNew: z.boolean().default(false).describe('If true, creates the branch if it does not exist.'),
});

export const GitStageAndCommitInputSchema = BaseGitToolInputSchema.extend({
  files: z.array(z.string()).min(1, 'At least one file must be specified for staging and committing.'),
  message: z.string().min(1, 'Commit message cannot be empty.'),
  agentId: z.string().optional().describe('Agent ID attributing this commit (defaults to current context agent).'),
});

export const GitShowFileInputSchema = BaseGitToolInputSchema.extend({
  filePath: z.string().min(1, 'File path cannot be empty.'),
  ref: z.string().default('HEAD').describe('Git reference (commit hash, branch, or tag) to read file from.'),
});

export const GitMergeInputSchema = BaseGitToolInputSchema.extend({
  sourceBranch: GitRefNameSchema.describe('Source branch to merge into current or target branch.'),
  targetBranch: GitRefNameSchema.optional().describe('Target branch to merge into (defaults to active branch).'),
  noFf: z.boolean().default(false).describe('Create a merge commit even when the merge could instead be resolved as a fast-forward.'),
  squash: z.boolean().default(false).describe('Squash commits from source branch into a single commit.'),
  message: z.string().optional().describe('Optional custom merge commit message.'),
  agentId: z.string().optional().describe('Agent ID attributing this merge commit.'),
});

export const GitPRCreateInputSchema = BaseGitToolInputSchema.extend({
  title: z.string().min(1, 'PR title cannot be empty.').describe('Title summarizing the pull request.'),
  description: z.string().default('').describe('Detailed pull request description and rationale.'),
  sourceBranch: GitRefNameSchema.describe('Feature source branch containing proposed changes.'),
  targetBranch: GitRefNameSchema.optional().describe('Target branch to merge into (defaults to main/active).'),
  agentId: z.string().optional().describe('Agent ID authoring the pull request.'),
});

export const GitPRListInputSchema = BaseGitToolInputSchema.extend({
  status: z.enum(['open', 'merged', 'closed', 'changes_requested']).optional().describe('Filter by PR status.'),
  agentId: z.string().optional().describe('Filter by author agent ID.'),
});

export const GitPRReviewInputSchema = BaseGitToolInputSchema.extend({
  prId: z.string().min(1, 'PR ID is required.').describe('The Pull Request ID (e.g. "pr-1").'),
  status: z.enum(['approved', 'changes_requested', 'commented']).describe('Review conclusion.'),
  comment: z.string().min(1, 'Review comment cannot be empty.').describe('Detailed feedback or review notes.'),
  agentId: z.string().optional().describe('Agent ID submitting the review.'),
});

export const GitIssueCreateInputSchema = BaseGitToolInputSchema.extend({
  title: z.string().min(1, 'Issue title cannot be empty.').describe('Summary of the task, bug, or feature request.'),
  description: z.string().default('').describe('Detailed issue description.'),
  labels: z.array(z.string()).default([]).describe('Category labels (e.g. ["bug", "security"]).'),
  assignee: z.string().optional().describe('Agent ID or username assigned to this issue.'),
  agentId: z.string().optional().describe('Agent ID creating this issue.'),
});

export const GitIssueListInputSchema = BaseGitToolInputSchema.extend({
  status: z.enum(['open', 'closed']).optional().describe('Filter by issue status.'),
  label: z.string().optional().describe('Filter by label name.'),
  assignee: z.string().optional().describe('Filter by assignee ID.'),
});

/**
 * Tool: Inspect working tree status (cleanliness, modified, staged, untracked, branch).
 */
export const gitStatusTool: NativeToolDefinition<z.infer<typeof GitStatusInputSchema>> = {
  name: 'git_status',
  description: 'Inspects the Git repository status (active branch, staged files, modified files, untracked files).',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'status', 'vcs'],
  parameters: GitStatusInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    return await getGitStatus(targetRepo);
  },
};

/**
 * Tool: View git diffs (staged, unstaged, or between branches).
 */
export const gitDiffTool: NativeToolDefinition<z.infer<typeof GitDiffInputSchema>> = {
  name: 'git_diff',
  description: 'Shows Git diffs for unstaged modifications, staged changes, or between branches/commits.',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'diff', 'vcs'],
  parameters: GitDiffInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    return await getDiff(targetRepo, {
      staged: input.staged,
      baseRef: input.baseRef,
      targetRef: input.targetRef,
      filePaths: input.filePaths,
    });
  },
};

/**
 * Tool: Query commit history log.
 */
export const gitLogTool: NativeToolDefinition<z.infer<typeof GitLogInputSchema>> = {
  name: 'git_log',
  description: 'Retrieves commit history log entries with commit hashes, author identities, timestamps, and messages.',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'log', 'history', 'vcs'],
  parameters: GitLogInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    return await getCommitLog(targetRepo, {
      maxCount: input.maxCount,
      fromRef: input.fromRef,
      author: input.author,
      file: input.file,
    });
  },
};

/**
 * Tool: List local and remote branches.
 */
export const gitBranchListTool: NativeToolDefinition<z.infer<typeof GitBranchListInputSchema>> = {
  name: 'git_branch_list',
  description: 'Lists all local and tracking branches in the Git repository and indicates the current active branch.',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'branch', 'list', 'vcs'],
  parameters: GitBranchListInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    return await listBranches(targetRepo);
  },
};

/**
 * Tool: Create a new branch for feature isolation.
 */
export const gitBranchCreateTool: NativeToolDefinition<z.infer<typeof GitBranchCreateInputSchema>> = {
  name: 'git_branch_create',
  description: 'Creates a new branch for isolated feature development.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'branch', 'create', 'vcs'],
  parameters: GitBranchCreateInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    await createBranch(targetRepo, input.branchName, {
      checkout: input.checkout,
      startPoint: input.startPoint,
    });
    return {
      success: true,
      branchName: input.branchName,
      checkedOut: input.checkout,
    };
  },
};

/**
 * Tool: Switch active Git branch.
 */
export const gitBranchCheckoutTool: NativeToolDefinition<z.infer<typeof GitBranchCheckoutInputSchema>> = {
  name: 'git_branch_checkout',
  description: 'Switches the active Git branch to the specified branch name.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'branch', 'checkout', 'vcs'],
  parameters: GitBranchCheckoutInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    await checkoutBranch(targetRepo, input.branchName, {
      createNew: input.createNew,
    });
    return {
      success: true,
      activeBranch: input.branchName,
    };
  },
};

/**
 * Tool: Stage files and commit with agent author identity.
 */
export const gitStageAndCommitTool: NativeToolDefinition<z.infer<typeof GitStageAndCommitInputSchema>> = {
  name: 'git_stage_and_commit',
  description: 'Stages specific modified/created files and creates a Git commit with the agent author identity.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'commit', 'stage', 'vcs'],
  parameters: GitStageAndCommitInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    const agentId = input.agentId ?? context?.agentId;
    return await stageAndCommit(targetRepo, {
      files: input.files,
      message: input.message,
      agentId,
    });
  },
};

/**
 * Tool: View historical file content at a specific ref.
 */
export const gitShowFileTool: NativeToolDefinition<z.infer<typeof GitShowFileInputSchema>> = {
  name: 'git_show_file',
  description: 'Displays the contents of a file at a historical commit or branch ref without modifying the working tree.',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'show', 'history', 'vcs'],
  parameters: GitShowFileInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    const content = await getShowFile(targetRepo, input.filePath, input.ref);
    return {
      filePath: input.filePath,
      ref: input.ref,
      content,
    };
  },
};

/**
 * Tool: Merge a branch into the current active branch.
 */
export const gitMergeTool: NativeToolDefinition<z.infer<typeof GitMergeInputSchema>> = {
  name: 'git_merge',
  description: 'Merges a source branch into the target branch or current active working branch.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'merge', 'vcs'],
  parameters: GitMergeInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    const agentId = input.agentId ?? context?.agentId;
    return await mergeBranch(targetRepo, {
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      noFf: input.noFf,
      squash: input.squash,
      message: input.message,
      agentId,
    });
  },
};

/**
 * Tool: Create a local Pull Request.
 */
export const gitPRCreateTool: NativeToolDefinition<z.infer<typeof GitPRCreateInputSchema>> = {
  name: 'git_pr_create',
  description: 'Creates a new local Pull Request for proposing branch changes to the repository.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'pr', 'review', 'vcs'],
  parameters: GitPRCreateInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    const agentId = input.agentId ?? context?.agentId;
    return await createPullRequest(targetRepo, {
      title: input.title,
      description: input.description,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      agentId,
    });
  },
};

/**
 * Tool: List local Pull Requests.
 */
export const gitPRListTool: NativeToolDefinition<z.infer<typeof GitPRListInputSchema>> = {
  name: 'git_pr_list',
  description: 'Lists local Pull Requests with optional status and author filtering.',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'pr', 'list', 'vcs'],
  parameters: GitPRListInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    return await listPullRequests(targetRepo, {
      status: input.status,
      agentId: input.agentId,
    });
  },
};

/**
 * Tool: Review a local Pull Request.
 */
export const gitPRReviewTool: NativeToolDefinition<z.infer<typeof GitPRReviewInputSchema>> = {
  name: 'git_pr_review',
  description: 'Submits a code review with approval, requested changes, or comments on a local Pull Request.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'pr', 'review', 'vcs'],
  parameters: GitPRReviewInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    const agentId = input.agentId ?? context?.agentId;
    return await reviewPullRequest(targetRepo, input.prId, {
      status: input.status,
      comment: input.comment,
      agentId,
    });
  },
};

/**
 * Tool: Create a local Issue.
 */
export const gitIssueCreateTool: NativeToolDefinition<z.infer<typeof GitIssueCreateInputSchema>> = {
  name: 'git_issue_create',
  description: 'Creates a new local Issue for tracking bugs, features, or architectural tasks.',
  category: 'utility',
  readOnly: false,
  tags: ['git', 'issue', 'task', 'vcs'],
  parameters: GitIssueCreateInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    const agentId = input.agentId ?? context?.agentId;
    return await createIssue(targetRepo, {
      title: input.title,
      description: input.description,
      labels: input.labels,
      assignee: input.assignee,
      agentId,
    });
  },
};

/**
 * Tool: List local Issues.
 */
export const gitIssueListTool: NativeToolDefinition<z.infer<typeof GitIssueListInputSchema>> = {
  name: 'git_issue_list',
  description: 'Lists local Issues with status, label, and assignee filters.',
  category: 'utility',
  readOnly: true,
  tags: ['git', 'issue', 'list', 'vcs'],
  parameters: GitIssueListInputSchema,
  execute: async (input, context) => {
    const targetRepo = resolveWorkspacePath(input.repoPath ?? '.', context?.workspaceRoot);
    return await listIssues(targetRepo, {
      status: input.status,
      label: input.label,
      assignee: input.assignee,
    });
  },
};

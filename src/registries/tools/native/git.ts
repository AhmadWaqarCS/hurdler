import { z } from 'zod';
import type { NativeToolDefinition } from '../types.js';
import { resolveWorkspacePath } from '../security.js';
import { getGitStatus } from '../../../git/status.js';
import { getDiff, getShowFile } from '../../../git/diff.js';
import { getCommitLog } from '../../../git/commits.js';
import { listBranches, createBranch, checkoutBranch } from '../../../git/branches.js';
import { stageAndCommit } from '../../../git/commits.js';
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

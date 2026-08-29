import { gitService } from '../git/service.js';
import { defaultAgentRegistry } from '../registries/agents/service.js';
import { devInfo, devWarn } from '../core/dev-mode/index.js';
import type { GitAuthor } from '../git/types.js';
import type { WorkflowStepDefinition } from '../registries/workflows/types.js';
import type { WorkflowExecutionContext } from './types.js';

export interface StepCommitResult {
  committed: boolean;
  commitHash?: string;
  gitAuthor?: GitAuthor;
  message?: string;
}

/**
 * Prepares the Git branch environment for a workflow step.
 */
export async function prepareStepBranch(
  step: WorkflowStepDefinition,
  context: WorkflowExecutionContext
): Promise<string | undefined> {
  if (context.dryRun || !context.repoPath) {
    return context.currentBranch;
  }

  const targetBranch = step.gitAction?.branch ?? context.currentBranch;
  if (!targetBranch) {
    return undefined;
  }

  try {
    const isRepo = await gitService.isRepo(context.repoPath);
    if (!isRepo) {
      return undefined;
    }

    const exists = await gitService.branchExists(context.repoPath, targetBranch);
    if (!exists) {
      await gitService.createBranch(context.repoPath, targetBranch, { checkout: true });
      devInfo('WORKFLOW_GIT', `Created and checked out feature branch '${targetBranch}' for step '${step.id}'`);
    } else {
      const current = await gitService.getCurrentBranch(context.repoPath);
      if (current !== targetBranch) {
        await gitService.checkout(context.repoPath, targetBranch);
        devInfo('WORKFLOW_GIT', `Switched to branch '${targetBranch}' for step '${step.id}'`);
      }
    }
    context.currentBranch = targetBranch;
    return targetBranch;
  } catch (err) {
    devWarn('WORKFLOW_GIT', `Branch preparation failed for step '${step.id}': ${err}`);
    return context.currentBranch;
  }
}

/**
 * Stages and commits changes produced during a workflow step,
 * ensuring author attribution matches the responsible agent.
 */
export async function commitStepChanges(
  step: WorkflowStepDefinition,
  modifiedFiles: string[],
  context: WorkflowExecutionContext
): Promise<StepCommitResult> {
  const gitAction = step.gitAction;
  if (!gitAction || gitAction.commit === false || modifiedFiles.length === 0) {
    return { committed: false };
  }

  // Resolve author
  const authorAgentId = gitAction.authorAgentId ?? step.agentId ?? 'system';
  const author = defaultAgentRegistry.getGitAuthor(authorAgentId);

  // Template commit message
  let message = gitAction.commitMessage ?? `feat(${step.id}): ${step.title}`;
  message = message
    .replace(/\{\{stepId\}\}/g, step.id)
    .replace(/\{\{agentId\}\}/g, authorAgentId)
    .replace(/\{\{title\}\}/g, step.title);

  if (context.dryRun) {
    const mockHash = `mock_${Math.random().toString(16).substring(2, 10)}`;
    devInfo(
      'WORKFLOW_GIT',
      `[DRY-RUN] Committed ${modifiedFiles.length} file(s) as '${author.name} <${author.email}>': "${message}" (${mockHash})`
    );
    return {
      committed: true,
      commitHash: mockHash,
      gitAuthor: author,
      message,
    };
  }

  if (!context.repoPath) {
    return { committed: false };
  }

  try {
    const isRepo = await gitService.isRepo(context.repoPath);
    if (!isRepo) {
      return { committed: false };
    }

    // Stage files
    if (gitAction.stage === true) {
      await gitService.stage(context.repoPath, modifiedFiles);
    } else if (Array.isArray(gitAction.stage)) {
      await gitService.stage(context.repoPath, gitAction.stage);
    }

    // Commit with agent author signature
    const commitSummary = await gitService.commit(context.repoPath, {
      message,
      author,
    });

    devInfo(
      'WORKFLOW_GIT',
      `Committed ${modifiedFiles.length} file(s) as '${author.name} <${author.email}>': "${message}" (${commitSummary.hash})`
    );

    return {
      committed: true,
      commitHash: commitSummary.hash,
      gitAuthor: author,
      message,
    };
  } catch (err) {
    devWarn('WORKFLOW_GIT', `Failed to commit step changes for step '${step.id}': ${err}`);
    return {
      committed: false,
    };
  }
}

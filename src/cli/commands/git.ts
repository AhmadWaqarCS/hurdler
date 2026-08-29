/**
 * Hurdler CLI Subsystem - Git Subsystem Command
 * Full Git version control management, per-agent commit attribution, branch isolation, PRs, and issues.
 */

import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import {
  printHeader,
  printSuccess,
  printKeyValues,
  printDiff,
} from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  getGitStatus,
  listBranches,
  createBranch,
  checkoutBranch,
  deleteBranch,
  stageAll,
  commit,
  getCommitLog,
  getDiff,
  createPullRequest,
  listPullRequests,
  createIssue,
  listIssues,
  stashChanges,
  listStashes,
  popStash,
} from '../../git/index.js';
import { getOptionString, getOptionBoolean, getOptionNumber } from '../parser.js';

export const handleGitStatus: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  try {
    const status = await getGitStatus(repoPath);

    if (!ctx.isJson) {
      printHeader(`Git Repository Status (Branch: ${status.current || 'detached'})`);
      printKeyValues({
        'Current Branch': status.current || 'detached',
        'Tracking': status.tracking || 'None',
        'Clean Working Tree': status.isClean ? 'Yes' : 'No',
        'Staged Changes': status.staged.length,
        'Modified Files': status.modified.length,
        'Untracked Files': status.not_added.length,
        'Ahead / Behind': `+${status.ahead} / -${status.behind}`,
      });

      if (status.staged.length > 0) {
        console.log('\n🟢 Changes Staged for Commit:');
        for (const file of status.staged) {
          console.log(`  + ${file}`);
        }
      }

      if (status.modified.length > 0) {
        console.log('\n🟡 Changes Not Staged:');
        for (const file of status.modified) {
          console.log(`  M ${file}`);
        }
      }

      if (status.not_added.length > 0) {
        console.log('\n⚪ Untracked Files:');
        for (const file of status.not_added) {
          console.log(`  ? ${file}`);
        }
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: status,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to get Git status: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleGitBranch: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const subAction = args.positionals[0] || 'list';
  const branchName = args.positionals[1];

  try {
    if (subAction === 'list') {
      const branches = await listBranches(repoPath);
      const rows = Object.values(branches.branches).map((b) => ({
        current: b.current ? '*' : ' ',
        name: b.name,
        commit: b.commit || '-',
        label: b.label || '-',
      }));

      if (!ctx.isJson) {
        printHeader('Git Branches');
        console.log(
          formatTable(
            rows,
            [
              { key: 'current', label: ' ', minWidth: 2 },
              { key: 'name', label: 'Branch Name', minWidth: 26 },
              { key: 'commit', label: 'Commit Hash', minWidth: 12 },
              { key: 'label', label: 'Tracking', minWidth: 20 },
            ],
            { indent: '  ' }
          )
        );
      }
      return { success: true, exitCode: ExitCode.SUCCESS, data: branches };
    }

    if (subAction === 'create') {
      if (!branchName) {
        return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: 'Missing branch name.' };
      }
      const checkout = getOptionBoolean(args.options, 'checkout', 'c', true);
      const res = await createBranch(repoPath, branchName, { checkout });
      if (!ctx.isJson) printSuccess(`Created branch '${branchName}'${checkout ? ' and checked out' : ''}.`);
      return { success: true, exitCode: ExitCode.SUCCESS, data: res };
    }

    if (subAction === 'checkout') {
      if (!branchName) {
        return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: 'Missing branch name.' };
      }
      const res = await checkoutBranch(repoPath, branchName);
      if (!ctx.isJson) printSuccess(`Switched to branch '${branchName}'.`);
      return { success: true, exitCode: ExitCode.SUCCESS, data: res };
    }

    if (subAction === 'delete') {
      if (!branchName) {
        return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: 'Missing branch name.' };
      }
      const force = getOptionBoolean(args.options, 'force', 'f', false);
      const res = await deleteBranch(repoPath, branchName, { force });
      if (!ctx.isJson) printSuccess(`Deleted branch '${branchName}'.`);
      return { success: true, exitCode: ExitCode.SUCCESS, data: res };
    }

    return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: `Unknown branch action: ${subAction}` };
  } catch (err) {
    return { success: false, exitCode: ExitCode.ERROR, error: `Branch action failed: ${err instanceof Error ? err.message : String(err)}` };
  }
};

export const handleGitCommit: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const message = getOptionString(args.options, 'message', 'm') || args.positionals[0];
  const agentId = getOptionString(args.options, 'agent', 'a');
  const stageAllChanges = getOptionBoolean(args.options, 'all', 'A', false);

  if (!message) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing commit message.',
      suggestion: 'Usage: hurdler git commit -m "<message>" [--agent <agentId>] [--all]',
    };
  }

  try {
    if (stageAllChanges) {
      await stageAll(repoPath);
    }

    const result = await commit(repoPath, { message, agentId });

    if (!ctx.isJson) {
      printSuccess(`Committed changes: [${result.branch} ${result.hash}] ${message}`);
      printKeyValues({
        'Commit Hash': result.hash,
        'Branch': result.branch,
        'Author': `${result.author.name} <${result.author.email}>`,
      });
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Commit failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleGitLog: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const limit = getOptionNumber(args.options, 'limit', 'n', 15) ?? 15;

  try {
    const log = await getCommitLog(repoPath, { maxCount: limit });

    const rows = log.map((c) => ({
      hash: c.hash.slice(0, 7),
      date: c.date.slice(0, 10),
      author: c.author_name || 'unknown',
      message: c.message,
    }));

    if (!ctx.isJson) {
      printHeader(`Git Commit History (Recent ${rows.length})`);
      console.log(
        formatTable(
          rows,
          [
            { key: 'hash', label: 'Hash', minWidth: 9 },
            { key: 'date', label: 'Date', minWidth: 12 },
            { key: 'author', label: 'Author', minWidth: 20 },
            { key: 'message', label: 'Message', maxWidth: 45, minWidth: 25 },
          ],
          { indent: '  ' }
        )
      );
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: log,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to fetch log: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleGitDiff: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const staged = getOptionBoolean(args.options, 'staged', 's', false);
  const targetFile = args.positionals[0];

  try {
    const diff = await getDiff(repoPath, { staged, filePaths: targetFile ? [targetFile] : undefined });

    if (!ctx.isJson) {
      if (!diff.raw || diff.raw.trim().length === 0) {
        console.log('No differences detected.');
      } else {
        printDiff(diff.raw);
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: diff,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to generate diff: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleGitPr: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const action = args.positionals[0] || 'list';

  try {
    if (action === 'list') {
      const prs = await listPullRequests(repoPath);
      const rows = prs.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status.toUpperCase(),
        branch: `${p.sourceBranch} -> ${p.targetBranch}`,
        author: p.author.name,
      }));

      if (!ctx.isJson) {
        printHeader(`Local Pull Requests (${rows.length} total)`);
        console.log(
          formatTable(
            rows,
            [
              { key: 'id', label: 'PR ID', minWidth: 12 },
              { key: 'title', label: 'Title', minWidth: 26 },
              { key: 'status', label: 'Status', minWidth: 10 },
              { key: 'branch', label: 'Branches', minWidth: 24 },
              { key: 'author', label: 'Author', minWidth: 16 },
            ],
            { indent: '  ' }
          )
        );
      }
      return { success: true, exitCode: ExitCode.SUCCESS, data: prs };
    }

    if (action === 'create') {
      const title = getOptionString(args.options, 'title', 't');
      const base = getOptionString(args.options, 'base', 'b') || 'main';
      const head = getOptionString(args.options, 'head', 'h');
      const description = getOptionString(args.options, 'description', 'd');

      if (!title || !head) {
        return {
          success: false,
          exitCode: ExitCode.INVALID_ARGUMENTS,
          error: 'Missing --title or --head for PR creation.',
          suggestion: 'Usage: hurdler git pr create --title "<title>" --head "<branch>" [--base "<main>"]',
        };
      }

      const pr = await createPullRequest(repoPath, {
        title,
        sourceBranch: head,
        targetBranch: base,
        description,
      });

      if (!ctx.isJson) printSuccess(`Created Pull Request #${pr.id}: '${pr.title}'`);
      return { success: true, exitCode: ExitCode.SUCCESS, data: pr };
    }

    return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: `Unknown PR action: ${action}` };
  } catch (err) {
    return { success: false, exitCode: ExitCode.ERROR, error: `PR action failed: ${err instanceof Error ? err.message : String(err)}` };
  }
};

export const handleGitIssue: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const action = args.positionals[0] || 'list';

  try {
    if (action === 'list') {
      const issues = await listIssues(repoPath);
      const rows = issues.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status.toUpperCase(),
        author: i.author.name,
      }));

      if (!ctx.isJson) {
        printHeader(`Local Issue Tracker (${rows.length} total)`);
        console.log(
          formatTable(
            rows,
            [
              { key: 'id', label: 'Issue ID', minWidth: 12 },
              { key: 'title', label: 'Title', minWidth: 28 },
              { key: 'status', label: 'Status', minWidth: 10 },
              { key: 'author', label: 'Author', minWidth: 16 },
            ],
            { indent: '  ' }
          )
        );
      }
      return { success: true, exitCode: ExitCode.SUCCESS, data: issues };
    }

    if (action === 'create') {
      const title = getOptionString(args.options, 'title', 't');
      const body = getOptionString(args.options, 'body', 'b') || '';

      if (!title) {
        return {
          success: false,
          exitCode: ExitCode.INVALID_ARGUMENTS,
          error: 'Missing --title for issue creation.',
          suggestion: 'Usage: hurdler git issue create --title "<title>" [--body "<body>"]',
        };
      }

      const issue = await createIssue(repoPath, { title, description: body });
      if (!ctx.isJson) printSuccess(`Created Issue #${issue.id}: '${issue.title}'`);
      return { success: true, exitCode: ExitCode.SUCCESS, data: issue };
    }

    return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: `Unknown Issue action: ${action}` };
  } catch (err) {
    return { success: false, exitCode: ExitCode.ERROR, error: `Issue action failed: ${err instanceof Error ? err.message : String(err)}` };
  }
};

export const handleGitStash: CliCommandHandler = async (args, ctx) => {
  const repoPath = ctx.projectRoot || process.cwd();
  const action = args.positionals[0] || 'list';

  try {
    if (action === 'list') {
      const stashes = await listStashes(repoPath);
      if (!ctx.isJson) {
        printHeader(`Git Stash List (${stashes.length} entries)`);
        for (const s of stashes) {
          console.log(`  [${s.index}] ${s.message}`);
        }
      }
      return { success: true, exitCode: ExitCode.SUCCESS, data: stashes };
    }

    if (action === 'push') {
      const message = getOptionString(args.options, 'message', 'm');
      const res = await stashChanges(repoPath, { message });
      if (!ctx.isJson) printSuccess('Working tree changes stashed.');
      return { success: true, exitCode: ExitCode.SUCCESS, data: res };
    }

    if (action === 'pop') {
      const res = await popStash(repoPath, 0);
      if (!ctx.isJson) printSuccess('Popped top stash onto working tree.');
      return { success: true, exitCode: ExitCode.SUCCESS, data: res };
    }

    return { success: false, exitCode: ExitCode.INVALID_ARGUMENTS, error: `Unknown stash action: ${action}` };
  } catch (err) {
    return { success: false, exitCode: ExitCode.ERROR, error: `Stash action failed: ${err instanceof Error ? err.message : String(err)}` };
  }
};

export const gitCommandDefinition: CliCommandDefinition = {
  name: 'git',
  summary: 'Manage Git repository, agent-attributed commits, branches, PRs, and issues',
  description: 'Isolated Git operations engine supporting per-agent commits, feature branches, diffs, pull requests, and issues.',
  usage: 'hurdler git <status|branch|commit|log|diff|pr|issue|stash> [args] [options]',
  handler: handleGitStatus,
  subcommands: {
    status: {
      name: 'status',
      summary: 'Show working tree status and branch tracking',
      usage: 'hurdler git status [options]',
      handler: handleGitStatus,
    },
    branch: {
      name: 'branch',
      summary: 'List, create, checkout, or delete branches',
      usage: 'hurdler git branch <list|create|checkout|delete> [name] [options]',
      handler: handleGitBranch,
    },
    commit: {
      name: 'commit',
      summary: 'Create a commit with optional agent authorship attribution',
      usage: 'hurdler git commit -m "<message>" [--agent <agentId>] [--all]',
      options: [
        { name: 'message', alias: 'm', description: 'Commit message', type: 'string', required: true },
        { name: 'agent', alias: 'a', description: 'Agent ID attributing commit authorship', type: 'string' },
        { name: 'all', alias: 'A', description: 'Stage all modified files before committing', type: 'boolean' },
      ],
      handler: handleGitCommit,
    },
    log: {
      name: 'log',
      summary: 'Show commit history with author attribution',
      usage: 'hurdler git log [--limit <n>]',
      options: [{ name: 'limit', alias: 'n', description: 'Max commits to display', type: 'number', defaultValue: 15 }],
      handler: handleGitLog,
    },
    diff: {
      name: 'diff',
      summary: 'Display changes between commits, staged files, or working tree',
      usage: 'hurdler git diff [file] [--staged]',
      options: [{ name: 'staged', alias: 's', description: 'Compare staged changes against HEAD', type: 'boolean' }],
      handler: handleGitDiff,
    },
    pr: {
      name: 'pr',
      summary: 'Manage local pull requests (list, create, review)',
      usage: 'hurdler git pr <list|create> [options]',
      options: [
        { name: 'title', alias: 't', description: 'Pull request title', type: 'string' },
        { name: 'head', alias: 'h', description: 'Feature head branch', type: 'string' },
        { name: 'base', alias: 'b', description: 'Base target branch', type: 'string', defaultValue: 'main' },
      ],
      handler: handleGitPr,
    },
    issue: {
      name: 'issue',
      summary: 'Manage local issue tracking (list, create, close)',
      usage: 'hurdler git issue <list|create> [options]',
      options: [
        { name: 'title', alias: 't', description: 'Issue title', type: 'string' },
        { name: 'body', alias: 'b', description: 'Issue description body', type: 'string' },
      ],
      handler: handleGitIssue,
    },
    stash: {
      name: 'stash',
      summary: 'Manage stashed working tree changes',
      usage: 'hurdler git stash <list|push|pop|clear>',
      handler: handleGitStash,
    },
  },
  examples: [
    'hurdler git status',
    'hurdler git branch create feature/user-auth',
    'hurdler git commit -m "feat: add schema validation" --agent business-logic --all',
    'hurdler git log --limit 10',
    'hurdler git diff --staged',
  ],
};

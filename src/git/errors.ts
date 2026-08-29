import { HurdlerError, type HurdlerErrorOptions } from '../core/errors/base-error.js';

export interface GitErrorOptions extends HurdlerErrorOptions {
  command?: string;
  stderr?: string;
  exitCode?: number;
  repoPath?: string;
}

/**
 * Base error class for all Git subsystem errors.
 */
export class GitError extends HurdlerError {
  readonly command?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly repoPath?: string;

  constructor(message: string, options: GitErrorOptions = {}) {
    super(message, {
      code: options.code ?? 'GIT_ERROR',
      cause: options.cause,
      details: {
        ...options.details,
        command: options.command,
        stderr: options.stderr,
        exitCode: options.exitCode,
        repoPath: options.repoPath,
      },
    });
    this.command = options.command;
    this.stderr = options.stderr;
    this.exitCode = options.exitCode;
    this.repoPath = options.repoPath;
  }
}

/**
 * Thrown when an operation is attempted on a directory that is not a git repository.
 */
export class GitRepositoryNotFoundError extends GitError {
  constructor(targetPath: string, options: GitErrorOptions = {}) {
    super(`Target path '${targetPath}' is not a valid Git repository.`, {
      ...options,
      code: 'GIT_REPOSITORY_NOT_FOUND',
      repoPath: targetPath,
    });
  }
}

/**
 * Thrown when a Git merge or rebase encounters merge conflicts.
 */
export class GitConflictError extends GitError {
  readonly conflicts: string[];

  constructor(conflicts: string[], message?: string, options: GitErrorOptions = {}) {
    super(message ?? `Git operation resulted in merge conflicts in ${conflicts.length} file(s).`, {
      ...options,
      code: 'GIT_CONFLICT_ERROR',
      details: { ...options.details, conflicts },
    });
    this.conflicts = conflicts;
  }
}

/**
 * Thrown when a Git merge fails due to non-conflict issues (e.g. fast-forward impossible).
 */
export class GitMergeError extends GitError {
  constructor(message: string, options: GitErrorOptions = {}) {
    super(`Git merge failed: ${message}`, {
      ...options,
      code: 'GIT_MERGE_ERROR',
    });
  }
}

/**
 * Thrown when a specified Git branch does not exist.
 */
export class GitBranchNotFoundError extends GitError {
  readonly branchName: string;

  constructor(branchName: string, options: GitErrorOptions = {}) {
    super(`Git branch '${branchName}' was not found.`, {
      ...options,
      code: 'GIT_BRANCH_NOT_FOUND',
      details: { ...options.details, branchName },
    });
    this.branchName = branchName;
  }
}

/**
 * Thrown when attempting to create a branch that already exists.
 */
export class GitBranchAlreadyExistsError extends GitError {
  readonly branchName: string;

  constructor(branchName: string, options: GitErrorOptions = {}) {
    super(`Git branch '${branchName}' already exists.`, {
      ...options,
      code: 'GIT_BRANCH_ALREADY_EXISTS',
      details: { ...options.details, branchName },
    });
    this.branchName = branchName;
  }
}

/**
 * Thrown when an operation cannot proceed due to dirty uncommitted changes in the working tree.
 */
export class GitUncommittedChangesError extends GitError {
  constructor(message = 'Operation cannot proceed because of uncommitted changes in the working tree.', options: GitErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'GIT_UNCOMMITTED_CHANGES',
    });
  }
}

/**
 * Thrown when Git input parameters (e.g. branch names, commit messages) fail schema validation.
 */
export class GitValidationError extends GitError {
  constructor(message: string, options: GitErrorOptions = {}) {
    super(`Git validation failed: ${message}`, {
      ...options,
      code: 'GIT_VALIDATION_ERROR',
    });
  }
}

/**
 * Thrown when a path traversal or security boundary violation is detected.
 */
export class GitSecurityError extends GitError {
  constructor(message: string, options: GitErrorOptions = {}) {
    super(`Git security violation: ${message}`, {
      ...options,
      code: 'GIT_SECURITY_ERROR',
    });
  }
}

/**
 * Thrown when a Pull Request ID is not found.
 */
export class GitPRNotFoundError extends GitError {
  readonly prId: string;

  constructor(prId: string, options: GitErrorOptions = {}) {
    super(`Pull Request '${prId}' was not found.`, {
      ...options,
      code: 'GIT_PR_NOT_FOUND',
      details: { ...options.details, prId },
    });
    this.prId = prId;
  }
}

/**
 * Thrown when an Issue ID is not found.
 */
export class GitIssueNotFoundError extends GitError {
  readonly issueId: string;

  constructor(issueId: string, options: GitErrorOptions = {}) {
    super(`Git Issue '${issueId}' was not found.`, {
      ...options,
      code: 'GIT_ISSUE_NOT_FOUND',
      details: { ...options.details, issueId },
    });
    this.issueId = issueId;
  }
}

/**
 * Thrown when a Git tag is not found.
 */
export class GitTagNotFoundError extends GitError {
  readonly tagName: string;

  constructor(tagName: string, options: GitErrorOptions = {}) {
    super(`Git tag '${tagName}' was not found.`, {
      ...options,
      code: 'GIT_TAG_NOT_FOUND',
      details: { ...options.details, tagName },
    });
    this.tagName = tagName;
  }
}

/**
 * Thrown when a Git remote is not found.
 */
export class GitRemoteNotFoundError extends GitError {
  readonly remoteName: string;

  constructor(remoteName: string, options: GitErrorOptions = {}) {
    super(`Git remote '${remoteName}' was not found.`, {
      ...options,
      code: 'GIT_REMOTE_NOT_FOUND',
      details: { ...options.details, remoteName },
    });
    this.remoteName = remoteName;
  }
}

/**
 * Thrown when a Git stash index is not found.
 */
export class GitStashNotFoundError extends GitError {
  readonly stashIndex: number;

  constructor(stashIndex: number, options: GitErrorOptions = {}) {
    super(`Git stash at index '${stashIndex}' was not found.`, {
      ...options,
      code: 'GIT_STASH_NOT_FOUND',
      details: { ...options.details, stashIndex },
    });
    this.stashIndex = stashIndex;
  }
}

/**
 * Thrown when Git configuration read or write fails.
 */
export class GitConfigError extends GitError {
  constructor(message: string, options: GitErrorOptions = {}) {
    super(`Git configuration error: ${message}`, {
      ...options,
      code: 'GIT_CONFIG_ERROR',
    });
  }
}

/**
 * Thrown when reading or writing Git persistent metadata in `.hurdler/git/` fails.
 */
export class GitStorageError extends GitError {
  readonly filePath: string;
  readonly operation: 'read' | 'write' | 'delete';

  constructor(filePath: string, operation: 'read' | 'write' | 'delete', reason: string, cause?: unknown) {
    super(`Failed to ${operation} Git store at '${filePath}': ${reason}`, {
      cause,
      code: 'GIT_STORAGE_ERROR',
      details: { filePath, operation, reason },
    });
    this.filePath = filePath;
    this.operation = operation;
  }
}

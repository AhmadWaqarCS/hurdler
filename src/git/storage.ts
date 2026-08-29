import fs from 'node:fs/promises';
import path from 'node:path';
import { devDebug, devError, devInfo } from '../core/dev-mode/index.js';
import {
  PersistedGitConfigSchema,
  PersistedGitAuthorsSchema,
  PullRequestSchema,
  GitIssueSchema,
} from './schema.js';
import { GitStorageError } from './errors.js';
import type {
  GitConfig,
  GitAuthor,
  PullRequest,
  GitIssue,
  PersistedGitConfig,
  PersistedGitAuthors,
} from './types.js';
import { z } from 'zod';

export const GIT_STORE_PATHS = {
  config: path.join('.hurdler', 'git', 'config.json'),
  authors: path.join('.hurdler', 'git', 'authors.json'),
  prs: path.join('.hurdler', 'git', 'prs.json'),
  issues: path.join('.hurdler', 'git', 'issues.json'),
};

/**
 * Resolves an absolute path to a Git store file within a repository.
 *
 * @param repoPath - The base repository directory.
 * @param relativeStorePath - Relative path to the target store file.
 * @returns Fully-resolved absolute file path.
 */
export function resolveGitStorePath(repoPath: string, relativeStorePath: string): string {
  return path.resolve(repoPath, relativeStorePath);
}

/**
 * Atomically writes JSON data to a file by writing to a temporary file first and then renaming it.
 *
 * @param filePath - The absolute destination file path.
 * @param data - The JSON-serializable data object.
 * @throws GitStorageError if directory creation or file write fails.
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (err: unknown) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore temp file cleanup error
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new GitStorageError(filePath, 'write', message, err);
  }
}

/**
 * Loads and parses JSON from a file, returning null if the file does not exist.
 *
 * @param filePath - The absolute path of the file to load.
 * @returns Parsed JSON content or null if not found.
 * @throws GitStorageError if file read or JSON parse fails (other than ENOENT).
 */
async function loadJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw new GitStorageError(filePath, 'read', err.message, err);
  }
}

// ============================================================================
// Git Configuration Persistence
// ============================================================================

/**
 * Loads and validates Git configuration from `.hurdler/git/config.json`.
 *
 * @param repoPath - Repository root path.
 * @returns The validated GitConfig, or null if file does not exist.
 *
 * @example
 * ```typescript
 * const config = await loadGitConfigFromDisk('/my-repo');
 * ```
 */
export async function loadGitConfigFromDisk(repoPath: string): Promise<GitConfig | null> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.config);
  try {
    const raw = await loadJsonIfExists(filePath);
    if (!raw) return null;

    const validated = PersistedGitConfigSchema.parse(raw);
    devDebug('GIT_STORAGE', `Loaded Git config from '${filePath}'`);
    return validated.config;
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to parse Git config from '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Persists Git configuration to `.hurdler/git/config.json`.
 *
 * @param repoPath - Repository root path.
 * @param config - Git configuration object to save.
 *
 * @example
 * ```typescript
 * await saveGitConfigToDisk('/my-repo', currentConfig);
 * ```
 */
export async function saveGitConfigToDisk(repoPath: string, config: GitConfig): Promise<void> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.config);
  try {
    const payload: PersistedGitConfig = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      config,
    };
    const validated = PersistedGitConfigSchema.parse(payload);
    await atomicWriteJson(filePath, validated);
    devInfo('GIT_STORAGE', `Saved Git configuration to '${filePath}'`);
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to save Git config to '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'write', err.message, err);
  }
}

// ============================================================================
// Git Authors Persistence
// ============================================================================

/**
 * Loads custom agent Git authors from `.hurdler/git/authors.json`.
 *
 * @param repoPath - Repository root path.
 * @returns Map of agent IDs to GitAuthor objects, or null if file not found.
 *
 * @example
 * ```typescript
 * const authors = await loadGitAuthorsFromDisk('/my-repo');
 * ```
 */
export async function loadGitAuthorsFromDisk(repoPath: string): Promise<Record<string, GitAuthor> | null> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.authors);
  try {
    const raw = await loadJsonIfExists(filePath);
    if (!raw) return null;

    const validated = PersistedGitAuthorsSchema.parse(raw);
    devDebug('GIT_STORAGE', `Loaded ${Object.keys(validated.authors).length} custom author(s) from '${filePath}'`);
    return validated.authors;
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to parse Git authors from '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Persists custom agent Git authors to `.hurdler/git/authors.json`.
 *
 * @param repoPath - Repository root path.
 * @param authors - Map of agent IDs to GitAuthor objects.
 *
 * @example
 * ```typescript
 * await saveGitAuthorsToDisk('/my-repo', { 'lead-dev': { name: 'Lead Dev', email: 'lead@hurdler.local' } });
 * ```
 */
export async function saveGitAuthorsToDisk(repoPath: string, authors: Record<string, GitAuthor>): Promise<void> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.authors);
  try {
    const payload: PersistedGitAuthors = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      authors,
    };
    const validated = PersistedGitAuthorsSchema.parse(payload);
    await atomicWriteJson(filePath, validated);
    devInfo('GIT_STORAGE', `Saved ${Object.keys(validated.authors).length} Git author(s) to '${filePath}'`);
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to save Git authors to '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'write', err.message, err);
  }
}

// ============================================================================
// Pull Requests Persistence
// ============================================================================

/**
 * Loads all Pull Requests from `.hurdler/git/prs.json`.
 *
 * @param repoPath - Repository root path.
 * @returns Array of validated PullRequest objects.
 *
 * @example
 * ```typescript
 * const prs = await loadPullRequestsFromDisk('/my-repo');
 * ```
 */
export async function loadPullRequestsFromDisk(repoPath: string): Promise<PullRequest[]> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.prs);
  try {
    const raw = await loadJsonIfExists(filePath);
    if (!raw) return [];

    const validated = z.array(PullRequestSchema).parse(raw);
    devDebug('GIT_STORAGE', `Loaded ${validated.length} Pull Request(s) from '${filePath}'`);
    return validated;
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to load Pull Requests from '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Persists all Pull Requests to `.hurdler/git/prs.json`.
 *
 * @param repoPath - Repository root path.
 * @param prs - Array of PullRequest objects to save.
 *
 * @example
 * ```typescript
 * await savePullRequestsToDisk('/my-repo', prs);
 * ```
 */
export async function savePullRequestsToDisk(repoPath: string, prs: PullRequest[]): Promise<void> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.prs);
  try {
    const validated = z.array(PullRequestSchema).parse(prs);
    await atomicWriteJson(filePath, validated);
    devDebug('GIT_STORAGE', `Saved ${validated.length} Pull Request(s) to '${filePath}'`);
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to save Pull Requests to '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'write', err.message, err);
  }
}

// ============================================================================
// Issues Persistence
// ============================================================================

/**
 * Loads all Git Issues from `.hurdler/git/issues.json`.
 *
 * @param repoPath - Repository root path.
 * @returns Array of validated GitIssue objects.
 *
 * @example
 * ```typescript
 * const issues = await loadIssuesFromDisk('/my-repo');
 * ```
 */
export async function loadIssuesFromDisk(repoPath: string): Promise<GitIssue[]> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.issues);
  try {
    const raw = await loadJsonIfExists(filePath);
    if (!raw) return [];

    const validated = z.array(GitIssueSchema).parse(raw);
    devDebug('GIT_STORAGE', `Loaded ${validated.length} Issue(s) from '${filePath}'`);
    return validated;
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to load Issues from '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Persists all Git Issues to `.hurdler/git/issues.json`.
 *
 * @param repoPath - Repository root path.
 * @param issues - Array of GitIssue objects to save.
 *
 * @example
 * ```typescript
 * await saveIssuesToDisk('/my-repo', issues);
 * ```
 */
export async function saveIssuesToDisk(repoPath: string, issues: GitIssue[]): Promise<void> {
  const filePath = resolveGitStorePath(repoPath, GIT_STORE_PATHS.issues);
  try {
    const validated = z.array(GitIssueSchema).parse(issues);
    await atomicWriteJson(filePath, validated);
    devDebug('GIT_STORAGE', `Saved ${validated.length} Issue(s) to '${filePath}'`);
  } catch (err: any) {
    if (err instanceof GitStorageError) throw err;
    devError('GIT_STORAGE', `Failed to save Issues to '${filePath}': ${err.message}`, err);
    throw new GitStorageError(filePath, 'write', err.message, err);
  }
}

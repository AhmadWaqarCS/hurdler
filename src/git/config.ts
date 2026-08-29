import { GitConfigSchema } from './schema.js';
import { GitConfigError, GitValidationError } from './errors.js';
import { loadGitConfigFromDisk, saveGitConfigToDisk } from './storage.js';
import type { GitConfig, GitConfigInput } from './types.js';
import { devInfo, devDebug } from '../core/dev-mode/index.js';

/**
 * Standard baseline default Git configuration for Hurdler projects.
 */
export const DEFAULT_GIT_CONFIG: GitConfig = {
  defaultBranch: 'main',
  autoStage: false,
  defaultCommitPrefix: 'chore:',
  requireLinearHistory: false,
  defaultRemote: 'origin',
  authorFallbackAgentId: 'orchestrator',
  gitignoreDefaults: [
    'node_modules/',
    'dist/',
    '.env',
    '.env.*',
    '!.env.example',
    '*.log',
    '.DS_Store',
    'coverage/',
    '.hurdler/cache/',
  ],
};

const repoConfigCache = new Map<string, GitConfig>();

/**
 * Retrieves the Git configuration for a repository (loading from disk or cache with baseline defaults).
 *
 * @param repoPath - Repository root path (defaults to process.cwd()).
 * @returns Validated GitConfig object.
 *
 * @example
 * ```typescript
 * const config = await getGitConfig('/my-repo');
 * console.log(config.defaultBranch); // 'main'
 * ```
 */
export async function getGitConfig(repoPath = process.cwd()): Promise<GitConfig> {
  const normalizedPath = repoPath.trim();

  if (repoConfigCache.has(normalizedPath)) {
    return { ...repoConfigCache.get(normalizedPath)! };
  }

  const diskConfig = await loadGitConfigFromDisk(normalizedPath);
  if (diskConfig) {
    repoConfigCache.set(normalizedPath, diskConfig);
    return { ...diskConfig };
  }

  // Fallback to default config and initialize on disk
  const initialConfig = { ...DEFAULT_GIT_CONFIG };
  repoConfigCache.set(normalizedPath, initialConfig);
  await saveGitConfigToDisk(normalizedPath, initialConfig);
  return { ...initialConfig };
}

/**
 * Updates the Git configuration for a repository.
 *
 * @param repoPath - Repository root path.
 * @param updates - Partial configuration options to update.
 * @returns The newly updated GitConfig.
 * @throws GitValidationError if update fails schema validation.
 *
 * @example
 * ```typescript
 * const updated = await updateGitConfig('/my-repo', { defaultBranch: 'master', autoStage: true });
 * ```
 */
export async function updateGitConfig(
  repoPath: string,
  updates: Partial<GitConfigInput>
): Promise<GitConfig> {
  const current = await getGitConfig(repoPath);
  const merged = { ...current, ...updates };

  const parseResult = GitConfigSchema.safeParse(merged);
  if (!parseResult.success) {
    throw new GitValidationError(
      `Invalid Git configuration: ${parseResult.error.issues.map((i) => i.message).join(', ')}`
    );
  }

  const normalizedPath = repoPath.trim();
  repoConfigCache.set(normalizedPath, parseResult.data);
  await saveGitConfigToDisk(normalizedPath, parseResult.data);

  devInfo('GIT_CONFIG', `Updated Git configuration for '${normalizedPath}'`);
  return parseResult.data;
}

/**
 * Resets the Git configuration for a repository back to default baseline values.
 *
 * @param repoPath - Repository root path.
 * @returns Reset GitConfig object.
 *
 * @example
 * ```typescript
 * const resetConfig = await resetGitConfig('/my-repo');
 * ```
 */
export async function resetGitConfig(repoPath: string): Promise<GitConfig> {
  const normalizedPath = repoPath.trim();
  const defaultConfig = { ...DEFAULT_GIT_CONFIG };

  repoConfigCache.set(normalizedPath, defaultConfig);
  await saveGitConfigToDisk(normalizedPath, defaultConfig);

  devInfo('GIT_CONFIG', `Reset Git configuration to defaults for '${normalizedPath}'`);
  return defaultConfig;
}

/**
 * Clears the in-memory Git configuration cache.
 */
export function clearGitConfigCache(): void {
  repoConfigCache.clear();
  devDebug('GIT_CONFIG', 'Cleared Git configuration memory cache.');
}

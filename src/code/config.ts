import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectCodeConfigSchema } from './schema.js';
import type { ProjectCodeConfig } from './types.js';
import { CodeError } from './errors.js';
import { devInfo, devDebug, devError } from '../core/dev-mode/index.js';

export const DEFAULT_CODE_CONFIG_PATH = '.hurdler/config/code.json';

export const DEFAULT_PROJECT_CODE_CONFIG: ProjectCodeConfig = {
  lintRuleOverrides: {},
  defaultPrettierOptions: {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    useTabs: false,
    trailingComma: 'es5',
    printWidth: 100,
    bracketSpacing: true,
    bracketSameLine: false,
    arrowParens: 'always',
    endOfLine: 'lf',
  },
  outlineDefaults: {
    detailLevel: 'standard',
    format: 'markdown',
    includeImports: false,
    includeExports: true,
    includePrivate: false,
    includeDocstrings: true,
  },
  codebaseScanner: {
    includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    excludePatterns: ['node_modules/**', 'dist/**', '.git/**', '.next/**', 'coverage/**'],
    maxFiles: 200,
    detailLevel: 'compact',
  },
  concurrency: 4,
};

/**
 * Resolves the absolute path to the project code configuration JSON file.
 *
 * @param customPath - Optional custom path override.
 * @param projectRoot - Project root directory (defaults to process.cwd()).
 * @returns Fully-resolved absolute path.
 */
export function resolveCodeConfigPath(
  customPath?: string,
  projectRoot = process.cwd()
): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(projectRoot, customPath);
  }
  return path.resolve(projectRoot, DEFAULT_CODE_CONFIG_PATH);
}

/**
 * Checks whether the persisted code configuration JSON file exists on disk.
 *
 * @param customPath - Optional custom path override.
 * @param projectRoot - Optional project root directory.
 * @returns Promise resolving to true if file exists and is accessible.
 */
export async function isCodeConfigFilePresent(
  customPath?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const filePath = resolveCodeConfigPath(customPath, projectRoot);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads and validates the project code configuration from disk.
 * Returns null if the file does not exist.
 *
 * @param options - Optional target path and project root overrides.
 * @returns Validated ProjectCodeConfig, or null if file not found.
 */
export async function loadCodeConfigFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<ProjectCodeConfig | null> {
  const filePath = resolveCodeConfigPath(options?.targetPath, options?.projectRoot);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw || raw.trim().length === 0) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const validated = ProjectCodeConfigSchema.parse(parsed);

    devDebug('CODE_CONFIG', `Loaded project code configuration from '${filePath}'`);
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    devError('CODE_CONFIG', `Failed to load code configuration from '${filePath}': ${err.message}`, err);
    throw new CodeError(`Failed to load code config from '${filePath}': ${err.message}`, {
      filePath,
      cause: err,
    });
  }
}

/**
 * Persists project code configuration to disk at `.hurdler/config/code.json`.
 *
 * @param config - ProjectCodeConfig object to save.
 * @param options - Optional target path and project root overrides.
 */
export async function saveCodeConfigToDisk(
  config: Partial<ProjectCodeConfig>,
  options?: { targetPath?: string; projectRoot?: string }
): Promise<ProjectCodeConfig> {
  const filePath = resolveCodeConfigPath(options?.targetPath, options?.projectRoot);
  const dir = path.dirname(filePath);

  try {
    const merged = { ...DEFAULT_PROJECT_CODE_CONFIG, ...config };
    const validated = ProjectCodeConfigSchema.parse(merged);

    await fs.mkdir(dir, { recursive: true });
    const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    await fs.writeFile(tempFilePath, JSON.stringify(validated, null, 2), 'utf8');
    await fs.rename(tempFilePath, filePath);

    devInfo('CODE_CONFIG', `Saved project code configuration to '${filePath}'`);
    return validated;
  } catch (err: any) {
    devError('CODE_CONFIG', `Failed to save code configuration to '${filePath}': ${err.message}`, err);
    throw new CodeError(`Failed to save code config to '${filePath}': ${err.message}`, {
      filePath,
      cause: err,
    });
  }
}

/**
 * Synchronizes code configuration with disk.
 * If `.hurdler/config/code.json` exists, loads and merges with defaults.
 * If the file does not exist, initializes it with defaults.
 *
 * @param options - Optional target path and project root overrides.
 * @returns Fully merged ProjectCodeConfig.
 */
export async function syncCodeConfigWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<ProjectCodeConfig> {
  const existing = await loadCodeConfigFromDisk(options);

  if (!existing) {
    devInfo(
      'CODE_CONFIG',
      `Initializing baseline code configuration at '${resolveCodeConfigPath(options?.targetPath, options?.projectRoot)}'`
    );
    return await saveCodeConfigToDisk(DEFAULT_PROJECT_CODE_CONFIG, options);
  }

  return {
    ...DEFAULT_PROJECT_CODE_CONFIG,
    ...existing,
    lintRuleOverrides: {
      ...DEFAULT_PROJECT_CODE_CONFIG.lintRuleOverrides,
      ...(existing.lintRuleOverrides ?? {}),
    },
    defaultPrettierOptions: {
      ...DEFAULT_PROJECT_CODE_CONFIG.defaultPrettierOptions,
      ...(existing.defaultPrettierOptions ?? {}),
    },
  };
}

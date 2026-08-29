import fs from 'node:fs/promises';
import path from 'node:path';
import { devDebug, devError, devInfo } from '../../core/dev-mode/dev-mode.js';
import { HurdlerError } from '../../core/errors/base-error.js';
import { LLMRegistryMapSchema } from './schema.js';
import { STATIC_PROVIDERS } from './static-registry.js';
import type { LLMRegistryMap, ProviderDefinition } from './types.js';

export const DEFAULT_LLM_REGISTRY_PATH = '.hurdler/registries/llms.json';

/**
 * Thrown when an error occurs reading, writing, or validating the persisted LLM registry file.
 */
export class LLMRegistryStorageError extends HurdlerError {
  constructor(filePath: string, operation: 'read' | 'write' | 'validate', message: string, cause?: unknown) {
    super(`Failed to ${operation} LLM registry at '${filePath}': ${message}`, {
      code: 'LLM_REGISTRY_STORAGE_ERROR',
      details: { filePath, operation },
      cause,
    });
  }
}

/**
 * Resolves the absolute path to the LLM registry JSON file.
 *
 * @param customPath - Optional custom relative or absolute path.
 * @param projectRoot - Base directory (defaults to process.cwd()).
 * @returns Absolute path to registry JSON file.
 */
export function resolveLLMRegistryPath(customPath?: string, projectRoot = process.cwd()): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(projectRoot, customPath);
  }
  return path.resolve(projectRoot, DEFAULT_LLM_REGISTRY_PATH);
}

/**
 * Checks whether the persisted LLM registry file exists on disk.
 *
 * @param customPath - Optional custom path.
 * @param projectRoot - Optional project root.
 * @returns Promise resolving to true if file exists and is accessible.
 */
export async function isLLMRegistryFilePresent(
  customPath?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const filePath = resolveLLMRegistryPath(customPath, projectRoot);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists provider registry records to disk in `.hurdler/registries/llms.json`.
 *
 * @param providers - Map or array of ProviderDefinition items to save.
 * @param options - Optional path overrides.
 */
export async function saveLLMRegistryToDisk(
  providers: Record<string, ProviderDefinition> | ProviderDefinition[],
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const filePath = resolveLLMRegistryPath(options?.targetPath, options?.projectRoot);
  const dir = path.dirname(filePath);

  const providerMap: Record<string, ProviderDefinition> = {};
  if (Array.isArray(providers)) {
    for (const p of providers) {
      providerMap[p.id] = p;
    }
  } else {
    Object.assign(providerMap, providers);
  }

  try {
    // Validate entire structure before saving
    const validated = LLMRegistryMapSchema.parse(providerMap);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf8');

    devInfo('REGISTRY_STORAGE', `Saved LLM registry with ${Object.keys(validated).length} provider(s) to '${filePath}'`);
  } catch (err: any) {
    devError('REGISTRY_STORAGE', `Failed to save LLM registry to '${filePath}': ${err.message}`, err);
    throw new LLMRegistryStorageError(filePath, 'write', err.message, err);
  }
}

/**
 * Loads and validates the persisted LLM registry from `.hurdler/registries/llms.json`.
 * Returns null if the file does not exist.
 *
 * @param options - Optional path overrides.
 * @returns Validated provider map, or null if file not found.
 */
export async function loadLLMRegistryFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<LLMRegistryMap | null> {
  const filePath = resolveLLMRegistryPath(options?.targetPath, options?.projectRoot);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = LLMRegistryMapSchema.parse(parsed);

    devDebug('REGISTRY_STORAGE', `Loaded LLM registry from '${filePath}' with ${Object.keys(validated).length} provider(s)`);
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    devError('REGISTRY_STORAGE', `Failed to load LLM registry from '${filePath}': ${err.message}`, err);
    throw new LLMRegistryStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Synchronizes in-memory registry with disk.
 * If `.hurdler/registries/llms.json` exists, loads and merges user-configured models/providers
 * on top of baseline STATIC_PROVIDERS.
 * If the file does NOT exist, initializes `.hurdler/registries/llms.json` with baseline STATIC_PROVIDERS.
 *
 * @param options - Optional path overrides.
 * @returns Merged provider map.
 */
export async function syncLLMRegistryWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<LLMRegistryMap> {
  const existing = await loadLLMRegistryFromDisk(options);

  if (!existing) {
    // Seed initial registry file with baseline providers
    devInfo('REGISTRY_STORAGE', `Initializing baseline LLM registry file at '${resolveLLMRegistryPath(options?.targetPath, options?.projectRoot)}'`);
    await saveLLMRegistryToDisk(STATIC_PROVIDERS, options);
    return { ...STATIC_PROVIDERS };
  }

  // Merge static baseline with user additions/overrides
  const merged: LLMRegistryMap = { ...STATIC_PROVIDERS };

  for (const [providerId, provider] of Object.entries(existing)) {
    if (!merged[providerId]) {
      merged[providerId] = provider;
    } else {
      merged[providerId] = {
        ...merged[providerId],
        ...provider,
        envKeyNames: Array.from(new Set([...merged[providerId].envKeyNames, ...(provider.envKeyNames || [])])),
        models: {
          ...merged[providerId].models,
          ...provider.models,
        },
      };
    }
  }

  return merged;
}

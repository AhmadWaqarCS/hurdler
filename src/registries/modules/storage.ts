import fs from 'node:fs/promises';
import path from 'node:path';
import { devDebug, devError, devInfo } from '../../core/dev-mode/dev-mode.js';
import { PersistedModuleRegistrySchema } from './schema.js';
import { STATIC_MODULES, STATIC_MODULE_BUNDLES } from './static-modules.js';
import { ModuleStorageError } from './errors.js';
import type {
  ModuleDefinition,
  ModuleBundle,
  PersistedModuleRegistry,
  ModuleRegistryMap,
  ModuleBundleMap,
} from './types.js';

export const DEFAULT_MODULES_REGISTRY_PATH = '.hurdler/registries/modules.json';

/**
 * Resolves the absolute file path to the modules JSON registry.
 *
 * @param customPath - Optional custom relative or absolute path.
 * @param projectRoot - Base directory (defaults to process.cwd()).
 * @returns Fully-resolved absolute path.
 *
 * @example
 * ```typescript
 * const path = resolveModuleRegistryPath();
 * // '/home/user/project/.hurdler/registries/modules.json'
 * ```
 */
export function resolveModuleRegistryPath(
  customPath?: string,
  projectRoot = process.cwd()
): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? path.normalize(customPath) : path.resolve(projectRoot, customPath);
  }
  return path.resolve(projectRoot, DEFAULT_MODULES_REGISTRY_PATH);
}

/**
 * Checks whether the persisted modules registry JSON file exists on disk.
 *
 * @param customPath - Optional custom path override.
 * @param projectRoot - Optional project root directory.
 * @returns Promise resolving to true if file exists and is accessible.
 *
 * @example
 * ```typescript
 * const exists = await isModuleRegistryFilePresent();
 * ```
 */
export async function isModuleRegistryFilePresent(
  customPath?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const filePath = resolveModuleRegistryPath(customPath, projectRoot);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists module definitions and bundles to disk in `.hurdler/registries/modules.json`.
 * Writes atomically via temporary file replacement.
 *
 * @param modules - Map or array of ModuleDefinition items.
 * @param bundles - Optional map or array of ModuleBundle items.
 * @param options - Optional path overrides.
 * @throws ModuleStorageError if writing or validation fails.
 *
 * @example
 * ```typescript
 * await saveModuleRegistryToDisk(modules, bundles);
 * ```
 */
export async function saveModuleRegistryToDisk(
  modules: Record<string, ModuleDefinition> | ModuleDefinition[],
  bundles?: Record<string, ModuleBundle> | ModuleBundle[],
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const filePath = resolveModuleRegistryPath(options?.targetPath, options?.projectRoot);
  const dir = path.dirname(filePath);

  const modulesMap: ModuleRegistryMap = {};
  if (Array.isArray(modules)) {
    for (const m of modules) {
      modulesMap[m.name.toLowerCase().trim()] = m;
    }
  } else {
    for (const [k, v] of Object.entries(modules)) {
      modulesMap[k.toLowerCase().trim()] = v;
    }
  }

  const bundlesMap: ModuleBundleMap = {};
  if (bundles) {
    if (Array.isArray(bundles)) {
      for (const b of bundles) {
        bundlesMap[b.id.toLowerCase().trim()] = b;
      }
    } else {
      for (const [k, v] of Object.entries(bundles)) {
        bundlesMap[k.toLowerCase().trim()] = v;
      }
    }
  }

  try {
    const rawData = {
      modules: modulesMap,
      bundles: bundlesMap,
    };

    // Validate entire structure before saving
    const validated = PersistedModuleRegistrySchema.parse(rawData);

    await fs.mkdir(dir, { recursive: true });
    const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    await fs.writeFile(tempFilePath, JSON.stringify(validated, null, 2), 'utf8');
    await fs.rename(tempFilePath, filePath);

    devInfo(
      'MODULE_STORAGE',
      `Saved modules registry with ${Object.keys(validated.modules).length} module(s) and ${Object.keys(validated.bundles).length} bundle(s) to '${filePath}'`
    );
  } catch (err: any) {
    devError('MODULE_STORAGE', `Failed to save modules registry to '${filePath}': ${err.message}`, err);
    throw new ModuleStorageError(filePath, 'write', err.message, err);
  }
}

/**
 * Loads and validates the persisted modules registry from disk.
 * Returns null if the file does not exist.
 *
 * @param options - Optional path overrides.
 * @returns Validated persisted module registry, or null if file not found.
 * @throws ModuleStorageError if reading or validation fails.
 *
 * @example
 * ```typescript
 * const registry = await loadModuleRegistryFromDisk();
 * ```
 */
export async function loadModuleRegistryFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<PersistedModuleRegistry | null> {
  const filePath = resolveModuleRegistryPath(options?.targetPath, options?.projectRoot);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = PersistedModuleRegistrySchema.parse(parsed);

    devDebug(
      'MODULE_STORAGE',
      `Loaded modules registry from '${filePath}' with ${Object.keys(validated.modules).length} module(s) and ${Object.keys(validated.bundles).length} bundle(s)`
    );
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    devError('MODULE_STORAGE', `Failed to load modules registry from '${filePath}': ${err.message}`, err);
    throw new ModuleStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Synchronizes in-memory module registry with disk.
 * If `.hurdler/registries/modules.json` exists, loads and merges user-configured modules & bundles
 * on top of baseline STATIC_MODULES and STATIC_MODULE_BUNDLES.
 * If the file does NOT exist, initializes `.hurdler/registries/modules.json` with baseline static modules and bundles.
 *
 * @param options - Optional path overrides.
 * @returns Merged PersistedModuleRegistry.
 *
 * @example
 * ```typescript
 * const merged = await syncModuleRegistryWithDisk();
 * ```
 */
export async function syncModuleRegistryWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<PersistedModuleRegistry> {
  const existing = await loadModuleRegistryFromDisk(options);

  if (!existing) {
    // Seed initial registry file with baseline modules and bundles
    devInfo(
      'MODULE_STORAGE',
      `Initializing baseline modules registry file at '${resolveModuleRegistryPath(options?.targetPath, options?.projectRoot)}'`
    );
    await saveModuleRegistryToDisk(STATIC_MODULES, STATIC_MODULE_BUNDLES, options);
    return {
      modules: { ...STATIC_MODULES },
      bundles: { ...STATIC_MODULE_BUNDLES },
    };
  }

  // Merge static baseline with user additions/overrides
  const mergedModules: ModuleRegistryMap = { ...STATIC_MODULES };
  for (const [name, mod] of Object.entries(existing.modules)) {
    mergedModules[name.toLowerCase().trim()] = mod;
  }

  const mergedBundles: ModuleBundleMap = { ...STATIC_MODULE_BUNDLES };
  for (const [id, bundle] of Object.entries(existing.bundles)) {
    mergedBundles[id.toLowerCase().trim()] = bundle;
  }

  return {
    modules: mergedModules,
    bundles: mergedBundles,
  };
}

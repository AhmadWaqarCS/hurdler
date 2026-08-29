import fs from 'node:fs/promises';
import path from 'node:path';
import { devDebug, devError, devInfo } from '../../core/dev-mode/dev-mode.js';
import { ToolStorageError } from './errors.js';
import { ToolRegistryMapSchema } from './schema.js';
import { STATIC_TOOLS } from './native/index.js';
import type { NativeToolDefinition, SerializedToolMetadata, ToolRegistryMap } from './types.js';

export const DEFAULT_TOOL_REGISTRY_PATH = '.hurdler/registries/tools.json';

/**
 * Resolves the absolute path to the Tool registry JSON file.
 *
 * @param customPath - Optional custom relative or absolute path.
 * @param projectRoot - Base directory (defaults to process.cwd()).
 * @returns Absolute path to registry JSON file.
 */
export function resolveToolRegistryPath(customPath?: string, projectRoot = process.cwd()): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(projectRoot, customPath);
  }
  return path.resolve(projectRoot, DEFAULT_TOOL_REGISTRY_PATH);
}

/**
 * Checks whether the persisted Tool registry file exists on disk.
 *
 * @param customPath - Optional custom path.
 * @param projectRoot - Optional project root.
 * @returns Promise resolving to true if file exists and is accessible.
 */
export async function isToolRegistryFilePresent(
  customPath?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const filePath = resolveToolRegistryPath(customPath, projectRoot);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serializes a NativeToolDefinition or SerializedToolMetadata into a clean SerializedToolMetadata record.
 */
export function serializeToolMetadata(tool: NativeToolDefinition | SerializedToolMetadata): SerializedToolMetadata {
  return {
    name: tool.name,
    description: tool.description,
    category: tool.category,
    enabled: 'enabled' in tool && tool.enabled !== undefined ? Boolean(tool.enabled) : true,
    readOnly: tool.readOnly ?? false,
    isDangerous: tool.isDangerous ?? false,
    tags: tool.tags ?? [],
    version: tool.version,
    metadata: tool.metadata,
  };
}

/**
 * Converts STATIC_TOOLS into a baseline ToolRegistryMap.
 */
export function getBaselineToolRegistryMap(): ToolRegistryMap {
  const map: ToolRegistryMap = {};
  for (const [name, tool] of Object.entries(STATIC_TOOLS)) {
    map[name] = serializeToolMetadata(tool);
  }
  return map;
}

/**
 * Persists tool registry records to disk in `.hurdler/registries/tools.json`.
 *
 * @param tools - Map or array of NativeToolDefinition or SerializedToolMetadata items to save.
 * @param options - Optional path overrides.
 */
export async function saveToolRegistryToDisk(
  tools: Record<string, NativeToolDefinition | SerializedToolMetadata> | (NativeToolDefinition | SerializedToolMetadata)[],
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const filePath = resolveToolRegistryPath(options?.targetPath, options?.projectRoot);
  const dir = path.dirname(filePath);

  const toolMap: ToolRegistryMap = {};
  if (Array.isArray(tools)) {
    for (const t of tools) {
      toolMap[t.name] = serializeToolMetadata(t);
    }
  } else {
    for (const [name, t] of Object.entries(tools)) {
      toolMap[name] = serializeToolMetadata(t);
    }
  }

  try {
    const validated = ToolRegistryMapSchema.parse(toolMap);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf8');

    devInfo('TOOL_STORAGE', `Saved tool registry with ${Object.keys(validated).length} tool(s) to '${filePath}'`);
  } catch (err: any) {
    devError('TOOL_STORAGE', `Failed to save tool registry to '${filePath}': ${err.message}`, err);
    throw new ToolStorageError(filePath, 'write', err.message, err);
  }
}

/**
 * Loads and validates the persisted tool registry from `.hurdler/registries/tools.json`.
 * Returns null if the file does not exist.
 *
 * @param options - Optional path overrides.
 * @returns Validated tool map, or null if file not found.
 */
export async function loadToolRegistryFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<ToolRegistryMap | null> {
  const filePath = resolveToolRegistryPath(options?.targetPath, options?.projectRoot);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = ToolRegistryMapSchema.parse(parsed);

    devDebug('TOOL_STORAGE', `Loaded tool registry from '${filePath}' with ${Object.keys(validated).length} tool(s)`);
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    devError('TOOL_STORAGE', `Failed to load tool registry from '${filePath}': ${err.message}`, err);
    throw new ToolStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Synchronizes in-memory registry with disk.
 * If `.hurdler/registries/tools.json` exists, loads and merges user-configured metadata/tools
 * on top of baseline STATIC_TOOLS.
 * If the file does NOT exist, initializes `.hurdler/registries/tools.json` with baseline STATIC_TOOLS.
 *
 * @param options - Optional path overrides.
 * @returns Merged tool metadata map.
 */
export async function syncToolRegistryWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<ToolRegistryMap> {
  const existing = await loadToolRegistryFromDisk(options);
  const baseline = getBaselineToolRegistryMap();

  if (!existing) {
    devInfo('TOOL_STORAGE', `Initializing baseline tool registry file at '${resolveToolRegistryPath(options?.targetPath, options?.projectRoot)}'`);
    await saveToolRegistryToDisk(baseline, options);
    return { ...baseline };
  }

  // Merge static baseline with user additions/overrides
  const merged: ToolRegistryMap = { ...baseline };

  for (const [toolName, toolMeta] of Object.entries(existing)) {
    if (!merged[toolName]) {
      merged[toolName] = toolMeta;
    } else {
      merged[toolName] = {
        ...merged[toolName],
        ...toolMeta,
        tags: Array.from(new Set([...(merged[toolName].tags || []), ...(toolMeta.tags || [])])),
        metadata: {
          ...merged[toolName].metadata,
          ...toolMeta.metadata,
        },
      };
    }
  }

  return merged;
}

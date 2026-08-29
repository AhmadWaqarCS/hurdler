import fs from 'node:fs/promises';
import path from 'node:path';
import { devDebug, devError, devInfo } from '../../core/dev-mode/index.js';
import { AgentRegistryMapSchema } from './schema.js';
import { STATIC_AGENTS } from './static-agents.js';
import { AgentStorageError } from './errors.js';
import type { AgentDefinition, AgentRegistryMap } from './types.js';

export const DEFAULT_AGENTS_REGISTRY_PATH = '.hurdler/registries/agents.json';

/**
 * Resolves the absolute file path to the agents JSON registry.
 *
 * @param customPath - Optional custom relative or absolute path.
 * @param projectRoot - Project root directory (defaults to process.cwd()).
 * @returns Fully-resolved absolute path.
 */
export function resolveAgentRegistryPath(
  customPath?: string,
  projectRoot = process.cwd()
): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(projectRoot, customPath);
  }
  return path.resolve(projectRoot, DEFAULT_AGENTS_REGISTRY_PATH);
}

/**
 * Checks whether the persisted agents registry JSON file exists on disk.
 *
 * @param customPath - Optional custom path override.
 * @param projectRoot - Optional project root directory.
 * @returns Promise resolving to true if file exists and is accessible.
 */
export async function isAgentRegistryFilePresent(
  customPath?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const filePath = resolveAgentRegistryPath(customPath, projectRoot);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists an agent registry map or array to disk at `.hurdler/registries/agents.json`.
 *
 * @param agents - Map or array of AgentDefinition items to save.
 * @param options - Optional target path and project root overrides.
 */
export async function saveAgentRegistryToDisk(
  agents: Record<string, AgentDefinition> | AgentDefinition[],
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const filePath = resolveAgentRegistryPath(options?.targetPath, options?.projectRoot);
  const dir = path.dirname(filePath);

  const agentMap: Record<string, AgentDefinition> = {};
  if (Array.isArray(agents)) {
    for (const a of agents) {
      agentMap[a.id] = a;
    }
  } else {
    Object.assign(agentMap, agents);
  }

  try {
    // Validate entire structure before saving
    const validated = AgentRegistryMapSchema.parse(agentMap);

    await fs.mkdir(dir, { recursive: true });
    const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    await fs.writeFile(tempFilePath, JSON.stringify(validated, null, 2), 'utf8');
    await fs.rename(tempFilePath, filePath);

    devInfo(
      'AGENT_STORAGE',
      `Saved agents registry with ${Object.keys(validated).length} agent(s) to '${filePath}'`
    );
  } catch (err: any) {
    devError('AGENT_STORAGE', `Failed to save agents registry to '${filePath}': ${err.message}`, err);
    throw new AgentStorageError(filePath, 'write', err.message, err);
  }
}

/**
 * Loads and validates the persisted agents registry from disk.
 * Returns null if the file does not exist.
 *
 * @param options - Optional target path and project root overrides.
 * @returns Validated agent map, or null if file not found.
 */
export async function loadAgentRegistryFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<AgentRegistryMap | null> {
  const filePath = resolveAgentRegistryPath(options?.targetPath, options?.projectRoot);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw || raw.trim().length === 0) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const validated = AgentRegistryMapSchema.parse(parsed);

    devDebug(
      'AGENT_STORAGE',
      `Loaded agents registry from '${filePath}' with ${Object.keys(validated).length} agent(s)`
    );
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    devError('AGENT_STORAGE', `Failed to load agents registry from '${filePath}': ${err.message}`, err);
    throw new AgentStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Synchronizes in-memory agent records with disk.
 * If `.hurdler/registries/agents.json` exists, loads and merges user-configured agents
 * on top of baseline STATIC_AGENTS.
 * If the file does NOT exist, initializes `.hurdler/registries/agents.json` with baseline STATIC_AGENTS.
 *
 * @param options - Optional path overrides.
 * @returns Merged agent map.
 */
export async function syncAgentRegistryWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<AgentRegistryMap> {
  const existing = await loadAgentRegistryFromDisk(options);

  if (!existing) {
    // Seed initial registry file with baseline static agents
    devInfo(
      'AGENT_STORAGE',
      `Initializing baseline agents registry file at '${resolveAgentRegistryPath(options?.targetPath, options?.projectRoot)}'`
    );
    await saveAgentRegistryToDisk(STATIC_AGENTS, options);
    return { ...STATIC_AGENTS };
  }

  // Merge static baseline with user additions/overrides
  const merged: AgentRegistryMap = { ...STATIC_AGENTS };

  for (const [agentId, agent] of Object.entries(existing)) {
    if (!merged[agentId]) {
      merged[agentId] = agent;
    } else {
      merged[agentId] = {
        ...merged[agentId],
        ...agent,
        allowedTools: Array.from(new Set([...(merged[agentId].allowedTools ?? []), ...(agent.allowedTools ?? [])])),
        disallowedTools: Array.from(new Set([...(merged[agentId].disallowedTools ?? []), ...(agent.disallowedTools ?? [])])),
        capabilities: Array.from(new Set([...(merged[agentId].capabilities ?? []), ...(agent.capabilities ?? [])])),
        defaultPrompts: Array.from(new Set([...(merged[agentId].defaultPrompts ?? []), ...(agent.defaultPrompts ?? [])])),
        tags: Array.from(new Set([...(merged[agentId].tags ?? []), ...(agent.tags ?? [])])),
      };
    }
  }

  return merged;
}

/**
 * Persists a single agent to disk, updating or inserting it into `.hurdler/registries/agents.json`.
 *
 * @param agent - Agent definition to persist.
 * @param options - Optional target path and project root overrides.
 */
export async function saveAgentToDisk(
  agent: AgentDefinition,
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const current = (await loadAgentRegistryFromDisk(options)) ?? { ...STATIC_AGENTS };
  current[agent.id] = agent;
  await saveAgentRegistryToDisk(current, options);
}

/**
 * Removes a single agent from `.hurdler/registries/agents.json` on disk.
 *
 * @param agentId - Unique ID of agent to remove.
 * @param options - Optional target path and project root overrides.
 * @returns True if agent was removed from disk, false if not found.
 */
export async function deleteAgentFromDisk(
  agentId: string,
  options?: { targetPath?: string; projectRoot?: string }
): Promise<boolean> {
  const current = await loadAgentRegistryFromDisk(options);
  if (!current || !(agentId in current)) {
    return false;
  }

  delete current[agentId];
  await saveAgentRegistryToDisk(current, options);
  return true;
}

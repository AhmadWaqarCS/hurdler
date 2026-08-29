import fs from 'node:fs/promises';
import path from 'node:path';
import { devDebug, devError, devInfo } from '../../core/dev-mode/index.js';
import { WorkflowRegistryMapSchema } from './schema.js';
import { STATIC_WORKFLOWS } from './static-workflows.js';
import { WorkflowStorageError } from './errors.js';
import type { WorkflowDefinition, WorkflowRegistryMap } from './types.js';

export const DEFAULT_WORKFLOWS_REGISTRY_PATH = '.hurdler/registries/workflows.json';

/**
 * Resolves the absolute file path to the workflows JSON registry.
 *
 * @param customPath - Optional custom relative or absolute path.
 * @param projectRoot - Project root directory (defaults to process.cwd()).
 * @returns Fully-resolved absolute path.
 */
export function resolveWorkflowRegistryPath(
  customPath?: string,
  projectRoot = process.cwd()
): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(projectRoot, customPath);
  }
  return path.resolve(projectRoot, DEFAULT_WORKFLOWS_REGISTRY_PATH);
}

/**
 * Checks whether the persisted workflows registry JSON file exists on disk.
 *
 * @param customPath - Optional custom path override.
 * @param projectRoot - Optional project root directory.
 * @returns Promise resolving to true if file exists and is accessible.
 */
export async function isWorkflowRegistryFilePresent(
  customPath?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const filePath = resolveWorkflowRegistryPath(customPath, projectRoot);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists a workflow registry map or array to disk at `.hurdler/registries/workflows.json`.
 *
 * @param workflows - Map or array of WorkflowDefinition items to save.
 * @param options - Optional target path and project root overrides.
 */
export async function saveWorkflowRegistryToDisk(
  workflows: Record<string, WorkflowDefinition> | WorkflowDefinition[],
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const filePath = resolveWorkflowRegistryPath(options?.targetPath, options?.projectRoot);
  const dir = path.dirname(filePath);

  const workflowMap: Record<string, WorkflowDefinition> = {};
  if (Array.isArray(workflows)) {
    for (const w of workflows) {
      workflowMap[w.id] = w;
    }
  } else {
    Object.assign(workflowMap, workflows);
  }

  try {
    // Validate entire structure before saving
    const validated = WorkflowRegistryMapSchema.parse(workflowMap);

    await fs.mkdir(dir, { recursive: true });
    const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    await fs.writeFile(tempFilePath, JSON.stringify(validated, null, 2), 'utf8');
    await fs.rename(tempFilePath, filePath);

    devInfo(
      'WORKFLOW_STORAGE',
      `Saved workflows registry with ${Object.keys(validated).length} workflow(s) to '${filePath}'`
    );
  } catch (err: any) {
    devError('WORKFLOW_STORAGE', `Failed to save workflows registry to '${filePath}': ${err.message}`, err);
    throw new WorkflowStorageError(filePath, 'write', err.message, err);
  }
}

/**
 * Loads and validates the persisted workflows registry from disk.
 * Returns null if the file does not exist.
 *
 * @param options - Optional target path and project root overrides.
 * @returns Validated workflow map, or null if file not found.
 */
export async function loadWorkflowRegistryFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<WorkflowRegistryMap | null> {
  const filePath = resolveWorkflowRegistryPath(options?.targetPath, options?.projectRoot);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw || raw.trim().length === 0) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const validated = WorkflowRegistryMapSchema.parse(parsed);

    devDebug(
      'WORKFLOW_STORAGE',
      `Loaded workflows registry from '${filePath}' with ${Object.keys(validated).length} workflow(s)`
    );
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    devError('WORKFLOW_STORAGE', `Failed to load workflows registry from '${filePath}': ${err.message}`, err);
    throw new WorkflowStorageError(filePath, 'read', err.message, err);
  }
}

/**
 * Synchronizes in-memory workflow records with disk.
 * If `.hurdler/registries/workflows.json` exists, loads and merges user-configured workflows
 * on top of baseline STATIC_WORKFLOWS.
 * If the file does NOT exist, initializes `.hurdler/registries/workflows.json` with baseline STATIC_WORKFLOWS.
 *
 * @param options - Optional path overrides.
 * @returns Merged workflow map.
 */
export async function syncWorkflowRegistryWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<WorkflowRegistryMap> {
  const existing = await loadWorkflowRegistryFromDisk(options);

  if (!existing) {
    // Seed initial registry file with baseline static workflows
    devInfo(
      'WORKFLOW_STORAGE',
      `Initializing baseline workflows registry file at '${resolveWorkflowRegistryPath(options?.targetPath, options?.projectRoot)}'`
    );
    await saveWorkflowRegistryToDisk(STATIC_WORKFLOWS, options);
    return { ...STATIC_WORKFLOWS };
  }

  // Merge static baseline with user additions/overrides
  const merged: WorkflowRegistryMap = { ...STATIC_WORKFLOWS };

  for (const [workflowId, workflow] of Object.entries(existing)) {
    if (!merged[workflowId]) {
      merged[workflowId] = workflow;
    } else {
      merged[workflowId] = {
        ...merged[workflowId],
        ...workflow,
        steps: workflow.steps ?? merged[workflowId].steps,
        defaultPrompts: Array.from(new Set([...(merged[workflowId].defaultPrompts ?? []), ...(workflow.defaultPrompts ?? [])])),
        tags: Array.from(new Set([...(merged[workflowId].tags ?? []), ...(workflow.tags ?? [])])),
      };
    }
  }

  return merged;
}

/**
 * Persists a single workflow to disk, updating or inserting it into `.hurdler/registries/workflows.json`.
 *
 * @param workflow - Workflow definition to persist.
 * @param options - Optional target path and project root overrides.
 */
export async function saveWorkflowToDisk(
  workflow: WorkflowDefinition,
  options?: { targetPath?: string; projectRoot?: string }
): Promise<void> {
  const current = (await loadWorkflowRegistryFromDisk(options)) ?? { ...STATIC_WORKFLOWS };
  current[workflow.id] = workflow;
  await saveWorkflowRegistryToDisk(current, options);
}

/**
 * Removes a single workflow from `.hurdler/registries/workflows.json` on disk.
 *
 * @param workflowId - Unique ID of workflow to remove.
 * @param options - Optional target path and project root overrides.
 * @returns True if workflow was removed from disk, false if not found.
 */
export async function deleteWorkflowFromDisk(
  workflowId: string,
  options?: { targetPath?: string; projectRoot?: string }
): Promise<boolean> {
  const current = await loadWorkflowRegistryFromDisk(options);
  if (!current || !(workflowId in current)) {
    return false;
  }

  delete current[workflowId];
  await saveWorkflowRegistryToDisk(current, options);
  return true;
}

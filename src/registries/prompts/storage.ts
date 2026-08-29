import fs from 'fs';
import path from 'path';
import { PromptDefinitionSchema } from './schema.js';
import { PromptStorageError, PromptValidationError } from './errors.js';
import { STATIC_PROMPTS } from './static-prompts.js';
import { devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import type { PromptDefinition, PromptStorageOptions } from './types.js';

/** Default file path relative to current working directory */
export const DEFAULT_PROMPTS_REGISTRY_PATH = path.join('.hurdler', 'registries', 'prompts.json');

/**
 * Resolves the absolute path to the prompts registry JSON file on disk.
 *
 * @param customPath Optional custom file path override
 * @returns Absolute path to the prompts registry file
 */
export function getPromptRegistryFilePath(customPath?: string): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
  }
  return path.resolve(process.cwd(), DEFAULT_PROMPTS_REGISTRY_PATH);
}

/**
 * Checks if the prompts registry JSON file exists on disk.
 *
 * @param customPath Optional custom file path override
 * @returns True if the file exists, false otherwise
 */
export function isPromptRegistryFilePresent(customPath?: string): boolean {
  const filePath = getPromptRegistryFilePath(customPath);
  return fs.existsSync(filePath);
}

/**
 * Saves an array or map of prompt definitions to disk as structured JSON.
 *
 * @param prompts Array or dictionary of prompt definitions to persist
 * @param options Storage configuration options (customPath, pretty)
 * @returns The absolute file path written to
 * @throws {PromptStorageError} If the file cannot be created or written
 */
export function savePromptRegistryToDisk(
  prompts: PromptDefinition[] | Record<string, PromptDefinition>,
  options: PromptStorageOptions = {}
): string {
  const filePath = getPromptRegistryFilePath(options.customPath);
  const dir = path.dirname(filePath);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const list = Array.isArray(prompts) ? prompts : Object.values(prompts);
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    // Validate each definition before writing
    for (const prompt of sorted) {
      const parsed = PromptDefinitionSchema.safeParse(prompt);
      if (!parsed.success) {
        throw new PromptValidationError(prompt.id ?? 'unknown', parsed.error.issues);
      }
    }

    const indent = options.pretty !== false ? 2 : 0;
    const jsonContent = JSON.stringify(sorted, null, indent);

    fs.writeFileSync(filePath, jsonContent, 'utf-8');
    devInfo('PROMPT_STORAGE', `Saved ${sorted.length} prompt(s) to ${filePath}`);
    return filePath;
  } catch (error) {
    if (error instanceof PromptValidationError) {
      throw error;
    }
    throw new PromptStorageError('write', filePath, error);
  }
}

/**
 * Loads prompt definitions from the disk JSON file.
 *
 * @param options Storage configuration options
 * @returns Array of validated PromptDefinition objects
 * @throws {PromptStorageError} If the file cannot be read or contains invalid JSON/prompts
 */
export function loadPromptRegistryFromDisk(options: PromptStorageOptions = {}): PromptDefinition[] {
  const filePath = getPromptRegistryFilePath(options.customPath);

  if (!fs.existsSync(filePath)) {
    throw new PromptStorageError('read', filePath, new Error(`File does not exist: ${filePath}`));
  }

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawContent);

    const items: unknown[] = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null
        ? Object.values(parsed)
        : [];

    const validatedPrompts: PromptDefinition[] = [];
    for (const item of items) {
      const result = PromptDefinitionSchema.safeParse(item);
      if (!result.success) {
        const id = (item as { id?: string })?.id ?? 'unknown';
        throw new PromptValidationError(id, result.error.issues);
      }
      validatedPrompts.push(result.data);
    }

    devInfo('PROMPT_STORAGE', `Loaded ${validatedPrompts.length} prompt(s) from ${filePath}`);
    return validatedPrompts;
  } catch (error) {
    if (error instanceof PromptValidationError) {
      throw error;
    }
    throw new PromptStorageError('read', filePath, error);
  }
}

/**
 * Synchronizes the prompts registry with disk:
 * 1. If the disk file does not exist, seeds it with default baseline static prompts and in-memory additions.
 * 2. If the disk file exists, merges baseline static prompts with disk entries (disk entries override static baseline).
 * 3. Saves the consolidated list back to disk and returns it.
 *
 * @param inMemoryPrompts Optional currently active prompt definitions to merge
 * @param options Storage configuration options
 * @returns The consolidated and synchronized array of prompt definitions
 */
export function syncPromptRegistryWithDisk(
  inMemoryPrompts?: PromptDefinition[],
  options: PromptStorageOptions = {}
): PromptDefinition[] {
  const filePath = getPromptRegistryFilePath(options.customPath);
  const promptMap = new Map<string, PromptDefinition>();

  // 1. Seed baseline static prompts
  for (const staticPrompt of Object.values(STATIC_PROMPTS)) {
    promptMap.set(staticPrompt.id, { ...staticPrompt });
  }

  // 2. Load and overlay disk prompts if present
  if (fs.existsSync(filePath)) {
    try {
      const diskPrompts = loadPromptRegistryFromDisk(options);
      for (const diskPrompt of diskPrompts) {
        promptMap.set(diskPrompt.id, diskPrompt);
      }
    } catch (err) {
      devWarn('PROMPT_STORAGE', `Failed to load existing prompts from disk (${filePath}). Re-seeding with baseline.`);
    }
  }

  // 3. Overlay any explicit in-memory prompts provided
  if (inMemoryPrompts && inMemoryPrompts.length > 0) {
    for (const p of inMemoryPrompts) {
      promptMap.set(p.id, p);
    }
  }

  const merged = Array.from(promptMap.values()).sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
  );

  // 4. Save consolidated state to disk
  savePromptRegistryToDisk(merged, options);
  return merged;
}

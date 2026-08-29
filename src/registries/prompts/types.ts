import type { z } from 'zod';
import type {
  PromptCategorySchema,
  PromptDefinitionSchema,
  PromptCompositionOptionsSchema,
  PromptRenderOptionsSchema,
} from './schema.js';

export type PromptCategory = z.infer<typeof PromptCategorySchema>;
export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;
export type PromptCompositionOptions = z.infer<typeof PromptCompositionOptionsSchema>;
export type PromptRenderOptions = z.infer<typeof PromptRenderOptionsSchema>;

/**
 * Result of composing one or more prompts for a workflow or LLM invocation.
 */
export interface ComposedPromptResult {
  /** Full concatenated system instructions prompt */
  system: string;
  /** Cacheable portion of the prompt (static prefix for LLMs supporting prompt caching) */
  cachedPrompt?: string;
  /** Dynamic user / workflow task prompt content (if provided) */
  prompt?: string;
  /** List of all resolved prompt definitions included in this composition */
  promptsUsed: PromptDefinition[];
  /** Variables successfully substituted into the prompts */
  variableSubstitutions: Record<string, string | number | boolean>;
  /** Total character count of the combined prompt */
  totalCharacters: number;
  /** Estimated token count (~4 characters per token heuristic) */
  estimatedTokens: number;
}

/**
 * Statistics and metrics from the in-memory prompt cache.
 */
export interface PromptCacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of cache evictions or invalidations */
  invalidations: number;
  /** Current number of cached entries */
  size: number;
}

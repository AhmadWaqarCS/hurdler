import { z } from 'zod';

export const PromptCategorySchema = z.union([
  z.enum(['global', 'system', 'agent', 'workflow', 'custom']),
  z.string().min(1, 'Custom category must be a non-empty string'),
]);

export const PromptDefinitionSchema = z.object({
  /** Unique identifier for the prompt (e.g. 'global:kiss', 'system:business-logic') */
  id: z.string().min(1, 'Prompt ID must not be empty'),
  /** Human-readable title or name (multiple prompts can share the same title or category) */
  title: z.string().min(1, 'Prompt title must not be empty'),
  /** Functional category or classification */
  category: PromptCategorySchema.default('system'),
  /** Raw prompt template content with optional {{variable}} placeholders */
  content: z.string().min(1, 'Prompt content must not be empty'),
  /** Optional summary or description of the prompt's intent */
  description: z.string().optional(),
  /** Explicitly declared variable names required or accepted by this prompt template */
  variables: z.array(z.string()).default([]),
  /** Whether this prompt is static and eligible for LLM prompt caching (default: true) */
  cacheable: z.boolean().default(true),
  /** Priority ordering when composing multiple prompts (lower number = higher priority) */
  priority: z.number().int().default(0),
  /** Searchable tags or labels for workflow filtering */
  tags: z.array(z.string()).default([]),
  /** Semantic version string or revision number */
  version: z.union([z.string(), z.number()]).optional(),
  /** Arbitrary metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** ISO timestamp of creation */
  createdAt: z.string().optional(),
  /** ISO timestamp of last update */
  updatedAt: z.string().optional(),
});

export const PromptRenderOptionsSchema = z.object({
  /** Context variables to interpolate into {{variable}} placeholders */
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  /** If true, throws PromptRenderError when an undeclared/unsupplied variable has no default */
  strict: z.boolean().default(false),
});

export const PromptCompositionOptionsSchema = z.object({
  /** Array of prompt IDs to retrieve and compose */
  promptIds: z.array(z.string()).optional(),
  /** Include all prompts belonging to these categories */
  categories: z.array(z.string()).optional(),
  /** Include all prompts matching these titles */
  titles: z.array(z.string()).optional(),
  /** Include all prompts that match these tags */
  tags: z.array(z.string()).optional(),
  /** Ad-hoc inline prompt strings or partial prompt definitions */
  inlinePrompts: z.array(z.union([z.string(), PromptDefinitionSchema.partial()])).optional(),
  /** Variable substitutions applied to all included prompts */
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  /** Optional dynamic user task prompt content */
  userPrompt: z.string().optional(),
  /** Delimiter string used when concatenating prompts (default: '\n\n---\n\n') */
  separator: z.string().default('\n\n---\n\n'),
  /** When true, cleanly separates static cacheable prompts into `cachedPrompt` and dynamic ones into `system` */
  separateCached: z.boolean().default(true),
  /** Whether to utilize in-memory composition caching for faster repeats */
  useCache: z.boolean().default(true),
});

/** Schema for updating an existing prompt definition */
export const PromptUpdateSchema = z.object({
  /** Human-readable title or name */
  title: z.string().min(1, 'Prompt title must not be empty').optional(),
  /** Functional category or classification */
  category: PromptCategorySchema.optional(),
  /** Raw prompt template content with optional {{variable}} placeholders */
  content: z.string().min(1, 'Prompt content must not be empty').optional(),
  /** Optional summary or description of the prompt's intent */
  description: z.string().optional(),
  /** Explicitly declared variable names required or accepted by this prompt template */
  variables: z.array(z.string()).optional(),
  /** Whether this prompt is static and eligible for LLM prompt caching */
  cacheable: z.boolean().optional(),
  /** Priority ordering when composing multiple prompts (lower number = higher priority) */
  priority: z.number().int().optional(),
  /** Searchable tags or labels for workflow filtering */
  tags: z.array(z.string()).optional(),
  /** Semantic version string or revision number */
  version: z.union([z.string(), z.number()]).optional(),
  /** Arbitrary metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Schema for runtime configuration of the Prompts registry and engine */
export const PromptRegistryConfigSchema = z.object({
  /** Custom file path for disk storage (defaults to .hurdler/registries/prompts.json) */
  storagePath: z.string().optional(),
  /** Automatically synchronize in-memory registry changes to disk */
  autoSync: z.boolean().default(true),
  /** Default delimiter string used when concatenating prompts */
  defaultSeparator: z.string().default('\n\n---\n\n'),
  /** Default strict mode for template rendering */
  strictVariables: z.boolean().default(false),
  /** Whether prompt composition and template caching is enabled */
  cacheEnabled: z.boolean().default(true),
  /** Default cache TTL in milliseconds */
  cacheTtlMs: z.number().int().positive().optional(),
});


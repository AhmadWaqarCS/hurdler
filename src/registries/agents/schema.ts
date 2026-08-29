import { z } from 'zod';
import { GitAuthorSchema } from '../../git/schema.js';
import { ApiTierSchema, ThinkingEffortSchema } from '../llms/schema.js';

export const AgentCategorySchema = z.union([
  z.enum([
    'orchestrator',
    'architecture',
    'engineering',
    'design',
    'database',
    'qa',
    'security',
    'optimizer',
    'devops',
    'core',
    'custom',
  ]),
  z.string().min(1, 'Agent category must be a non-empty string'),
]);

export const AgentModelPreferenceSchema = z.object({
  /** Preferred target LLM provider (e.g. 'google', 'anthropic', 'google-vertex') */
  provider: z.string().optional(),
  /** Preferred model identifier (e.g. 'claude-sonnet-5', 'gemini-3.7-flash') */
  model: z.string().optional(),
  /** Preferred API Tier (e.g. 'priority', 'standard', 'flex') */
  tier: ApiTierSchema.optional(),
  /** Preferred thinking/reasoning effort ('low', 'medium', 'high', 'xhigh', 'max') */
  reasoningEffort: ThinkingEffortSchema.optional(),
  /** Maximum output tokens limit hint */
  maxTokens: z.number().positive().optional(),
  /** Sampling temperature hint (0.0 - 2.0) */
  temperature: z.number().min(0).max(2).optional(),
});

export const AgentDefinitionSchema = z.object({
  /** Unique identifier for the agent (e.g. 'orchestrator', 'business-logic', 'ui-designer') */
  id: z.string().min(1, 'Agent ID must not be empty'),
  /** Human-readable title or persona name */
  title: z.string().min(1, 'Agent title must not be empty'),
  /** Functional category or domain classification */
  category: AgentCategorySchema.default('engineering'),
  /** Concise summary of the agent's role and specialization */
  description: z.string().min(1, 'Agent description must not be empty'),
  /** Explicit persona definition and operational role */
  role: z.string().min(1, 'Agent role must not be empty'),
  /** Identity awareness prompt defining who and what the agent is, its mindset, and boundaries */
  identityPrompt: z.string().min(1, 'Agent identity prompt must not be empty'),
  /** Git author configuration for source control commits, PRs, and reviews */
  gitAuthor: GitAuthorSchema,
  /** Array of prompt IDs from PromptRegistryService automatically composed for this agent */
  defaultPrompts: z.array(z.string()).default([]),
  /** Optional specific system-level instructions */
  systemPrompt: z.string().optional(),
  /** Allowed tool names or '*' for unrestricted access */
  allowedTools: z.array(z.string()).default([]),
  /** Explicitly disallowed tool names */
  disallowedTools: z.array(z.string()).default([]),
  /** Capability tokens for workflow dispatch and filtering */
  capabilities: z.array(z.string()).default([]),
  /** Preferred LLM model configurations */
  preferredModel: AgentModelPreferenceSchema.optional(),
  /** Searchable tags or labels */
  tags: z.array(z.string()).default([]),
  /** Whether this agent is a built-in static default */
  isBuiltin: z.boolean().default(false),
  /** Whether this agent is currently active and selectable */
  active: z.boolean().default(true),
  /** Semantic version string or revision number */
  version: z.union([z.string(), z.number()]).optional(),
  /** Arbitrary metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** ISO timestamp of creation */
  createdAt: z.string().optional(),
  /** ISO timestamp of last update */
  updatedAt: z.string().optional(),
});

export const AgentQueryFilterSchema = z.object({
  /** Filter by exact single category */
  category: z.string().optional(),
  /** Filter by any matching category in list */
  categories: z.array(z.string()).optional(),
  /** Filter by single tag */
  tag: z.string().optional(),
  /** Filter by all or any tags */
  tags: z.array(z.string()).optional(),
  /** Filter by single capability token */
  capability: z.string().optional(),
  /** Filter by any matching capability in list */
  capabilities: z.array(z.string()).optional(),
  /** Only return active agents (default: false) */
  activeOnly: z.boolean().default(false),
  /** Case-insensitive keyword search in id, title, description, or role */
  search: z.string().optional(),
  /** Filter by builtin vs custom */
  isBuiltin: z.boolean().optional(),
});

export const AgentPromptCompositionOptionsSchema = z.object({
  /** Additional prompt IDs from PromptRegistryService to include */
  extraPrompts: z.array(z.string()).optional(),
  /** Ad-hoc custom inline instructions */
  extraInstructions: z.string().optional(),
  /** Variable substitutions for prompt templates */
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  /** Whether to inject Git author awareness section in system prompt (default: true) */
  includeGitAuthorAwareness: z.boolean().default(true),
  /** Whether to include the structured Identity Header (default: true) */
  includeIdentityHeader: z.boolean().default(true),
  /** Optional task user prompt */
  userPrompt: z.string().optional(),
  /** Section separator string (default: '\n\n---\n\n') */
  separator: z.string().default('\n\n---\n\n'),
});

export const AgentUpdateSchema = z.object({
  /** Human-readable title or persona name */
  title: z.string().min(1, 'Agent title must not be empty').optional(),
  /** Functional category or domain classification */
  category: AgentCategorySchema.optional(),
  /** Concise summary of the agent's role and specialization */
  description: z.string().min(1, 'Agent description must not be empty').optional(),
  /** Explicit persona definition and operational role */
  role: z.string().min(1, 'Agent role must not be empty').optional(),
  /** Identity awareness prompt defining who and what the agent is, its mindset, and boundaries */
  identityPrompt: z.string().min(1, 'Agent identity prompt must not be empty').optional(),
  /** Git author configuration for source control commits, PRs, and reviews */
  gitAuthor: GitAuthorSchema.optional(),
  /** Array of prompt IDs from PromptRegistryService automatically composed for this agent */
  defaultPrompts: z.array(z.string()).optional(),
  /** Optional specific system-level instructions */
  systemPrompt: z.string().optional(),
  /** Allowed tool names or '*' for unrestricted access */
  allowedTools: z.array(z.string()).optional(),
  /** Explicitly disallowed tool names */
  disallowedTools: z.array(z.string()).optional(),
  /** Capability tokens for workflow dispatch and filtering */
  capabilities: z.array(z.string()).optional(),
  /** Preferred LLM model configurations */
  preferredModel: AgentModelPreferenceSchema.optional(),
  /** Searchable tags or labels */
  tags: z.array(z.string()).optional(),
  /** Whether this agent is currently active and selectable */
  active: z.boolean().optional(),
  /** Semantic version string or revision number */
  version: z.union([z.string(), z.number()]).optional(),
  /** Arbitrary metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AgentRegistryMapSchema = z.record(z.string(), AgentDefinitionSchema);

export const AgentStorageOptionsSchema = z.object({
  /** Whether to write changes to disk (default: true) */
  persist: z.boolean().default(true),
  /** Custom target file path for agents JSON (relative or absolute) */
  targetPath: z.string().optional(),
  /** Project base directory (defaults to process.cwd()) */
  projectRoot: z.string().optional(),
  /** Force operation even if targeting a built-in agent (default: false) */
  force: z.boolean().default(false),
});

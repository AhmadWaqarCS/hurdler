import type { z } from 'zod';
import type { GitAuthor } from '../../git/types.js';
import type { ApiTier, ThinkingEffort } from '../llms/types.js';
import type {
  AgentCategorySchema,
  AgentModelPreferenceSchema,
  AgentDefinitionSchema,
  AgentQueryFilterSchema,
  AgentPromptCompositionOptionsSchema,
} from './schema.js';

export type AgentCategory = z.infer<typeof AgentCategorySchema>;
export type AgentModelPreference = z.infer<typeof AgentModelPreferenceSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AgentInput = z.input<typeof AgentDefinitionSchema>;
export type AgentQueryFilter = z.input<typeof AgentQueryFilterSchema>;
export type AgentPromptCompositionOptions = z.input<typeof AgentPromptCompositionOptionsSchema>;

/**
 * Known capability tokens for specialized agent filtering and dispatching.
 */
export type AgentCapability =
  | 'orchestration'
  | 'planning'
  | 'task:decompose'
  | 'git:commit'
  | 'git:branch'
  | 'git:merge'
  | 'git:pr'
  | 'file:read'
  | 'file:write'
  | 'file:edit'
  | 'file:delete'
  | 'directory:manage'
  | 'code:ast'
  | 'code:lint'
  | 'code:format'
  | 'test:author'
  | 'test:run'
  | 'debug:diagnose'
  | 'debug:patch'
  | 'security:audit'
  | 'security:sanitize'
  | 'db:schema'
  | 'db:migration'
  | 'ui:design'
  | 'ui:component'
  | (string & {});

/**
 * Fully compiled agent context ready for LLM invocation or workflow execution.
 */
export interface CompiledAgentContext {
  /** Target agent definition */
  agent: AgentDefinition;
  /** Complete synthesized system prompt (identity header + git authorship + resolved prompts + extra guidelines) */
  systemPrompt: string;
  /** Resolved Git author identity for git operations */
  gitAuthor: GitAuthor;
  /** Effective allowed tool IDs */
  allowedTools: string[];
  /** Effective disallowed tool IDs */
  disallowedTools: string[];
  /** Preferred model options if configured */
  preferredModel?: {
    provider?: string;
    model?: string;
    tier?: ApiTier;
    reasoningEffort?: ThinkingEffort;
  };
  /** Metadata and composition timestamp */
  compiledAt: string;
}

import type { GitAuthor } from './types.js';
import { GitAuthorSchema } from './schema.js';
import { GitValidationError } from './errors.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Standard predefined Git author identities for Hurdler default agents.
 */
export const DEFAULT_AGENT_AUTHORS: Record<string, GitAuthor> = {
  'orchestrator': {
    name: 'Hurdler [Orchestrator]',
    email: 'agent-orchestrator@hurdler.local',
  },
  'business-logic': {
    name: 'Hurdler [Business Logic]',
    email: 'agent-business-logic@hurdler.local',
  },
  'ui-designer': {
    name: 'Hurdler [UI Designer]',
    email: 'agent-ui-designer@hurdler.local',
  },
  'database-manager': {
    name: 'Hurdler [Database Manager]',
    email: 'agent-database-manager@hurdler.local',
  },
  'tester': {
    name: 'Hurdler [Tester]',
    email: 'agent-tester@hurdler.local',
  },
  'debugger': {
    name: 'Hurdler [Debugger]',
    email: 'agent-debugger@hurdler.local',
  },
  'security-reviewer': {
    name: 'Hurdler [Security Reviewer]',
    email: 'agent-security-reviewer@hurdler.local',
  },
  'system': {
    name: 'Hurdler [System]',
    email: 'system@hurdler.local',
  },
};

const customAgentAuthors = new Map<string, GitAuthor>();

/**
 * Normalizes an agent identifier for author lookup (e.g. 'agent:ui-designer' -> 'ui-designer').
 */
export function normalizeAgentId(agentId: string): string {
  return agentId.trim().toLowerCase().replace(/^(agent:|subagent:)/, '');
}

/**
 * Resolves the GitAuthor identity for an agent ID or returns the default orchestrator identity.
 */
export function getAgentAuthor(agentId?: string): GitAuthor {
  if (!agentId) {
    return { ...DEFAULT_AGENT_AUTHORS['orchestrator'] };
  }

  const normalized = normalizeAgentId(agentId);

  if (customAgentAuthors.has(normalized)) {
    return { ...customAgentAuthors.get(normalized)! };
  }

  if (normalized in DEFAULT_AGENT_AUTHORS) {
    return { ...DEFAULT_AGENT_AUTHORS[normalized] };
  }

  // Generate a fallback author from custom agent ID
  const humanizedName = normalized
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    name: `Hurdler [${humanizedName}]`,
    email: `agent-${normalized.replace(/[^a-z0-9]/g, '')}@hurdler.local`,
  };
}

/**
 * Formats a GitAuthor object into the standard Git author string (e.g. "Name <email>").
 */
export function formatAuthorArg(author: GitAuthor): string {
  return `${author.name} <${author.email}>`;
}

/**
 * Registers a custom agent author configuration.
 */
export function registerAgentAuthor(agentId: string, author: GitAuthor): void {
  const parseResult = GitAuthorSchema.safeParse(author);
  if (!parseResult.success) {
    throw new GitValidationError(
      `Invalid agent author configuration for '${agentId}': ${parseResult.error.issues.map((i) => i.message).join(', ')}`
    );
  }

  const normalized = normalizeAgentId(agentId);
  customAgentAuthors.set(normalized, { ...parseResult.data });
  devInfo('GIT_AUTHORS', `Registered custom Git author for agent '${normalized}': ${formatAuthorArg(parseResult.data)}`);
}

/**
 * Creates a validated GitAuthor object.
 */
export function createAgentAuthor(name: string, email?: string): GitAuthor {
  const safeEmail = email ?? `agent-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@hurdler.local`;
  const author: GitAuthor = { name, email: safeEmail };

  const parseResult = GitAuthorSchema.safeParse(author);
  if (!parseResult.success) {
    throw new GitValidationError(`Invalid author: ${parseResult.error.issues.map((i) => i.message).join(', ')}`);
  }

  return parseResult.data;
}

/**
 * Returns all currently registered agent author identities (both default and custom).
 */
export function getAllAgentAuthors(): Record<string, GitAuthor> {
  const result: Record<string, GitAuthor> = { ...DEFAULT_AGENT_AUTHORS };
  for (const [id, author] of customAgentAuthors.entries()) {
    result[id] = { ...author };
  }
  return result;
}

/**
 * Clears all custom agent author registrations.
 */
export function clearCustomAgentAuthors(): void {
  customAgentAuthors.clear();
}

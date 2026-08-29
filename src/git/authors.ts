import type { GitAuthor } from './types.js';
import { GitAuthorSchema } from './schema.js';
import { GitValidationError } from './errors.js';
import { devInfo } from '../core/dev-mode/index.js';
import {
  loadGitAuthorsFromDisk,
  saveGitAuthorsToDisk,
} from './storage.js';

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
 *
 * @param agentId - The input agent identifier string.
 * @returns Clean, lowercased, prefix-stripped agent identifier.
 *
 * @example
 * ```typescript
 * const id = normalizeAgentId('agent:ui-designer'); // 'ui-designer'
 * ```
 */
export function normalizeAgentId(agentId: string): string {
  return agentId.trim().toLowerCase().replace(/^(agent:|subagent:)/, '');
}

/**
 * Checks whether an author identity is registered for an agent ID (custom or default).
 *
 * @param agentId - The agent ID to check.
 * @returns True if registered.
 *
 * @example
 * ```typescript
 * if (hasAgentAuthor('ui-designer')) { ... }
 * ```
 */
export function hasAgentAuthor(agentId: string): boolean {
  const normalized = normalizeAgentId(agentId);
  return customAgentAuthors.has(normalized) || normalized in DEFAULT_AGENT_AUTHORS;
}

/**
 * Resolves the GitAuthor identity for an agent ID or returns the default orchestrator identity.
 *
 * @param agentId - Optional agent ID. If omitted, falls back to orchestrator.
 * @returns Validated GitAuthor object.
 *
 * @example
 * ```typescript
 * const author = getAgentAuthor('ui-designer');
 * // { name: 'Hurdler [UI Designer]', email: 'agent-ui-designer@hurdler.local' }
 * ```
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
 *
 * @param author - The GitAuthor object.
 * @returns Formatted author string suitable for `--author` Git flag.
 *
 * @example
 * ```typescript
 * const formatted = formatAuthorArg({ name: 'Jane', email: 'jane@example.com' });
 * // 'Jane <jane@example.com>'
 * ```
 */
export function formatAuthorArg(author: GitAuthor): string {
  return `${author.name} <${author.email}>`;
}

/**
 * Registers a custom agent author configuration in-memory.
 *
 * @param agentId - The agent ID.
 * @param author - The author identity to register.
 * @throws GitValidationError if author data is invalid.
 *
 * @example
 * ```typescript
 * registerAgentAuthor('lead-dev', { name: 'Lead Dev', email: 'lead@hurdler.local' });
 * ```
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
 * Updates an existing custom agent author registration.
 *
 * @param agentId - The agent ID.
 * @param updates - Partial author fields to update.
 * @returns Updated GitAuthor object.
 * @throws GitValidationError if no custom author exists or update is invalid.
 *
 * @example
 * ```typescript
 * updateAgentAuthor('lead-dev', { name: 'Principal Dev' });
 * ```
 */
export function updateAgentAuthor(agentId: string, updates: Partial<GitAuthor>): GitAuthor {
  const normalized = normalizeAgentId(agentId);
  const current = customAgentAuthors.get(normalized) ?? DEFAULT_AGENT_AUTHORS[normalized];

  if (!current) {
    throw new GitValidationError(`Cannot update author for '${agentId}': Author is not registered.`);
  }

  const merged = { ...current, ...updates };
  const parseResult = GitAuthorSchema.safeParse(merged);
  if (!parseResult.success) {
    throw new GitValidationError(
      `Invalid update for author '${agentId}': ${parseResult.error.issues.map((i) => i.message).join(', ')}`
    );
  }

  customAgentAuthors.set(normalized, parseResult.data);
  devInfo('GIT_AUTHORS', `Updated Git author for agent '${normalized}': ${formatAuthorArg(parseResult.data)}`);
  return parseResult.data;
}

/**
 * Unregisters a custom agent author.
 *
 * @param agentId - The agent ID to unregister.
 * @returns True if the custom author was removed, false if not found.
 *
 * @example
 * ```typescript
 * const removed = unregisterAgentAuthor('lead-dev');
 * ```
 */
export function unregisterAgentAuthor(agentId: string): boolean {
  const normalized = normalizeAgentId(agentId);
  const existed = customAgentAuthors.delete(normalized);
  if (existed) {
    devInfo('GIT_AUTHORS', `Unregistered custom Git author for agent '${normalized}'`);
  }
  return existed;
}

/**
 * Creates a validated GitAuthor object.
 *
 * @param name - Author display name.
 * @param email - Optional author email (defaults to auto-generated local address).
 * @returns Validated GitAuthor object.
 *
 * @example
 * ```typescript
 * const author = createAgentAuthor('QA Lead');
 * ```
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
 * Returns all currently registered agent author identities (both default and custom) as a dictionary.
 *
 * @returns Record mapping agent IDs to GitAuthor objects.
 *
 * @example
 * ```typescript
 * const allAuthors = getAllAgentAuthors();
 * ```
 */
export function getAllAgentAuthors(): Record<string, GitAuthor> {
  const result: Record<string, GitAuthor> = { ...DEFAULT_AGENT_AUTHORS };
  for (const [id, author] of customAgentAuthors.entries()) {
    result[id] = { ...author };
  }
  return result;
}

/**
 * Returns an array of all registered GitAuthor objects.
 *
 * @returns Array of GitAuthor objects.
 *
 * @example
 * ```typescript
 * const authorsList = listAgentAuthors();
 * ```
 */
export function listAgentAuthors(): GitAuthor[] {
  return Object.values(getAllAgentAuthors());
}

/**
 * Clears all custom agent author registrations from in-memory store.
 */
export function clearCustomAgentAuthors(): void {
  customAgentAuthors.clear();
}

/**
 * Synchronizes custom agent authors with `.hurdler/git/authors.json` on disk.
 *
 * @param repoPath - Repository root path (defaults to process.cwd()).
 * @returns Combined record of all agent authors.
 *
 * @example
 * ```typescript
 * const authors = await syncAuthorsWithDisk('/my-repo');
 * ```
 */
export async function syncAuthorsWithDisk(repoPath = process.cwd()): Promise<Record<string, GitAuthor>> {
  const diskAuthors = await loadGitAuthorsFromDisk(repoPath);

  if (diskAuthors) {
    for (const [id, author] of Object.entries(diskAuthors)) {
      customAgentAuthors.set(normalizeAgentId(id), author);
    }
  } else {
    // If no file exists, persist current custom authors if any
    const customMap: Record<string, GitAuthor> = {};
    for (const [id, author] of customAgentAuthors.entries()) {
      customMap[id] = author;
    }
    await saveGitAuthorsToDisk(repoPath, customMap);
  }

  return getAllAgentAuthors();
}

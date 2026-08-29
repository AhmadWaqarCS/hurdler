import type { AgentDefinition, AgentPromptCompositionOptions } from './types.js';

/**
 * Formats a clean, structured Identity header for the agent system prompt.
 */
export function formatAgentIdentityHeader(agent: AgentDefinition): string {
  const parts: string[] = [];

  parts.push(`# AGENT IDENTITY: ${agent.title} [id: ${agent.id}]`);
  parts.push(`**Domain Role**: ${agent.role}`);
  parts.push(`**Category**: ${agent.category}`);
  parts.push(`**Mission**: ${agent.description}`);
  parts.push(`\n## Core Persona & Operational Directives\n${agent.identityPrompt.trim()}`);

  return parts.join('\n');
}

/**
 * Formats the Git author attribution section for the agent system prompt.
 */
export function formatAgentGitSignature(agent: AgentDefinition): string {
  return [
    '## Git Source Control Attribution',
    `You operate with the designated Git identity:`,
    `- **Author Name**: ${agent.gitAuthor.name}`,
    `- **Author Email**: ${agent.gitAuthor.email}`,
    'All commits, branch creations, pull requests, and reviews you generate must be performed under this author identity.',
  ].join('\n');
}

/**
 * Resolves effective allowed tools given an agent definition and an optional list of all registered tool names.
 */
export function getEffectiveAgentTools(
  agent: AgentDefinition,
  allKnownToolNames: string[] = []
): string[] {
  const disallowedSet = new Set(agent.disallowedTools ?? []);

  if (agent.allowedTools.includes('*')) {
    if (allKnownToolNames.length > 0) {
      return allKnownToolNames.filter((tool) => !disallowedSet.has(tool));
    }
    return ['*'];
  }

  return (agent.allowedTools ?? []).filter((tool) => !disallowedSet.has(tool));
}

/**
 * Synthesizes a unified, multi-layered system prompt combining identity awareness,
 * Git authorship guidelines, resolved prompt registry instructions, and custom directives.
 */
export function synthesizeAgentSystemPrompt(
  agent: AgentDefinition,
  resolvedPromptContents: string[] = [],
  options: AgentPromptCompositionOptions = {}
): string {
  const separator = options.separator ?? '\n\n---\n\n';
  const sections: string[] = [];

  // 1. Agent Identity Header
  if (options.includeIdentityHeader !== false) {
    sections.push(formatAgentIdentityHeader(agent));
  }

  // 2. Git Author Awareness
  if (options.includeGitAuthorAwareness !== false && agent.gitAuthor) {
    sections.push(formatAgentGitSignature(agent));
  }

  // 3. Prompt Registry Guidelines (e.g. global:kiss, system:validations, etc.)
  if (resolvedPromptContents.length > 0) {
    const promptSection = [
      '## Coding Standards & Architectural Guidelines',
      resolvedPromptContents.join('\n\n'),
    ].join('\n\n');
    sections.push(promptSection);
  }

  // 4. Agent Specific System Instructions
  if (agent.systemPrompt && agent.systemPrompt.trim().length > 0) {
    sections.push(`## Agent Specific Directives\n${agent.systemPrompt.trim()}`);
  }

  // 5. Extra Custom Inline Instructions
  if (options.extraInstructions && options.extraInstructions.trim().length > 0) {
    sections.push(`## Task Specific Instructions\n${options.extraInstructions.trim()}`);
  }

  // 6. User Prompt Context if provided
  if (options.userPrompt && options.userPrompt.trim().length > 0) {
    sections.push(`## User Task\n${options.userPrompt.trim()}`);
  }

  return sections.join(separator);
}

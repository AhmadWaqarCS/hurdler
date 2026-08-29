import { PromptRenderError } from './errors.js';
import type { PromptRenderOptions } from './types.js';

// Regex matches {{ variableName }} and optional fallback {{ variableName | "fallback" }} or {{ variableName | 'fallback' }}
const TEMPLATE_VAR_REGEX = /(?<!\\)\{\{\s*([a-zA-Z0-9_$.-]+)(?:\s*\|\s*(?:"([^"]*)"|'([^']*)'|([^}]+?)))?\s*\}\}/g;
const ESCAPED_VAR_REGEX = /\\\{\{/g;

/**
 * Extracts all unique variable names referenced inside {{variable}} placeholders in a prompt template string.
 */
export function extractVariables(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const variables = new Set<string>();
  const matches = content.matchAll(TEMPLATE_VAR_REGEX);

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1].trim());
    }
  }

  return Array.from(variables);
}

/**
 * Renders a prompt template string by substituting variables.
 * Supports fallback defaults like `{{projectName | "Hurdler"}}`.
 *
 * @param template The raw prompt template string
 * @param options Render options including variables and strict mode
 * @returns The interpolated string
 */
export function renderTemplate(template: string, options: Partial<PromptRenderOptions> = {}): string {
  if (!template || typeof template !== 'string') {
    return '';
  }

  const { variables = {}, strict = false } = options;

  const rendered = template.replace(
    TEMPLATE_VAR_REGEX,
    (fullMatch, varName: string, doubleQuotedFallback?: string, singleQuotedFallback?: string, rawFallback?: string) => {
      const key = varName.trim();

      if (key in variables && variables[key] !== undefined && variables[key] !== null) {
        return String(variables[key]);
      }

      // Check for fallback value
      if (doubleQuotedFallback !== undefined) {
        return doubleQuotedFallback;
      }
      if (singleQuotedFallback !== undefined) {
        return singleQuotedFallback;
      }
      if (rawFallback !== undefined) {
        return rawFallback.trim();
      }

      if (strict) {
        throw new PromptRenderError(
          `Missing required prompt template variable '${key}' with no fallback provided.`,
          { variable: key, templateSnippet: template.slice(0, 100) }
        );
      }

      return fullMatch;
    }
  );

  // Unescape any escaped braces \{{
  return rendered.replace(ESCAPED_VAR_REGEX, '{{');
}

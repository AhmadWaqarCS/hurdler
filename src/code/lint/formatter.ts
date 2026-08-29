import type { LintMessage, LintResult } from './types.js';
import { extractCodeSnippet, formatLocation } from '../helpers.js';

/**
 * Formats lint diagnostics into high-signal markdown tailored for LLM debug agents.
 */
export function formatLintForLLM(results: LintResult | LintResult[]): string {
  const resultList = Array.isArray(results) ? results : [results];
  const invalidFiles = resultList.filter((r) => !r.isValid || r.messages.length > 0);

  if (invalidFiles.length === 0) {
    return '✓ No lint errors or warnings found.';
  }

  const sections: string[] = [];
  sections.push('### ⚠️ Linting Diagnostics & Errors');
  sections.push('The following errors/warnings were detected in the generated code:');

  for (const fileResult of invalidFiles) {
    const fileName = fileResult.filePath ?? 'In-Memory Code';
    sections.push(`\n#### File: \`${fileName}\``);
    sections.push(`- **Errors**: ${fileResult.errorCount} | **Warnings**: ${fileResult.warningCount} | **Fixable**: ${fileResult.fixableErrorCount + fileResult.fixableWarningCount}`);

    for (const msg of fileResult.messages) {
      const severityIcon = msg.severity === 2 ? '❌ [ERROR]' : '⚠️ [WARN]';
      const ruleText = msg.ruleId ? `\`(${msg.ruleId})\`` : '`(syntax/parser)`';
      const locText = formatLocation(msg.line, msg.column);

      sections.push(`\n${severityIcon} **${locText}** ${ruleText}: ${msg.message}`);

      // Extract code context around the error if source code is available
      if (fileResult.source) {
        const snippet = extractCodeSnippet(fileResult.source, msg.line, msg.column, 2);
        if (snippet) {
          sections.push('```typescript');
          sections.push(snippet);
          sections.push('```');
        }
      }

      if (msg.suggestions && msg.suggestions.length > 0) {
        sections.push(`- *Suggested Fix*: ${msg.suggestions.map((s) => s.desc).join(', ')}`);
      }
    }
  }

  sections.push('\n> [!TIP]\n> Please fix the syntax/type/rule errors identified above at the designated line numbers.');

  return sections.join('\n');
}

/**
 * Returns a short one-line summary of lint results across multiple files.
 */
export function formatLintSummary(results: LintResult[]): string {
  const totalFiles = results.length;
  const passedFiles = results.filter((r) => r.isValid).length;
  const failedFiles = totalFiles - passedFiles;
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);

  if (failedFiles === 0) {
    return `✓ Lint passed across all ${totalFiles} file(s) (${totalWarnings} warning(s))`;
  }

  return `✗ Lint failed: ${failedFiles}/${totalFiles} file(s) with ${totalErrors} error(s) and ${totalWarnings} warning(s)`;
}

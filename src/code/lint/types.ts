export type {
  LintMessage,
  LintResult,
  LintTextOptions,
  LintFileOptions,
  LintFilesOptions,
  LintFixResult,
  LintSeverity,
  CodeLanguage,
} from '../types.js';

export interface ESLintConfigOptions {
  projectRoot?: string;
  ruleOverrides?: Record<string, unknown>;
  useTypeScript?: boolean;
}

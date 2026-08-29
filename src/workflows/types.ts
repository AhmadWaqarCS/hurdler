import type { TokenUsage, CostBreakdown } from '../llms/billing/types.js';
import type { GitAuthor } from '../git/types.js';
import type { ValidateAndPrettifyResult } from '../code/types.js';
import type {
  WorkflowDefinition,
  WorkflowStepDefinition,
} from '../registries/workflows/types.js';

export interface FileContextRecord {
  filePath: string;
  action: 'created' | 'modified' | 'deleted' | 'read';
  lastModifiedStepId: string;
  lastModifiedAgentId?: string;
  content?: string;
  outlineMarkdown?: string;
  exportedSymbols?: string[];
  timestamp: string;
}

export interface DynamicSymbolSummary {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'route';
  filePath: string;
  signature?: string;
  stepId: string;
  agentId?: string;
}

export interface WorkflowExecutionContext {
  workflowId: string;
  workflowTitle: string;
  projectRoot: string;
  repoPath?: string;
  currentBranch?: string;
  variables: Record<string, string | number | boolean>;
  files: Map<string, FileContextRecord>;
  symbols: Map<string, DynamicSymbolSummary>;
  stepResults: Map<string, WorkflowStepResult>;
  totalTokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens: number;
  };
  totalCost: CostBreakdown;
  startTime: number;
  dryRun?: boolean;
}

export interface WorkflowStepResult {
  stepId: string;
  stepTitle: string;
  agentId?: string;
  status: 'success' | 'failed' | 'skipped';
  executionMode: string;
  outputs?: string | Record<string, unknown>;
  modifiedFiles: string[];
  lintResults?: ValidateAndPrettifyResult[];
  gitCommitHash?: string;
  gitAuthor?: GitAuthor;
  durationMs: number;
  usage?: TokenUsage;
  cost?: CostBreakdown;
  error?: string;
  timestamp: string;
}

export interface WorkflowEventHooks {
  onStepStart?: (step: WorkflowStepDefinition, context: WorkflowExecutionContext) => void | Promise<void>;
  onStepComplete?: (step: WorkflowStepDefinition, result: WorkflowStepResult, context: WorkflowExecutionContext) => void | Promise<void>;
  onStepError?: (step: WorkflowStepDefinition, error: Error, context: WorkflowExecutionContext) => void | Promise<void>;
  onLintChecked?: (filePath: string, lintResult: ValidateAndPrettifyResult, context: WorkflowExecutionContext) => void | Promise<void>;
  onGitCommit?: (commitHash: string, agentAuthor: GitAuthor, message: string, context: WorkflowExecutionContext) => void | Promise<void>;
  onWorkflowComplete?: (result: WorkflowExecutionResult, context: WorkflowExecutionContext) => void | Promise<void>;
}

export interface WorkflowExecutionOptions {
  variables?: Record<string, string | number | boolean>;
  projectRoot?: string;
  repoPath?: string;
  modelTierOverride?: 'standard' | 'flex' | 'priority';
  dryRun?: boolean;
  stopOnError?: boolean;
  autoLint?: boolean;
  autoCommit?: boolean;
  autoDebug?: boolean;
  abortSignal?: AbortSignal;
  hooks?: WorkflowEventHooks;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  workflowTitle: string;
  status: 'success' | 'failed' | 'partial';
  durationMs: number;
  stepResults: WorkflowStepResult[];
  totalTokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens: number;
  };
  totalCost: CostBreakdown;
  generatedFiles: string[];
  gitBranch?: string;
  prUrl?: string;
  error?: string;
}

export interface ComposeWorkflowsOptions {
  id?: string;
  title?: string;
  category?: WorkflowDefinition['category'];
  description?: string;
  targetFramework?: string;
  defaultPrompts?: string[];
  sequential?: boolean;
}

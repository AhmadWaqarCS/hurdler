import { z } from 'zod';

export const WorkflowCategorySchema = z.union([
  z.enum([
    'feature_development',
    'debugging',
    'security_hardening',
    'refactoring',
    'greenfield',
    'atomic_pipeline',
    'custom',
  ]),
  z.string().min(1, 'Custom category must not be empty'),
]);

export const WorkflowExecutionModeSchema = z.enum([
  'agent',
  'automated',
  'parallel',
  'conditional',
]);

export const WorkflowStepGitActionSchema = z.object({
  /** Branch name to create or switch to for this step */
  branch: z.string().optional(),
  /** Whether to stage modified files or specific file list */
  stage: z.union([z.boolean(), z.array(z.string())]).default(true),
  /** Whether to automatically commit modified files on step completion */
  commit: z.boolean().default(true),
  /** Template commit message (supports {{stepId}}, {{agentId}}, {{summary}} variables) */
  commitMessage: z.string().optional(),
  /** Agent ID whose Git author identity will be used for this commit */
  authorAgentId: z.string().optional(),
});

export const WorkflowStepLintActionSchema = z.object({
  /** Whether automatic linting and formatting is active for this step */
  enabled: z.boolean().default(true),
  /** Whether to automatically apply ESLint and Prettier fixes */
  fix: z.boolean().default(true),
  /** Whether to invoke the debugger agent automatically if lint errors remain */
  autoDebug: z.boolean().default(true),
  /** Maximum number of automated debug repair iterations */
  maxDebugRetries: z.number().int().min(0).max(5).default(3),
});

export const WorkflowStepPlaywrightActionSchema = z.object({
  /** Target URL for automated inspection or test run */
  url: z.string().optional(),
  /** Optional interactive actions to run */
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Whether to take compressed JPEG screenshot */
  captureScreenshot: z.boolean().default(true),
  /** JPEG compression quality (1-100) */
  screenshotQuality: z.number().int().min(1).max(100).default(75),
  /** Full page screenshot */
  fullPage: z.boolean().default(false),
  /** Whether to invoke auto-debug if assertions fail */
  autoDebug: z.boolean().default(true),
});

export const WorkflowStepDefinitionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    /** Unique step identifier within the workflow (e.g. 'scaffold-domain', 'build-ui') */
    id: z.string().min(1, 'Step ID must not be empty'),
    /** Human-readable title of the step */
    title: z.string().min(1, 'Step title must not be empty'),
    /** Detailed description of the task performed in this step */
    description: z.string().optional(),
    /** Responsible Agent ID from AgentRegistry (e.g. 'business-logic', 'ui-designer', 'debugger') */
    agentId: z.string().optional(),
    /** Execution mode for this step */
    executionMode: WorkflowExecutionModeSchema.default('agent'),
    /** Array of prompt IDs from PromptRegistry to compose for this step */
    prompts: z.array(z.string()).default([]),
    /** Ad-hoc inline prompts or instructions */
    inlinePrompts: z.array(z.string()).default([]),
    /** Permitted tool names or ['*'] for unrestricted access */
    tools: z.array(z.string()).default([]),
    /** Explicitly disallowed tool names */
    disallowedTools: z.array(z.string()).default([]),
    /** Recommended or required module package names from ModuleRegistry */
    modules: z.array(z.string()).default([]),
    /** Preferred LLM provider API tier override ('standard' | 'flex' | 'priority') */
    modelTier: z.enum(['standard', 'flex', 'priority']).optional(),
    /** Model reasoning effort override */
    reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
    /** Sampling temperature override */
    temperature: z.number().min(0).max(2).optional(),
    /** Maximum generation tokens */
    maxTokens: z.number().int().positive().optional(),
    /** Prerequisite step IDs that must complete before this step can run */
    dependsOn: z.array(z.string()).default([]),
    /** Sub-steps to execute concurrently when executionMode === 'parallel' */
    parallelSteps: z.array(WorkflowStepDefinitionSchema).optional(),
    /** Optional context condition or filter expression */
    condition: z.string().optional(),
    /** Automated Git branch and commit actions */
    gitAction: WorkflowStepGitActionSchema.optional(),
    /** Automated ESLint & Prettier verification actions */
    lintAction: WorkflowStepLintActionSchema.optional(),
    /** Automated Playwright browser verification actions */
    playwrightAction: WorkflowStepPlaywrightActionSchema.optional(),
    /** Maximum step retries on failure */
    maxRetries: z.number().int().min(0).default(0),
    /** If true, workflow continues even if this step fails */
    optional: z.boolean().default(false),
    /** Arbitrary metadata */
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
);

export const WorkflowDefinitionSchema = z.object({
  /** Unique identifier for the workflow (e.g. 'feature-development', 'bug-fix-and-debug') */
  id: z.string().min(1, 'Workflow ID must not be empty'),
  /** Human-readable title of the workflow */
  title: z.string().min(1, 'Workflow title must not be empty'),
  /** Functional classification */
  category: WorkflowCategorySchema.default('feature_development'),
  /** Purpose and operational description of this workflow */
  description: z.string().min(1, 'Workflow description must not be empty'),
  /** Target framework or environment */
  targetFramework: z.string().default('nextjs'),
  /** Sequence or DAG of workflow steps */
  steps: z.array(WorkflowStepDefinitionSchema).min(1, 'Workflow must contain at least one step'),
  /** Global default prompts injected across all steps in the workflow */
  defaultPrompts: z.array(z.string()).default(['global:kiss']),
  /** Initial Git feature branch to create or checkout */
  initialBranch: z.string().optional(),
  /** Searchable tags or keywords */
  tags: z.array(z.string()).default([]),
  /** True for immutable static built-ins, false for dynamic custom workflows */
  isBuiltin: z.boolean().default(false),
  /** Whether the workflow is active and available */
  active: z.boolean().default(true),
  /** Version number or string */
  version: z.union([z.string(), z.number()]).optional(),
  /** Arbitrary metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** ISO timestamp of creation */
  createdAt: z.string().optional(),
  /** ISO timestamp of last update */
  updatedAt: z.string().optional(),
});

export const WorkflowQueryFilterSchema = z.object({
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
  tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  agentId: z.string().optional(),
  search: z.string().optional(),
  isBuiltin: z.boolean().optional(),
  activeOnly: z.boolean().default(true),
  targetFramework: z.string().optional(),
});

import type { z } from 'zod';
import type {
  WorkflowCategorySchema,
  WorkflowExecutionModeSchema,
  WorkflowStepGitActionSchema,
  WorkflowStepLintActionSchema,
  WorkflowStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowQueryFilterSchema,
} from './schema.js';

export type WorkflowCategory = z.infer<typeof WorkflowCategorySchema>;
export type WorkflowExecutionMode = z.infer<typeof WorkflowExecutionModeSchema>;
export type WorkflowStepGitAction = z.infer<typeof WorkflowStepGitActionSchema>;
export type WorkflowStepLintAction = z.infer<typeof WorkflowStepLintActionSchema>;
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowQueryFilter = z.infer<typeof WorkflowQueryFilterSchema>;

export type WorkflowInput = Omit<
  WorkflowDefinition,
  'isBuiltin' | 'createdAt' | 'updatedAt'
> & {
  isBuiltin?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

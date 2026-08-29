import type { z } from 'zod';
import type {
  WorkflowCategorySchema,
  WorkflowExecutionModeSchema,
  WorkflowStepGitActionSchema,
  WorkflowStepLintActionSchema,
  WorkflowStepPlaywrightActionSchema,
  WorkflowStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowQueryFilterSchema,
  WorkflowRegistryMapSchema,
  WorkflowUpdateSchema,
  WorkflowStorageOptionsSchema,
} from './schema.js';

export type WorkflowCategory = z.infer<typeof WorkflowCategorySchema>;
export type WorkflowExecutionMode = z.infer<typeof WorkflowExecutionModeSchema>;
export type WorkflowStepGitAction = z.infer<typeof WorkflowStepGitActionSchema>;
export type WorkflowStepLintAction = z.infer<typeof WorkflowStepLintActionSchema>;
export type WorkflowStepPlaywrightAction = z.infer<typeof WorkflowStepPlaywrightActionSchema>;
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export interface WorkflowQueryFilter {
  category?: string;
  categories?: string[];
  tag?: string;
  tags?: string[];
  agentId?: string;
  search?: string;
  isBuiltin?: boolean;
  activeOnly?: boolean;
  targetFramework?: string;
}
export type WorkflowRegistryMap = z.infer<typeof WorkflowRegistryMapSchema>;
export type WorkflowUpdateInput = z.infer<typeof WorkflowUpdateSchema>;
export type WorkflowStorageOptions = z.infer<typeof WorkflowStorageOptionsSchema>;

export type WorkflowInput = Omit<
  WorkflowDefinition,
  'isBuiltin' | 'createdAt' | 'updatedAt'
> & {
  isBuiltin?: boolean;
  createdAt?: string;
  updatedAt?: string;
};


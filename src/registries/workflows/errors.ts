import { HurdlerError } from '../../core/errors/base-error.js';

export class WorkflowRegistryError extends HurdlerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: 'WORKFLOW_REGISTRY_ERROR',
      details,
    });
  }
}

export class WorkflowNotFoundError extends HurdlerError {
  constructor(workflowId: string) {
    super(`Workflow with ID '${workflowId}' was not found in the workflow registry.`, {
      code: 'WORKFLOW_NOT_FOUND',
      details: { workflowId },
    });
  }
}

export class WorkflowAlreadyExistsError extends HurdlerError {
  constructor(workflowId: string) {
    super(`Workflow with ID '${workflowId}' already exists in the workflow registry.`, {
      code: 'WORKFLOW_ALREADY_EXISTS',
      details: { workflowId },
    });
  }
}

export class WorkflowValidationError extends HurdlerError {
  constructor(workflowId: string, issues: unknown) {
    super(`Validation failed for workflow '${workflowId}': ${JSON.stringify(issues)}`, {
      code: 'WORKFLOW_VALIDATION_ERROR',
      details: { workflowId, issues },
    });
  }
}

export class WorkflowExecutionError extends HurdlerError {
  constructor(workflowId: string, message: string, details?: Record<string, unknown>) {
    super(`Workflow '${workflowId}' execution failed: ${message}`, {
      code: 'WORKFLOW_EXECUTION_ERROR',
      details: { workflowId, ...details },
    });
  }
}

export class WorkflowStepError extends HurdlerError {
  constructor(stepId: string, workflowId: string, message: string, details?: Record<string, unknown>) {
    super(`Step '${stepId}' in workflow '${workflowId}' failed: ${message}`, {
      code: 'WORKFLOW_STEP_ERROR',
      details: { stepId, workflowId, ...details },
    });
  }
}

export class WorkflowAbortedError extends HurdlerError {
  constructor(workflowId: string, reason?: string) {
    super(`Workflow '${workflowId}' was aborted.${reason ? ` Reason: ${reason}` : ''}`, {
      code: 'WORKFLOW_ABORTED',
      details: { workflowId, reason },
    });
  }
}

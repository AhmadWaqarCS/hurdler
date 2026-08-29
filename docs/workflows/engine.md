# Workflow Orchestration Engine

The **Workflow Engine** coordinates autonomous multi-agent pipelines, passing typed context between steps and handling transitions, retries, and errors.

---

## 🏛️ Execution Flow

```mermaid
sequenceDiagram
    participant User as Developer / CLI
    participant Engine as Workflow Engine
    participant Step as Step Handler
    participant Agent as Agent / Tool / Git

    User->>Engine: executeWorkflow(workflowId, params)
    loop Each Step
        Engine->>Step: executeStep(step, context)
        Step->>Agent: Run Agent / Tool / Git
        Agent-->>Step: Return Output & Artifacts
        Step-->>Engine: Update Context & State
    end
    Engine-->>User: Workflow Execution Result
```

---

## 📑 Programmatic API Reference

### `executeWorkflow(workflowId: string, params?: Record<string, any>): Promise<WorkflowResult>`

```typescript
import { executeWorkflow } from 'hurdler';

const result = await executeWorkflow('full-feature-pipeline', {
  goal: 'Create user profile page component',
  targetDir: 'src/components/profile'
});

console.log('Status:', result.status);
console.log('Artifacts:', result.artifacts);
```

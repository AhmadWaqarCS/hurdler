# Workflow Composition

Workflows in Hurdler are composable: multiple atomic workflows can be merged into higher-level pipelines.

---

## 📑 Programmatic API Reference

### `composeWorkflows(workflowIds: string[]): WorkflowDefinition`

Merges multiple workflow definitions in sequential order.

```typescript
import { composeWorkflows, executeWorkflow } from 'hurdler';

// Compose an end-to-end pipeline from atomic workflows
const combined = composeWorkflows(['plan-feature', 'implement-code', 'verify-and-commit']);
```

# Workflows Registry

The **Workflows Registry** stores reusable multi-agent pipelines and step orchestration definitions.

---

## 💻 CLI Commands

```bash
# List all registered workflows
hurdler workflows list

# View workflow step sequence
hurdler workflows get full-feature-pipeline

# Run a workflow
hurdler workflows run full-feature-pipeline --param goal="Refactor auth service"
```

---

## 📑 Programmatic API Reference

### `getWorkflow(workflowId: string): Promise<WorkflowDefinition>`

```typescript
import { getWorkflow, listWorkflows } from 'hurdler';

const workflow = await getWorkflow('full-feature-pipeline');
console.log('Steps:', workflow.steps.map(s => s.name));
```

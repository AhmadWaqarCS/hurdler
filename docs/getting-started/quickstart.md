# Quickstart Guide

Get up and running with Hurdler in less than 5 minutes.

---

## Step 1: Initialize Workspace

In your target project directory, run:

```bash
hurdler init
```

This creates the `.hurdler/` directory structure containing:
- `.hurdler/config.json`: Workspace configuration settings.
- `.hurdler/registries/`: Dynamic JSON registries for models, prompts, tools, modules, agents, and workflows.
- `.hurdler/mapper/`: Incremental codebase symbol cache.
- `.hurdler/git/`: Agent authorship and PR tracking metadata.

---

## Step 2: Verify API Keys & Models

Check your configured API keys and available LLM models:

```bash
# Check provider keys
hurdler keys check

# List registered models
hurdler llms list
```

---

## Step 3: Run a Multi-Agent Workflow

Execute an autonomous feature-creation workflow:

```bash
hurdler workflows run full-feature-pipeline \
  --param goal="Create an authentication helper using zod" \
  --dev
```

You will see:
1. **Architect Agent** plans the feature architecture and types.
2. **Coder Agent** writes the implementation with linting and format checks.
3. **Tester Agent** runs code verification.
4. **Git Manager** commits changes under a dedicated Git branch and agent identity.

---

## Step 4: Programmatic Usage (Node.js)

```typescript
import { executeWorkflow, getWorkflowRegistry, loadConfig } from 'hurdler';

// Load workspace config
const config = await loadConfig();

// Execute a workflow programmatically
const result = await executeWorkflow('full-feature-pipeline', {
  goal: 'Implement token bucket rate limiter',
  targetFile: 'src/utils/rate-limiter.ts'
});

console.log('Workflow status:', result.status);
console.log('Commits generated:', result.commits);
```

# Agents Registry

The **Agents Registry** defines specialized multi-agent roles (e.g. `architect`, `coder`, `tester`, `debugger`, `security-reviewer`, `git-manager`), binding each to default system prompts, toolsets, and assigned LLM models.

---

## 💻 CLI Commands

```bash
# List all registered agents
hurdler agents list

# Inspect an agent profile
hurdler agents get coder

# Generate prompt payload for an agent
hurdler agents payload coder --task "Implement JWT auth"
```

---

## 📑 Programmatic API Reference

### `getAgent(agentId: string): Promise<AgentDefinition>`

```typescript
import { getAgent, listAgents } from 'hurdler';

const coderAgent = await getAgent('coder');
console.log('Assigned tools:', coderAgent.tools);
```

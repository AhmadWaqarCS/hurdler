# Agent Authorship & Commits

In Hurdler, every agent is assigned a distinct Git identity, ensuring complete auditability for every change.

---

## 👥 Built-in Agent Identities

| Agent | Git Author Name | Git Email |
|---|---|---|
| **Architect** | `Hurdler Architect` | `architect@hurdler.local` |
| **Coder** | `Hurdler Coder` | `coder@hurdler.local` |
| **Tester** | `Hurdler Tester` | `tester@hurdler.local` |
| **Debugger** | `Hurdler Debugger` | `debugger@hurdler.local` |
| **Security Reviewer** | `Hurdler Security` | `security@hurdler.local` |

---

## 📑 Programmatic API Reference

### `commitAsAgent(agentId: string, message: string, files?: string[]): Promise<CommitResult>`

```typescript
import { commitAsAgent } from 'hurdler';

const commit = await commitAsAgent('coder', 'feat(auth): add zod schema validation', ['src/auth/schema.ts']);
console.log('Committed hash:', commit.hash);
```

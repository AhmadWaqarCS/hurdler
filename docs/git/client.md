# Git Client & Repository Setup

The **Git Subsystem** wraps `simple-git` with a functional, type-safe interface tailored for autonomous multi-agent software engineering.

---

## 💻 CLI Commands

```bash
# Check git status
hurdler git status

# Inspect git log
hurdler git log --limit 10

# Stash current changes
hurdler git stash
```

---

## 📑 Programmatic API Reference

### `getGitClient(cwd?: string): SimpleGit`

```typescript
import { getGitClient, getGitStatus } from 'hurdler';

const status = await getGitStatus();
console.log('Modified files:', status.modified);
```

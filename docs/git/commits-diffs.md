# Commits, Diffs & Staging

The Git Subsystem provides atomic staging and diff calculation tools to verify changes before committing.

---

## 💻 CLI Commands

```bash
# View file diffs
hurdler git diff

# View staged diffs
hurdler git diff --staged

# Commit changes
hurdler git commit -m "feat: implement caching"
```

---

## 📑 Programmatic API Reference

### `getGitDiff(options?: DiffOptions): Promise<string>`

```typescript
import { getGitDiff } from 'hurdler';

const diffOutput = await getGitDiff({ files: ['src/index.ts'] });
```

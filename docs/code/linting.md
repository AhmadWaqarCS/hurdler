# ESLint Runner & Auto-Fix

Hurdler executes ESLint programmatically to diagnose and repair code formatting and style issues.

---

## 💻 CLI Commands

```bash
# Run lint check
hurdler code lint

# Run lint with automatic fix
hurdler code lint --fix
```

---

## 📑 Programmatic API Reference

### `lintFiles(files: string[], options?: LintOptions): Promise<LintReport>`

```typescript
import { lintFiles } from 'hurdler';

const report = await lintFiles(['src/index.ts'], { fix: true });
console.log('Fixed count:', report.fixableErrorCount);
```

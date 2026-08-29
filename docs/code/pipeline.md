# Automated Code Pipeline

The **Code Pipeline** executes a comprehensive validation sequence on every generated code file:
1. **ESLint Verification & Auto-Fix**: Identifies and fixes linting violations.
2. **Prettier Formatting**: Applies uniform code formatting.
3. **AST Symbol Extraction**: Validates syntax trees and updates project mapper symbols.

---

## 💻 CLI Commands

```bash
# Run full code pipeline on specific files
hurdler code pipeline src/auth/index.ts

# Lint entire project
hurdler code lint

# Prettify entire project
hurdler code prettify
```

---

## 📑 Programmatic API Reference

### `runCodePipeline(files: string[]): Promise<PipelineResult>`

```typescript
import { runCodePipeline } from 'hurdler';

const result = await runCodePipeline(['src/services/user.ts']);
console.log('Pipeline Success:', result.success);
console.log('Lint errors remaining:', result.lintErrors.length);
```

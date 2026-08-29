# Prettier Code Formatting

Hurdler automatically applies Prettier formatting to generated TypeScript, JavaScript, JSON, and Markdown files.

---

## 💻 CLI Commands

```bash
# Check code formatting
hurdler code prettify --check

# Format files in place
hurdler code prettify
```

---

## 📑 Programmatic API Reference

### `formatCode(source: string, filePath?: string): Promise<string>`

```typescript
import { formatCode } from 'hurdler';

const formatted = await formatCode('const x:number=1;', 'index.ts');
// Output: 'const x: number = 1;\n'
```

# AST Analysis (ts-morph & tree-sitter)

Hurdler utilizes `ts-morph` for TypeScript compiler-grade AST manipulation and `tree-sitter` for high-performance polyglot syntax tree parsing.

---

## 💻 CLI Commands

```bash
# Inspect AST symbols in a file
hurdler code ast src/index.ts
```

---

## 📑 Programmatic API Reference

### `parseASTSymbols(filePath: string): Promise<SymbolDeclaration[]>`

```typescript
import { parseASTSymbols } from 'hurdler';

const symbols = await parseASTSymbols('src/services/auth.ts');
// Returns array of exported functions, interfaces, types, and variables
```

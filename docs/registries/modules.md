# Modules Registry

The **Modules Registry** maintains a curated catalog of standard libraries (e.g. `zod`, `simple-git`, `ts-morph`, `playwright`), documentation snippets, and best practices injected into agent prompts to guide code generation.

---

## 💻 CLI Commands

```bash
# List all recommended modules
hurdler modules list

# Search for a module by keyword
hurdler modules search validation

# Format module docs for context injection
hurdler modules format zod
```

---

## 📑 Programmatic API Reference

### `getModuleDocs(moduleName: string): Promise<string>`

```typescript
import { getModuleDocs, getModule } from 'hurdler';

const docsSnippet = await getModuleDocs('zod');
// Returns markdown code examples and standard usage patterns for prompt context
```

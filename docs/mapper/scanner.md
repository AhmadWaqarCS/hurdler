# Project Mapper: Scanner & Symbols

The **Project Mapper** indexes the entire codebase into a dynamic graph of files, exported symbols, import dependencies, and architecture layers.

---

## 💻 CLI Commands

```bash
# Scan and index current project
hurdler mapper scan

# View mapper cache status
hurdler mapper status

# Inspect symbols in a specific file
hurdler mapper inspect src/core/config.ts
```

---

## 📑 Programmatic API Reference

### `scanProject(options?: ScanOptions): Promise<ProjectGraph>`

```typescript
import { scanProject } from 'hurdler';

const graph = await scanProject();
console.log(`Indexed ${graph.files.length} files and ${graph.symbols.length} symbols`);
```

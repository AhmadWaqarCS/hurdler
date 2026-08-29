# Impact & Blast Radius Analysis

The **Impact Analysis** engine traces reverse import dependencies to calculate what files, functions, and tests might be affected when a file is modified.

---

## 💻 CLI Commands

```bash
# Analyze blast radius of modifying a file
hurdler mapper impact src/core/config.ts
```

---

## 📑 Programmatic API Reference

### `analyzeImpact(filePath: string): Promise<ImpactAnalysisResult>`

```typescript
import { analyzeImpact } from 'hurdler';

const impact = await analyzeImpact('src/core/config.ts');
console.log('Direct dependents:', impact.directDependents);
console.log('Indirect dependents:', impact.indirectDependents);
```

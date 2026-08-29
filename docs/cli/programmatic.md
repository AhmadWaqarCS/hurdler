# Programmatic CLI Dispatcher

The CLI router and formatters can be imported and executed programmatically inside custom scripts, TUIs, or desktop applications.

---

## 📑 Programmatic API Reference

### `runCli(argv: string[], options?: RunCliOptions): Promise<CliResult>`

```typescript
import { runCli } from 'hurdler';

// Run a CLI command programmatically and capture the structured output
const result = await runCli(['llms', 'list', '--json']);

if (result.success) {
  const models = JSON.parse(result.stdout);
  console.log('Registered models:', models.length);
}
```

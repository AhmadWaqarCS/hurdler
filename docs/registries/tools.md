# Tools Registry

The **Tools Registry** registers function tools exposed to LLM agents during workflow execution, complete with Zod input/output schemas and execution sandboxes.

---

## 💻 CLI Commands

```bash
# List all registered agent tools
hurdler tools list

# Inspect a tool schema
hurdler tools get file_writer

# Execute a tool directly via CLI
hurdler tools run file_reader --args '{"path":"package.json"}'
```

---

## 📑 Programmatic API Reference

### `executeTool(toolName: string, args: unknown, context?: ToolContext): Promise<ToolResult>`

```typescript
import { executeTool, getTool } from 'hurdler';

const toolDef = await getTool('file_writer');
const result = await executeTool('file_writer', {
  path: 'src/config.ts',
  content: 'export const port = 3000;'
});
```

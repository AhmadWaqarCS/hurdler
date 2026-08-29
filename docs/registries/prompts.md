# Prompts Registry

The **Prompts Registry** manages system prompts, thought process guidelines, and persona templates (e.g. "Follow KISS", "Create Business Logic", "Apply Validations", "Security Review").

---

## 💻 CLI Commands

```bash
# List all registered prompts and personas
hurdler prompts list

# View prompt template content
hurdler prompts get kiss-philosophy

# Render a prompt with template variables
hurdler prompts render agent-system --vars '{"role":"Coder","target":"src/auth.ts"}'
```

---

## 📑 Programmatic API Reference

### `renderPrompt(promptId: string, variables?: Record<string, any>): Promise<string>`

```typescript
import { renderPrompt } from 'hurdler';

const systemPrompt = await renderPrompt('business-logic-creator', {
  framework: 'Next.js',
  style: 'functional'
});
```

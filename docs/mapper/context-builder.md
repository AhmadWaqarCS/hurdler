# Targeted Context Builder

The **Context Builder** constructs concise, high-relevance code context slices for LLM prompts, staying within configured token budgets.

---

## 💻 CLI Commands

```bash
# Build targeted context for a feature goal
hurdler mapper context --query "user authentication and token validation" --max-tokens 4000
```

---

## 📑 Programmatic API Reference

### `buildContextForFeature(goal: string, options?: ContextOptions): Promise<string>`

```typescript
import { buildContextForFeature } from 'hurdler';

const contextText = await buildContextForFeature('Add rate limiting middleware', {
  maxTokens: 3000
});
```

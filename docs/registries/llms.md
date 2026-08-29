# LLMs Registry

The **LLMs Registry** defines supported AI models, provider endpoints (Google Vertex, Gemini, Anthropic Claude, OpenAI), context limits, thinking / reasoning capabilities, and pricing metrics.

---

## 📋 Schema Overview

Each model entry includes:
- `id`: Unique identifier (e.g. `gemini-2.5-flash`, `claude-3-5-sonnet-20241022`).
- `provider`: Provider type (`google`, `vertex`, `anthropic`, `openai`).
- `contextWindow`: Maximum token context length.
- `maxOutputTokens`: Maximum completion tokens.
- `pricing`: Prompt cost and completion cost per million tokens.
- `capabilities`: Support for tool calling, structured outputs, reasoning/thinking, vision.

---

## 💻 CLI Commands

```bash
# List all registered models with pricing and context limits
hurdler llms list

# Inspect a specific model
hurdler llms get gemini-2.5-flash

# Test prompt generation on a model
hurdler llms test gemini-2.5-flash --prompt "Explain the KISS principle in 2 sentences"

# Sync models registry with disk
hurdler llms sync
```

---

## 📑 Programmatic API Reference

### `listModels(filter?: ModelFilter): Promise<LLMModelDefinition[]>`

```typescript
import { listModels, getModel } from 'hurdler';

const models = await listModels({ provider: 'anthropic' });
const sonnet = await getModel('claude-3-5-sonnet-20241022');
```

# Multi-Provider Adapters

The **LLM Engine** normalizes interactions with multiple model providers via the Vercel AI SDK into a unified, functional interface.

---

## 🔌 Supported Providers

| Provider | Adapter Library | Authentication | Key Env Var |
|---|---|---|---|
| **Google Gemini** | `@ai-sdk/google` | API Key | `GEMINI_API_KEY` |
| **Google Vertex AI** | `@ai-sdk/google-vertex` | Service Account JSON | `GOOGLE_APPLICATION_CREDENTIALS` |
| **Anthropic Claude** | `@ai-sdk/anthropic` | API Key | `ANTHROPIC_API_KEY` |
| **OpenAI Compatible** | `@ai-sdk/openai` | API Key | `OPENAI_API_KEY` |

---

## 📑 Getting a Provider Model

```typescript
import { getLanguageModel } from 'hurdler';

const model = await getLanguageModel('gemini-2.5-flash');
// Returns standardized LanguageModel instance ready for execution
```

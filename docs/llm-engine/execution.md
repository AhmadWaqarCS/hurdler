# Execution & Streaming

Hurdler provides pure functional wrappers around generation and streaming with automatic token tracking, billing records, and Dev Mode logging.

---

## 📑 Core Execution Functions

### `generateLLMText(options): Promise<GenerateTextResult>`

Executes a synchronous text generation call with tool calling support.

```typescript
import { generateLLMText } from 'hurdler';

const response = await generateLLMText({
  modelId: 'gemini-2.5-flash',
  system: 'You are a senior software engineer.',
  prompt: 'Design a high-throughput cache interface.'
});

console.log(response.text);
console.log('Tokens used:', response.usage);
```

### `streamLLMText(options): Promise<AsyncIterable<string>>`

Streams tokens in real-time.

```typescript
import { streamLLMText } from 'hurdler';

const stream = await streamLLMText({
  modelId: 'claude-3-5-sonnet-20241022',
  prompt: 'Write a TypeScript function to parse URLs'
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

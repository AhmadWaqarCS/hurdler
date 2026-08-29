# Key Management & Security

The **Keys Subsystem** manages API keys, rotation pools, provider health checks, and automatic secret redaction.

---

## 🔒 Security Architecture

1. **Automatic Secret Redaction**: Secrets and keys are never printed in plaintext in terminal logs, JSON outputs, or error traces.
2. **Provider Key Masking**: The CLI formats keys as `AIzaSy...****` or `sk-ant-...****`.
3. **Multi-Source Loading**: Seamlessly checks environment variables, `.env`, `.env.local`, and credential files.
4. **Key Rotation & Cooldowns**: Supports arrays of fallback keys for high-throughput workflows.

---

## 💻 CLI Commands

```bash
# List all configured provider keys and their status
hurdler keys list

# Run health checks against each configured provider
hurdler keys check

# Set a provider key in the local environment
hurdler keys set ANTHROPIC_API_KEY sk-ant-...

# Reset or remove a configured key
hurdler keys reset GEMINI_API_KEY
```

---

## 📑 Programmatic API Reference

### `getKey(provider: string): Promise<string | undefined>`

Safely retrieves a provider's active API key.

```typescript
import { getKey } from 'hurdler';

const apiKey = await getKey('anthropic');
```

### `maskKey(key: string): string`

Masks sensitive key characters for safe terminal or log display.

```typescript
import { maskKey } from 'hurdler';

console.log(maskKey('AIzaSyABCD1234XYZ')); // 'AIzaSy...4XYZ'
```

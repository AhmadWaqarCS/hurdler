# Configuration

Hurdler is configured through `.hurdler/config.json` in your workspace, with optional overrides from environment variables and CLI flags.

---

## ⚙️ Configuration Schema

The `.hurdler/config.json` file adheres to strict Zod validation:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "my-app",
    "root": ".",
    "framework": "nextjs"
  },
  "llms": {
    "defaultModel": "gemini-2.5-flash",
    "fallbackModel": "claude-3-5-sonnet",
    "maxTokensPerCall": 8192,
    "temperature": 0.2
  },
  "billing": {
    "maxMonthlyBudgetUsd": 50.0,
    "alertThresholdPct": 80
  },
  "git": {
    "authorPrefix": "hurdler-agent",
    "defaultBranch": "main",
    "featureBranchPrefix": "hurdler/feat-"
  },
  "code": {
    "autoPrettify": true,
    "autoLintFix": true,
    "maxDebuggerRetries": 3
  },
  "devMode": {
    "enabled": false,
    "logFile": "logs/dev.log",
    "logLevel": "debug"
  }
}
```

---

## 🛠️ CLI Configuration Commands

You can inspect and modify configuration keys directly using the CLI:

```bash
# View full config
hurdler config show

# Get a specific key
hurdler config get llms.defaultModel

# Set a config key
hurdler config set llms.defaultModel "claude-3-5-sonnet"

# Output as JSON
hurdler config show --json
```

---

## 📑 Programmatic API Reference

### `loadConfig(cwd?: string): Promise<HurdlerConfig>`

Loads and validates configuration from the current or specified working directory.

```typescript
import { loadConfig } from 'hurdler';

const config = await loadConfig();
console.log('Default Model:', config.llms.defaultModel);
```

### `updateConfig(updates: Partial<HurdlerConfig>, cwd?: string): Promise<HurdlerConfig>`

Validates and writes configuration updates back to `.hurdler/config.json`.

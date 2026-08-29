# Dev Mode & Diagnostic Logging

Hurdler features a dedicated **Dev Mode** designed for developers and debuggers. When active, it unlocks comprehensive runtime observability without affecting production code output.

---

## 🔍 Features of Dev Mode

1. **Non-Blocking File Logging**: Structured JSON / text logs written to `logs/dev.log`.
2. **High-Granularity Tracing**: Full LLM prompt payloads, tool execution timing, git diffs, AST parsing warnings, and network retry logs.
3. **Inspect Points**: Real-time snapshots of intermediate workflow states and agent decisions.
4. **Security Redaction**: Dev Mode logs automatically redact API keys, tokens, and authorization headers.

---

## ⚡ Enabling Dev Mode

### Via CLI Global Flag

Pass `--dev` or `-d` to any Hurdler command:

```bash
# Run workflow with Dev Mode diagnostics
hurdler workflows run full-feature-pipeline --dev

# Inspect CLI execution with Dev Mode
hurdler git commit -m "feat: add auth" --dev
```

### Via CLI Dev Command

Inspect and manage Dev Mode state and logs:

```bash
# Check Dev Mode status
hurdler dev status

# Tail recent logs
hurdler dev logs --lines 50

# Clear dev logs
hurdler dev clear
```

### Programmatic API

```typescript
import { enableDevMode, disableDevMode, isDevModeEnabled, logDev } from 'hurdler';

// Enable Dev Mode
enableDevMode({ logFile: 'logs/dev.log', logLevel: 'debug' });

// Check status
if (isDevModeEnabled()) {
  logDev('workflow', 'Executing step with input parameters', { stepId: 'step-1' });
}
```

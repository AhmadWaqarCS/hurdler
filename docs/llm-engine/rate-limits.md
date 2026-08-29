# Rate Limits & Token Economics

Hurdler automatically manages provider rate limits, retry backoffs, and context-window token budgets.

---

## ⚡ Features

- **Exponential Backoff**: Automatically handles `429 Too Many Requests` status codes.
- **Context Window Slicing**: Compresses and trims prompt context when approaching model window limits.
- **Budget Protection**: Aborts executions if session token consumption exceeds configured thresholds.

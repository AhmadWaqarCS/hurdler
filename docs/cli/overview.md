# Hurdler CLI Overview

The **Hurdler CLI** is the unified command-line tool and dispatcher for all Hurdler subsystems, supporting both human-interactive Unicode tables and machine-readable JSON (`--json`).

---

## ⚡ Global Options

| Option | Shorthand | Description |
|---|---|---|
| `--dev` | `-d` | Enable Dev Mode diagnostics and file logging |
| `--json` | `-j` | Emit structured JSON to stdout |
| `--help` | `-h` | Display help information |
| `--version` | `-v` | Display CLI version |
| `--quiet` | `-q` | Suppress non-essential logs |
| `--cwd <path>` | - | Set working directory |
| `--config <path>` | - | Path to custom configuration file |

---

## 💻 Running Commands

```bash
# Global terminal execution
hurdler <command> [subcommand] [arguments...] [options...]

# Machine-readable JSON output for integrations
hurdler llms list --json
```

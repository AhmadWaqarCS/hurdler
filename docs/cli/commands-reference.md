# 15 CLI Commands Reference

Complete command reference for all 15 Hurdler command groups:

---

## 📋 Commands Summary

| Command | Subcommands | Description |
|---|---|---|
| `init` | - | Initialize workspace and scaffold `.hurdler/` directories |
| `config` | `show`, `get`, `set`, `path` | Query and modify configuration settings |
| `dev` | `status`, `logs`, `clear` | Inspect diagnostics and tail `logs/dev.log` |
| `keys` | `list`, `check`, `set`, `reset` | Manage API keys with automatic redaction |
| `billing` | `stats`, `estimate`, `reset` | Track token metrics and estimate LLM costs |
| `llms` | `list`, `get`, `add`, `remove`, `test`, `sync` | Manage LLMs registry and test models |
| `prompts` | `list`, `get`, `render`, `add`, `remove`, `sync` | Manage prompt templates and render personas |
| `tools` | `list`, `get`, `run`, `add`, `remove`, `sync` | Inspect tool schemas and run tools |
| `modules` | `list`, `get`, `search`, `format`, `add`, `remove`, `sync` | Curate recommended libraries and inject docs |
| `agents` | `list`, `get`, `add`, `remove`, `payload`, `sync` | Manage agent identities and prompt payloads |
| `workflows` | `list`, `get`, `run`, `compose`, `add`, `remove`, `sync` | Execute and compose multi-agent pipelines |
| `git` | `status`, `branch`, `commit`, `log`, `diff`, `pr`, `issue`, `stash` | Complete Git source control management |
| `code` | `lint`, `prettify`, `pipeline`, `ast` | Automated linting, formatting, and AST tools |
| `mapper` | `scan`, `status`, `inspect`, `context`, `impact`, `clear` | Whole-codebase AST symbol mapping |
| `ui` | `screenshot`, `inspect`, `console` | Playwright browser automation and UI testing |

# 🏃 Hurdler - AI Agentic Software Engineering Platform

Welcome to the **Hurdler** documentation portal. Hurdler is a production-grade, functional AI agentic coding engine built in Node.js, designed to give Large Language Models (LLMs) the complete tooling, context, and autonomy to act as senior software engineers.

---

## 🌟 Core Highlights

- **KISS & Functional Architecture**: Pure, stateless TypeScript functions instead of brittle, bloated class hierarchies.
- **Dynamic & Adaptive Workflows**: Workflows compose prompts, tools, and specialized agent personas (Architect, Coder, Tester, Debugger, Git Manager) matched to LLM reasoning capacity.
- **Universal Dynamic Registries**: Models, Prompts, Tools, Modules, Agents, and Workflows are fully extensible and persisted both statically and dynamically in `.hurdler/`.
- **First-Class Git Integration**: Every agent operates under their own verified Git authorship, generating branch-isolated pull requests, atomic commits, and merge requests.
- **Self-Healing Code Pipeline**: Integrated ESLint, Prettier, ts-morph AST trees, and tree-sitter symbol indexing with an automated debugger feedback loop.
- **Multi-Modal UI Testing**: Playwright engine providing browser screenshots, DOM snapshots, and console log capture for visual multimodal reasoning.
- **Unified CLI & Machine Output**: Complete command line runner with human-friendly Unicode tables and machine-readable `--json` output.

---

## 🚀 Quick Navigation

| Subsystem | Description | Primary Docs |
|---|---|---|
| **Getting Started** | Setup, CLI installation, configuration, and Dev Mode | [Overview](getting-started/overview.md) · [Quickstart](getting-started/quickstart.md) |
| **Registries** | Universal Base CRUD for LLMs, Prompts, Tools, Modules, Agents, Workflows | [Registries Guide](registries/overview.md) · [LLMs](registries/llms.md) |
| **LLM Engine** | Multi-provider adapters (Vertex, Gemini, Claude, OpenAI), billing & keys | [LLM Execution](llm-engine/execution.md) · [Billing](core/billing.md) |
| **Workflows** | Multi-agent execution pipelines, step executors & self-healing loops | [Workflow Engine](workflows/engine.md) · [Composition](workflows/composition.md) |
| **Git Management** | Autonomous branch, commit, PR, issue & stash workflows | [Git Client](git/client.md) · [Agent Authors](git/authors.md) |
| **Code & AST** | Automated linting, formatting, pipeline fixes & AST symbol extraction | [Code Pipeline](code/pipeline.md) · [AST](code/ast.md) |
| **Project Mapper** | Whole-codebase AST indexing, context building & blast radius analysis | [Scanner](mapper/scanner.md) · [Context Builder](mapper/context-builder.md) |
| **Playwright UI** | Headless browser automation, multimodal UI context & screenshots | [Browser Lifecycle](playwright/browser.md) · [UI Context](playwright/ui-context.md) |
| **CLI & Commands** | 15 built-in CLI commands, global flags & programmatic router | [CLI Overview](cli/overview.md) · [Commands Reference](cli/commands-reference.md) |

---

## 📦 Quick Installation

Install globally to use the CLI in your terminal:

```bash
npm install -g hurdler
```

Or install locally in your Node.js project:

```bash
npm install hurdler
```

Initialize your workspace:

```bash
hurdler init
```

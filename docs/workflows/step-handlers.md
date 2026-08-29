# Workflow Step Handlers

Hurdler includes specialized step handlers for different categories of operations:

---

## 🔧 Step Handler Types

1. **Agent Step Handler**: Invokes a specialized agent persona with tailored system prompts, context, and allowed tools.
2. **Tool Step Handler**: Directly executes a sandboxed function tool.
3. **Git Step Handler**: Automates branch creation, commits under agent identities, pull requests, and tagging.
4. **Code Step Handler**: Executes ESLint checks, Prettier formatting, and AST validation.
5. **UI Step Handler**: Launches Playwright browser sessions for screenshot capture and multimodal inspection.

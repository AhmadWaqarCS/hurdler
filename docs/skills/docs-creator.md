# Docs Creator Skill

The **Docs Creator Skill** (`.agents/skills/DOCS/SKILL.md`) standardizes how documentation is created and updated across all Hurdler subsystems.

---

## ⚡ Execution Protocol

1. Read feature specification from `.agents/features/<FEATURE>.md`.
2. Inspect TypeScript source code in `src/<subsystem>/`.
3. Extract exported functions, parameters, return types, and CLI equivalents.
4. Render documentation adhering to the standard template into `docs/<category>/`.
5. Update `docs/_sidebar.md` navigation links.

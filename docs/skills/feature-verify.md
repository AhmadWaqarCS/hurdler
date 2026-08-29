# Feature Verifier Skill

The **Feature Verifier Skill** (`.agents/skills/FEATURE-VERIFY/SKILL.md`) validates that Hurdler features follow functional rules, static/dynamic registry isolation, and proper error handling.

---

## 🔍 Verification Protocol

1. Confirm dynamic registry resolution and absence of hardcoded sources.
2. Verify all exported functions for CRUD operations.
3. Validate error handling, explainable error codes, and code documentation.
4. Ensure registries write to `.hurdler/registries/` without polluting `src/`.

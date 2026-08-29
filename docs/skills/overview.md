# Agent Skills & Extensibility

**Skills** are modular instruction sets and workflows stored in `.agents/skills/<skill_name>/SKILL.md` that extend Hurdler agents with specialized domain procedures.

---

## 📁 Skill Structure

```
.agents/skills/<SKILL_NAME>/
├── SKILL.md                 # Primary instruction manual with YAML frontmatter
└── references/              # Optional supplemental documentation and assets
```

---

## 📋 Available Skills

- **Feature Verifier**: Step-by-step feature integrity, schema, and registry verification.
- **Docs Creator**: Automated documentation generation for GitHub Pages.

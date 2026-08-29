# Mapper Cache Storage

The Mapper subsystem caches AST symbols and file hashes incrementally in `.hurdler/mapper/graph.json`, ensuring sub-second updates on large codebases.

---

## 💻 CLI Commands

```bash
# Clear mapper cache to force a fresh re-scan
hurdler mapper clear
```

# Debugger & Self-Healing Loop

When a lint error, syntax issue, or test failure occurs during code generation, the **Debugger Loop** activates automatically to diagnose and resolve the failure.

---

## 🔄 Self-Healing Process

```mermaid
flowchart TD
    Error["Lint / AST / Test Failure Detected"] --> Context["Extract Error Lines & File Context"]
    Context --> DebugAgent["Debugger Agent Diagnoses Root Cause"]
    DebugAgent --> Patch["Generate Targeted Patch"]
    Patch --> Verify["Re-run Code Pipeline & Verification"]
    Verify -->|Pass| Success["Proceed to Next Step"]
    Verify -->|Fail & Retries < Max| DebugAgent
    Verify -->|Fail & Max Retries| Report["Report Explainable Error to User"]
```

---

## 📑 Configuration

Set maximum retry attempts in `.hurdler/config.json`:

```json
{
  "code": {
    "maxDebuggerRetries": 3
  }
}
```

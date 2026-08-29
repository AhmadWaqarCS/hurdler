# Branch Management

Hurdler automatically manages isolated feature branches for agent tasks, preventing working-tree collisions.

---

## 💻 CLI Commands

```bash
# List all branches
hurdler git branch

# Create a new feature branch
hurdler git branch create feat-jwt-auth

# Switch branches
hurdler git branch switch feat-jwt-auth
```

---

## 📑 Programmatic API Reference

### `createFeatureBranch(featureName: string): Promise<string>`

```typescript
import { createFeatureBranch, checkoutBranch } from 'hurdler';

const branchName = await createFeatureBranch('auth-validation');
// Creates and checks out branch 'hurdler/feat-auth-validation'
```

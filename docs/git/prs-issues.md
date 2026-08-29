# Pull Requests & Issues

Hurdler tracks pull requests and task issues locally and via remote Git providers.

---

## 💻 CLI Commands

```bash
# List open PRs
hurdler git pr list

# Create a PR for the current branch
hurdler git pr create --title "feat: implement rate limiter" --body "Added token bucket rate limiting"

# Merge a PR
hurdler git pr merge 1 --delete-branch
```

---

## 📑 Programmatic API Reference

### `createPullRequest(options: CreatePROptions): Promise<PullRequestRecord>`

```typescript
import { createPullRequest } from 'hurdler';

const pr = await createPullRequest({
  title: 'feat: add rate limiter',
  sourceBranch: 'hurdler/feat-rate-limiter',
  targetBranch: 'main'
});
```

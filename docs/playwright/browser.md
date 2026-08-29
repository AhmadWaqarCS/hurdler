# Playwright Browser Management

The **Playwright Subsystem** manages headless Chromium, Firefox, and WebKit browser lifecycles for visual multimodal reasoning and automated testing.

---

## 💻 CLI Commands

```bash
# Capture full-page screenshot
hurdler ui screenshot http://localhost:3000 --output screenshot.png

# Inspect DOM interactive elements
hurdler ui inspect http://localhost:3000

# Capture browser console errors
hurdler ui console http://localhost:3000
```

---

## 📑 Programmatic API Reference

### `launchBrowserSession(options?: BrowserOptions): Promise<BrowserSession>`

```typescript
import { launchBrowserSession, closeBrowserSession } from 'hurdler';

const session = await launchBrowserSession({ headless: true });
await session.page.goto('http://localhost:3000');
await closeBrowserSession(session);
```

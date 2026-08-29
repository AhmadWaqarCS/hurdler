# Visual Assertions & Screenshots

Hurdler enables agents to visually inspect web pages, assert element visibility, and verify UI changes before committing code.

---

## 📑 Programmatic API Reference

### `captureScreenshot(url: string, options?: ScreenshotOptions): Promise<Buffer>`

```typescript
import { captureScreenshot } from 'hurdler';

const imageBuffer = await captureScreenshot('http://localhost:3000', {
  fullPage: true,
  outputPath: 'artifacts/login.png'
});
```

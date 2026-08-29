# Multimodal UI Context

Hurdler captures compressed DOM snapshots, interactive element bounding boxes, and console errors into a structured context bundle for multimodal LLMs.

---

## 📑 Programmatic API Reference

### `captureUIContext(url: string): Promise<UIContextBundle>`

```typescript
import { captureUIContext } from 'hurdler';

const uiContext = await captureUIContext('http://localhost:3000');
console.log('Interactive Elements:', uiContext.elements.length);
console.log('Console Errors:', uiContext.consoleErrors);
```

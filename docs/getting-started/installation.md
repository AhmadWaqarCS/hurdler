# Installation Guide

You can install and use **Hurdler** either as a global terminal CLI or as an imported Node.js / TypeScript package.

---

## 📋 System Requirements

- **Node.js**: `v20.0.0` or higher
- **Package Manager**: `npm`, `pnpm`, or `yarn`
- **Git**: `git` installed and available on your system `PATH`
- **Optional**: Playwright browser dependencies (for UI multimodal testing)

---

## 🌐 Global CLI Installation

To use `hurdler` directly from your command line:

```bash
npm install -g hurdler
```

Verify your installation:

```bash
hurdler --version
hurdler --help
```

---

## 📦 Project / Local Installation

To embed Hurdler directly into your Node.js or TypeScript backend / toolchain:

```bash
npm install hurdler
```

### TypeScript Configuration

Ensure your `tsconfig.json` has `moduleResolution` configured for modern ESM:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

---

## 🔑 Environment Variables & Provider Keys

Hurdler automatically loads keys from `.env` or `.env.local` in your project root:

```bash
# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini / Vertex
GEMINI_API_KEY=AIzaSy...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/vertex-service-account.json

# OpenAI Compatible
OPENAI_API_KEY=sk-...
```

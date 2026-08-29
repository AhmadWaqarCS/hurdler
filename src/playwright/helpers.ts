import fs from 'node:fs/promises';
import path from 'node:path';
import { PlaywrightEngineError } from './errors.js';
import type { ScreenshotFormat } from './types.js';

/**
 * Validates and sanitizes a URL for navigation.
 * Allows http, https, file, and data URI schemes.
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new PlaywrightEngineError('Target URL must be a non-empty string');
  }

  const trimmed = url.trim();

  // Allow data: URLs for testing/mocking HTML directly
  if (trimmed.startsWith('data:text/html') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Allow file: URLs
  if (trimmed.startsWith('file://')) {
    return trimmed;
  }

  // Allow standard relative localhost URLs or prepend http://
  if (trimmed.startsWith('localhost:') || trimmed.startsWith('127.0.0.1:')) {
    return `http://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = ['http:', 'https:', 'file:', 'data:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new PlaywrightEngineError(`Disallowed URL protocol: ${parsed.protocol}`);
    }
    return parsed.toString();
  } catch (err: unknown) {
    if (err instanceof PlaywrightEngineError) throw err;
    // If it is a relative path or invalid URL, check if it's a relative path starting with /
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    throw new PlaywrightEngineError(`Invalid URL string: '${url}'`, { cause: err });
  }
}

/**
 * Creates a filesystem-safe filename for screenshot artifacts.
 */
export function sanitizeFilename(name?: string, prefix = 'screenshot', ext = 'jpg'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (!name || typeof name !== 'string') {
    return `${prefix}-${timestamp}.${ext}`;
  }
  const clean = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `${prefix}-${clean}-${timestamp}.${ext}`;
}

/**
 * Ensures the screenshot artifact storage directory exists in the workspace.
 */
export async function ensureScreenshotDir(projectRoot?: string): Promise<string> {
  const root = projectRoot ?? process.cwd();
  const dir = path.join(root, '.hurdler', 'artifacts', 'screenshots');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Formats a raw base64 string into a standard data URL.
 */
export function formatDataUrl(base64: string, format: ScreenshotFormat = 'jpeg'): string {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Cleans and truncates rendered HTML to prevent overwhelming LLM context windows.
 * Removes heavy inline SVG paths and embedded base64 data strings.
 */
export function cleanAndTruncateHtml(html: string, maxChars = 15000): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let cleaned = html
    // Replace giant base64 image src with placeholder
    .replace(/src="data:image\/[^;]+;base64,[^"]+"/gi, 'src="data:image/...[base64 omitted]"')
    // Simplify long SVG inner paths
    .replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi, (match, attrs) => {
      if (match.length > 500) {
        return `<svg ${attrs}><!-- SVG paths omitted for brevity --></svg>`;
      }
      return match;
    })
    // Condense repeated whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > maxChars) {
    cleaned = `${cleaned.slice(0, maxChars)}\n<!-- ... [HTML truncated to fit context limits] -->`;
  }

  return cleaned;
}

/**
 * Summarizes visible text extracted from a webpage for prompt injection.
 */
export function summarizeRenderedText(text: string, maxChars = 2500): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const condensed = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  if (condensed.length > maxChars) {
    return `${condensed.slice(0, maxChars)}\n... [Text truncated]`;
  }

  return condensed;
}

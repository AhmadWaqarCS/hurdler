import fs from 'node:fs/promises';
import path from 'node:path';
import {
  devInfo,
  devDebug,
  devWarn,
} from '../core/dev-mode/index.js';
import { defaultMapperService } from '../mapper/service.js';
import {
  launchBrowser,
  createPageSession,
  navigateTo,
  takeScreenshot,
  inspectPage,
} from './engine.js';
import type {
  UIContextPacket,
  SourceCodeCorrelation,
  BrowserLaunchOptions,
} from './types.js';

export interface BuildUIContextOptions {
  url: string;
  sourceFilePath?: string;
  waitForSelector?: string;
  waitForTimeoutMs?: number;
  screenshotQuality?: number;
  fullPage?: boolean;
  projectRoot?: string;
  launchOptions?: BrowserLaunchOptions;
}

/**
 * Builds a comprehensive multimodal UI context packet containing:
 * 1. Compressed JPEG screenshot (base64 data URL + file path)
 * 2. Rendered DOM HTML snapshot (sanitized and trimmed)
 * 3. Correlated source code component / route file from Mapper
 * 4. Runtime console and network errors
 */
export async function buildUIContext(options: BuildUIContextOptions): Promise<UIContextPacket> {
  const projectRoot = options.projectRoot ?? process.cwd();
  devInfo('PLAYWRIGHT', `Building multimodal UI context for URL: ${options.url}`);

  const browser = await launchBrowser(options.launchOptions);
  const { context, page, consoleErrors, networkErrors } = await createPageSession(
    browser,
    options.launchOptions
  );

  try {
    await navigateTo(page, options.url, {
      waitForSelector: options.waitForSelector,
      waitForTimeoutMs: options.waitForTimeoutMs,
      timeoutMs: options.launchOptions?.timeoutMs ?? 30000,
    });

    const inspection = await inspectPage(page, {
      captureScreenshot: true,
      screenshotQuality: options.screenshotQuality ?? 75,
      fullPageScreenshot: options.fullPage ?? false,
      projectRoot,
    });

    if (!inspection.screenshot) {
      throw new Error('Screenshot capture failed during UI context construction');
    }

    // Correlate with source code file
    const sourceCorrelation = await resolveSourceCorrelation(
      options.url,
      options.sourceFilePath,
      projectRoot
    );

    const summary = [
      `### UI Visual Context: ${inspection.title || options.url}`,
      `- **URL**: ${options.url}`,
      `- **Viewport**: ${inspection.viewport.width}x${inspection.viewport.height}`,
      `- **Screenshot**: JPEG (Quality ${inspection.screenshot.quality}%, ${inspection.screenshot.sizeBytes} bytes)`,
      `- **Console Errors**: ${consoleErrors.length}`,
      `- **Network Errors**: ${networkErrors.length}`,
      sourceCorrelation ? `- **Correlated Source**: \`${sourceCorrelation.filePath}\` (${sourceCorrelation.category || 'component'})` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      url: options.url,
      title: inspection.title,
      screenshot: inspection.screenshot,
      renderedHtml: inspection.html,
      renderedTextSummary: inspection.renderedText,
      sourceCode: sourceCorrelation,
      consoleErrors,
      networkErrors,
      viewport: inspection.viewport,
      capturedAt: new Date().toISOString(),
      summary,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Resolves source code file correlation for a given page URL or explicit path.
 */
async function resolveSourceCorrelation(
  url: string,
  explicitPath?: string,
  projectRoot: string = process.cwd()
): Promise<SourceCodeCorrelation | undefined> {
  try {
    if (explicitPath) {
      const fullPath = path.isAbsolute(explicitPath)
        ? explicitPath
        : path.join(projectRoot, explicitPath);
      const relativePath = path.relative(projectRoot, fullPath);

      const fileMap = defaultMapperService.getFileMap(relativePath);
      let snippet: string | undefined;

      try {
        const rawContent = await fs.readFile(fullPath, 'utf8');
        // Grab first 80 lines for context
        snippet = rawContent.split('\n').slice(0, 80).join('\n');
      } catch {
        // ignore file read error if non-existent
      }

      return {
        filePath: relativePath,
        category: fileMap?.category,
        symbols: fileMap?.symbols.map((s: { name: string }) => s.name),
        snippet,
      };
    }

    // Try inferring from URL path
    const parsed = new URL(url.startsWith('http') || url.startsWith('data:') ? url : `http://localhost:3000${url}`);
    const pathname = parsed.pathname;

    // Search codebase map for matching route/page files
    const queryResults = defaultMapperService.query({
      query: pathname === '/' ? 'page' : pathname.replace(/^\//, ''),
      limit: 5,
    });

    if (queryResults.files.length > 0) {
      const matched = queryResults.files[0];
      const fullPath = path.join(projectRoot, matched.filePath);
      let snippet: string | undefined;

      try {
        const rawContent = await fs.readFile(fullPath, 'utf8');
        snippet = rawContent.split('\n').slice(0, 80).join('\n');
      } catch {
        // ignore
      }

      return {
        filePath: matched.filePath,
        category: matched.category,
        symbols: matched.symbols.map((s: { name: string }) => s.name),
        snippet,
      };
    }
  } catch (err) {
    devWarn('PLAYWRIGHT', `Source code correlation failed for URL '${url}': ${err}`);
  }

  return undefined;
}

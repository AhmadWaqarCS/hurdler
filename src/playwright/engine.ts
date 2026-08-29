import fs from 'node:fs/promises';
import path from 'node:path';
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import {
  devDebug,
  devInfo,
  devWarn,
  devError,
  isDevMode,
} from '../core/dev-mode/index.js';
import {
  PlaywrightEngineError,
  PlaywrightLaunchError,
  PlaywrightNavigationError,
  PlaywrightActionError,
  PlaywrightAssertionError,
  PlaywrightTimeoutError,
} from './errors.js';
import {
  sanitizeUrl,
  sanitizeFilename,
  ensureScreenshotDir,
  formatDataUrl,
  cleanAndTruncateHtml,
  summarizeRenderedText,
} from './helpers.js';
import type {
  BrowserEngineType,
  BrowserLaunchOptions,
  ScreenshotOptions,
  ScreenshotResult,
  BrowserAction,
  BrowserActionResult,
  ConsoleMessageRecord,
  NetworkErrorRecord,
  PageInspectionData,
  PlaywrightTestCase,
  TestCaseResult,
  PlaywrightTestSuite,
  TestSuiteResult,
  ViewportSize,
} from './types.js';

// Cache active browser instances for lifecycle management
const activeBrowsers: Set<Browser> = new Set();

/**
 * Registers process termination hooks to clean up browser processes gracefully.
 */
let cleanupHookRegistered = false;
function registerCleanupHook(): void {
  if (cleanupHookRegistered) return;
  cleanupHookRegistered = true;

  const cleanup = async () => {
    for (const browser of activeBrowsers) {
      try {
        await browser.close();
      } catch {
        // ignore errors during process teardown
      }
    }
    activeBrowsers.clear();
  };

  process.once('beforeExit', cleanup);
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
}

/**
 * Launches a Playwright browser instance with configured options.
 */
export async function launchBrowser(options: BrowserLaunchOptions = {}): Promise<Browser> {
  registerCleanupHook();

  const browserType: BrowserEngineType = options.browserType ?? 'chromium';
  const headless = options.headless !== false;
  const timeoutMs = options.timeoutMs ?? 30000;

  devDebug('PLAYWRIGHT', `Launching browser engine: ${browserType} (headless: ${headless})`);

  try {
    let launcher;
    switch (browserType) {
      case 'firefox':
        launcher = firefox;
        break;
      case 'webkit':
        launcher = webkit;
        break;
      case 'chromium':
      default:
        launcher = chromium;
        break;
    }

    const browser = await launcher.launch({
      headless,
      timeout: timeoutMs,
      slowMo: options.slowMo,
      args: browserType === 'chromium' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [],
    });

    activeBrowsers.add(browser);
    devInfo('PLAYWRIGHT', `Successfully launched ${browserType} browser instance`);
    return browser;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    devError('PLAYWRIGHT', `Failed to launch ${browserType} browser: ${errorMsg}`);
    throw new PlaywrightLaunchError(`Failed to launch browser [${browserType}]: ${errorMsg}`, {
      cause: err,
    });
  }
}

/**
 * Creates an isolated browser context and page session with console and network listeners.
 */
export async function createPageSession(
  browser: Browser,
  options: BrowserLaunchOptions = {}
): Promise<{
  context: BrowserContext;
  page: Page;
  consoleLogs: ConsoleMessageRecord[];
  consoleErrors: ConsoleMessageRecord[];
  networkErrors: NetworkErrorRecord[];
}> {
  const viewport: ViewportSize = options.viewport ?? { width: 1280, height: 720 };
  const context = await browser.newContext({
    viewport,
    userAgent: options.userAgent,
    deviceScaleFactor: options.deviceScaleFactor ?? 1,
    extraHTTPHeaders: options.extraHTTPHeaders,
    ignoreHTTPSErrors: options.ignoreHTTPSErrors ?? false,
  });

  const page = await context.newPage();
  const consoleLogs: ConsoleMessageRecord[] = [];
  const consoleErrors: ConsoleMessageRecord[] = [];
  const networkErrors: NetworkErrorRecord[] = [];

  // Capture console events
  page.on('console', (msg) => {
    const type = msg.type() as ConsoleMessageRecord['type'];
    const text = msg.text();
    const location = msg.location();
    const record: ConsoleMessageRecord = {
      type: ['log', 'debug', 'info', 'warn', 'error'].includes(type) ? type : 'log',
      text,
      location: location ? { url: location.url, lineNumber: location.lineNumber, columnNumber: location.columnNumber } : undefined,
      timestamp: new Date().toISOString(),
    };

    consoleLogs.push(record);
    if (type === 'error' || type === 'warn') {
      consoleErrors.push(record);
      devWarn('PLAYWRIGHT', `Page console ${type}: ${text}`);
    }
  });

  // Capture unhandled page errors
  page.on('pageerror', (err) => {
    const record: ConsoleMessageRecord = {
      type: 'error',
      text: err.message || String(err),
      location: { url: page.url() },
      timestamp: new Date().toISOString(),
    };
    consoleErrors.push(record);
    devError('PLAYWRIGHT', `Page unhandled error: ${err.message}`);
  });

  // Capture network request failures
  page.on('requestfailed', (req) => {
    const record: NetworkErrorRecord = {
      url: req.url(),
      method: req.method(),
      errorText: req.failure()?.errorText || 'Unknown request failure',
      timestamp: new Date().toISOString(),
    };
    networkErrors.push(record);
    devWarn('PLAYWRIGHT', `Network request failed: ${req.method()} ${req.url()} (${record.errorText})`);
  });

  // Capture HTTP error responses
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const record: NetworkErrorRecord = {
        url: res.url(),
        method: res.request().method(),
        status: res.status(),
        statusText: res.statusText(),
        timestamp: new Date().toISOString(),
      };
      networkErrors.push(record);
      devWarn('PLAYWRIGHT', `HTTP Error ${res.status()} ${res.statusText()} on ${res.url()}`);
    }
  });

  return { context, page, consoleLogs, consoleErrors, networkErrors };
}

/**
 * Captures a JPEG compressed screenshot from a Playwright page.
 * Compresses to JPEG format (default quality: 75) to save LLM tokens and costs.
 */
export async function takeScreenshot(
  page: Page,
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  const format = options.format ?? 'jpeg';
  const quality = format === 'jpeg' ? (options.quality ?? 75) : undefined;
  const fullPage = options.fullPage ?? false;
  const projectRoot = options.projectRoot ?? process.cwd();

  devDebug('PLAYWRIGHT', `Taking ${format.toUpperCase()} screenshot (quality: ${quality ?? 'N/A'}, fullPage: ${fullPage})`);

  let buffer: Buffer;
  let width = 1280;
  let height = 720;

  try {
    const vp = page.viewportSize();
    if (vp) {
      width = vp.width;
      height = vp.height;
    }

    if (options.selector) {
      const locator = page.locator(options.selector).first();
      const count = await locator.count();
      if (count === 0) {
        throw new PlaywrightActionError(`Element matching selector '${options.selector}' not found for screenshot`);
      }
      const box = await locator.boundingBox();
      if (box) {
        width = Math.round(box.width);
        height = Math.round(box.height);
      }
      buffer = await locator.screenshot({
        type: format,
        quality,
      });
    } else {
      buffer = await page.screenshot({
        type: format,
        quality,
        fullPage,
        clip: options.clip,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    devError('PLAYWRIGHT', `Screenshot capture failed: ${errorMsg}`);
    throw new PlaywrightEngineError(`Screenshot capture failed: ${errorMsg}`, { cause: err });
  }

  const base64 = buffer.toString('base64');
  const dataUrl = formatDataUrl(base64, format);
  const sizeBytes = buffer.length;
  const capturedAt = new Date().toISOString();

  let savedPath: string | undefined;

  if (options.saveArtifact !== false || options.path) {
    try {
      if (options.path) {
        savedPath = path.isAbsolute(options.path)
          ? options.path
          : path.join(projectRoot, options.path);
        await fs.mkdir(path.dirname(savedPath), { recursive: true });
      } else {
        const dir = await ensureScreenshotDir(projectRoot);
        const filename = sanitizeFilename(options.name, 'screenshot', format === 'jpeg' ? 'jpg' : 'png');
        savedPath = path.join(dir, filename);
      }

      await fs.writeFile(savedPath, buffer);
      devInfo('PLAYWRIGHT', `Screenshot saved to disk: ${savedPath} (${sizeBytes} bytes, quality: ${quality ?? 100})`);
    } catch (saveErr) {
      devWarn('PLAYWRIGHT', `Failed to write screenshot to disk: ${saveErr}`);
    }
  }

  return {
    path: savedPath,
    format,
    quality: quality ?? 100,
    base64,
    dataUrl,
    sizeBytes,
    width,
    height,
    capturedAt,
  };
}

/**
 * Safely navigates to a URL, optionally waiting for network idle or selector.
 */
export async function navigateTo(
  page: Page,
  url: string,
  options: {
    timeoutMs?: number;
    waitForSelector?: string;
    waitForTimeoutMs?: number;
  } = {}
): Promise<void> {
  const targetUrl = sanitizeUrl(url);
  const timeoutMs = options.timeoutMs ?? 30000;

  devDebug('PLAYWRIGHT', `Navigating to ${targetUrl} (timeout: ${timeoutMs}ms)`);

  try {
    await page.goto(targetUrl, {
      timeout: timeoutMs,
      waitUntil: 'load',
    });

    if (options.waitForSelector) {
      devDebug('PLAYWRIGHT', `Waiting for selector: ${options.waitForSelector}`);
      await page.waitForSelector(options.waitForSelector, {
        timeout: timeoutMs,
        state: 'visible',
      });
    }

    if (options.waitForTimeoutMs && options.waitForTimeoutMs > 0) {
      await page.waitForTimeout(options.waitForTimeoutMs);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    devError('PLAYWRIGHT', `Navigation to '${targetUrl}' failed: ${errorMsg}`);
    throw new PlaywrightNavigationError(`Navigation to '${targetUrl}' failed: ${errorMsg}`, {
      url: targetUrl,
      cause: err,
    });
  }
}

/**
 * Extracts complete page inspection data: title, rendered HTML, visible text, console logs, network errors, and screenshot.
 */
export async function inspectPage(
  page: Page,
  options: {
    waitForSelector?: string;
    waitForTimeoutMs?: number;
    captureScreenshot?: boolean;
    screenshotQuality?: number;
    fullPageScreenshot?: boolean;
    maxHtmlChars?: number;
    projectRoot?: string;
    consoleLogs?: ConsoleMessageRecord[];
    consoleErrors?: ConsoleMessageRecord[];
    networkErrors?: NetworkErrorRecord[];
  } = {}
): Promise<PageInspectionData> {
  const url = page.url();
  devDebug('PLAYWRIGHT', `Inspecting page at ${url}`);

  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, { state: 'visible', timeout: 15000 });
  }
  if (options.waitForTimeoutMs && options.waitForTimeoutMs > 0) {
    await page.waitForTimeout(options.waitForTimeoutMs);
  }

  const title = await page.title();
  const rawHtml = await page.content();
  const html = cleanAndTruncateHtml(rawHtml, options.maxHtmlChars ?? 15000);

  const rawText = await page.evaluate(() => {
    const doc = (globalThis as unknown as { document?: { body?: { innerText?: string } } }).document;
    return doc?.body?.innerText || '';
  });
  const renderedText = summarizeRenderedText(rawText);

  const vp = page.viewportSize() ?? { width: 1280, height: 720 };

  let screenshot: ScreenshotResult | undefined;
  if (options.captureScreenshot !== false) {
    screenshot = await takeScreenshot(page, {
      format: 'jpeg',
      quality: options.screenshotQuality ?? 75,
      fullPage: options.fullPageScreenshot ?? false,
      projectRoot: options.projectRoot,
      name: 'inspect',
    });
  }

  return {
    url,
    title,
    html,
    renderedText,
    viewport: vp,
    consoleLogs: options.consoleLogs ?? [],
    consoleErrors: options.consoleErrors ?? [],
    networkErrors: options.networkErrors ?? [],
    screenshot,
    inspectedAt: new Date().toISOString(),
  };
}

/**
 * Executes a single browser action against the page.
 */
export async function executeAction(
  page: Page,
  action: BrowserAction,
  actionIndex = 0,
  projectRoot?: string
): Promise<BrowserActionResult> {
  const startTime = Date.now();
  devDebug('PLAYWRIGHT', `Executing action [${actionIndex}] '${action.type}': ${action.description || action.selector || action.url || ''}`);

  try {
    let evaluationResult: unknown;
    let screenshot: ScreenshotResult | undefined;
    const timeout = action.timeoutMs ?? 15000;

    switch (action.type) {
      case 'goto': {
        if (!action.url) throw new PlaywrightActionError("'goto' action requires 'url' parameter");
        await navigateTo(page, action.url, { timeoutMs: timeout });
        break;
      }

      case 'click': {
        if (!action.selector) throw new PlaywrightActionError("'click' action requires 'selector'");
        await page.click(action.selector, { timeout });
        break;
      }

      case 'dblclick': {
        if (!action.selector) throw new PlaywrightActionError("'dblclick' action requires 'selector'");
        await page.dblclick(action.selector, { timeout });
        break;
      }

      case 'fill': {
        if (!action.selector) throw new PlaywrightActionError("'fill' action requires 'selector'");
        const val = action.value !== undefined ? String(action.value) : '';
        await page.fill(action.selector, val, { timeout });
        break;
      }

      case 'type': {
        if (!action.selector) throw new PlaywrightActionError("'type' action requires 'selector'");
        const val = action.value !== undefined ? String(action.value) : '';
        await page.type(action.selector, val, { timeout });
        break;
      }

      case 'press': {
        const key = action.key || (action.value ? String(action.value) : 'Enter');
        if (action.selector) {
          await page.press(action.selector, key, { timeout });
        } else {
          await page.keyboard.press(key);
        }
        break;
      }

      case 'select': {
        if (!action.selector) throw new PlaywrightActionError("'select' action requires 'selector'");
        const opt = Array.isArray(action.value)
          ? action.value.map(String)
          : String(action.value ?? '');
        await page.selectOption(action.selector, opt, { timeout });
        break;
      }

      case 'check': {
        if (!action.selector) throw new PlaywrightActionError("'check' action requires 'selector'");
        await page.check(action.selector, { timeout });
        break;
      }

      case 'uncheck': {
        if (!action.selector) throw new PlaywrightActionError("'uncheck' action requires 'selector'");
        await page.uncheck(action.selector, { timeout });
        break;
      }

      case 'hover': {
        if (!action.selector) throw new PlaywrightActionError("'hover' action requires 'selector'");
        await page.hover(action.selector, { timeout });
        break;
      }

      case 'scroll': {
        if (action.selector) {
          await page.locator(action.selector).first().scrollIntoViewIfNeeded({ timeout });
        } else if (typeof action.value === 'number') {
          await page.evaluate((y) => {
            (globalThis as unknown as { scrollBy: (x: number, y: number) => void }).scrollBy(0, y);
          }, action.value);
        } else {
          await page.evaluate(() => {
            (globalThis as unknown as { scrollBy: (x: number, y: number) => void }).scrollBy(0, 500);
          });
        }
        break;
      }

      case 'wait_for_selector': {
        if (!action.selector) throw new PlaywrightActionError("'wait_for_selector' action requires 'selector'");
        await page.waitForSelector(action.selector, { timeout, state: 'visible' });
        break;
      }

      case 'wait_for_timeout': {
        const ms = typeof action.value === 'number' ? action.value : (action.timeoutMs ?? 1000);
        await page.waitForTimeout(ms);
        break;
      }

      case 'wait_for_load_state': {
        const state = (typeof action.value === 'string' ? action.value : 'networkidle') as 'load' | 'domcontentloaded' | 'networkidle';
        await page.waitForLoadState(state, { timeout });
        break;
      }

      case 'evaluate': {
        if (!action.script) throw new PlaywrightActionError("'evaluate' action requires 'script'");
        evaluationResult = await page.evaluate((script) => {
          // eslint-disable-next-line no-eval
          return (0, eval)(script);
        }, action.script);
        break;
      }

      case 'screenshot': {
        screenshot = await takeScreenshot(page, {
          format: 'jpeg',
          quality: action.screenshotQuality ?? 75,
          selector: action.selector,
          name: action.screenshotName || `action-${actionIndex}`,
          projectRoot,
        });
        break;
      }

      case 'assert_text': {
        if (!action.selector) throw new PlaywrightActionError("'assert_text' requires 'selector'");
        const element = page.locator(action.selector).first();
        await element.waitFor({ state: 'visible', timeout });
        const text = (await element.textContent()) || '';
        const expected = action.expected !== undefined ? String(action.expected) : String(action.value ?? '');
        if (!text.includes(expected)) {
          throw new PlaywrightAssertionError(
            `Text assertion failed on '${action.selector}': expected to include '${expected}', got '${text.trim()}'`,
            { expected, actual: text.trim() }
          );
        }
        break;
      }

      case 'assert_visible': {
        if (!action.selector) throw new PlaywrightActionError("'assert_visible' requires 'selector'");
        const isVisible = await page.locator(action.selector).first().isVisible({ timeout });
        if (!isVisible) {
          throw new PlaywrightAssertionError(`Element '${action.selector}' is not visible`);
        }
        break;
      }

      case 'assert_url': {
        const current = page.url();
        const expected = action.expected !== undefined ? String(action.expected) : String(action.value ?? '');
        if (!current.includes(expected)) {
          throw new PlaywrightAssertionError(`URL assertion failed: expected '${expected}', got '${current}'`, {
            expected,
            actual: current,
          });
        }
        break;
      }

      case 'assert_title': {
        const currentTitle = await page.title();
        const expected = action.expected !== undefined ? String(action.expected) : String(action.value ?? '');
        if (!currentTitle.includes(expected)) {
          throw new PlaywrightAssertionError(`Title assertion failed: expected '${expected}', got '${currentTitle}'`, {
            expected,
            actual: currentTitle,
          });
        }
        break;
      }

      default:
        throw new PlaywrightActionError(`Unsupported action type: '${action.type}'`);
    }

    const durationMs = Date.now() - startTime;
    return {
      actionIndex,
      actionType: action.type,
      description: action.description,
      success: true,
      durationMs,
      screenshot,
      evaluationResult,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    devWarn('PLAYWRIGHT', `Action [${actionIndex}] '${action.type}' failed: ${errorMsg}`);

    if (action.optional) {
      return {
        actionIndex,
        actionType: action.type,
        description: action.description,
        success: false,
        durationMs,
        error: errorMsg,
      };
    }

    throw new PlaywrightActionError(`Action [${actionIndex}] '${action.type}' failed: ${errorMsg}`, {
      actionType: action.type,
      selector: action.selector,
      cause: err,
    });
  }
}

/**
 * Executes an ordered sequence of browser actions.
 */
export async function executeActions(
  page: Page,
  actions: BrowserAction[],
  projectRoot?: string
): Promise<BrowserActionResult[]> {
  const results: BrowserActionResult[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    try {
      const result = await executeAction(page, action, i, projectRoot);
      results.push(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        actionIndex: i,
        actionType: action.type,
        description: action.description,
        success: false,
        durationMs: 0,
        error: errorMsg,
      });
      break; // Abort further actions on failure
    }
  }

  return results;
}

/**
 * Runs a single Playwright test case from start to finish.
 */
export async function runPlaywrightTestCase(
  browser: Browser,
  testCase: PlaywrightTestCase,
  options: {
    baseUrl?: string;
    projectRoot?: string;
    launchOptions?: BrowserLaunchOptions;
  } = {}
): Promise<TestCaseResult> {
  const startTime = Date.now();
  devInfo('PLAYWRIGHT', `Running test case: '${testCase.title}' (ID: ${testCase.id})`);

  const { context, page, consoleErrors, networkErrors } = await createPageSession(
    browser,
    options.launchOptions
  );

  let passed = true;
  let failureReason: string | undefined;
  let failureScreenshot: ScreenshotResult | undefined;
  let stepResults: BrowserActionResult[] = [];

  try {
    // Initial navigation if URL provided
    if (testCase.url) {
      const fullUrl = options.baseUrl && !testCase.url.startsWith('http') && !testCase.url.startsWith('data:')
        ? `${options.baseUrl.replace(/\/$/, '')}/${testCase.url.replace(/^\//, '')}`
        : testCase.url;
      await navigateTo(page, fullUrl, { timeoutMs: testCase.timeoutMs ?? 30000 });
    }

    stepResults = await executeActions(page, testCase.actions, options.projectRoot);

    const failedStep = stepResults.find((s) => !s.success);
    if (failedStep) {
      passed = false;
      failureReason = failedStep.error || `Step ${failedStep.actionIndex} (${failedStep.actionType}) failed`;
    }
  } catch (err: unknown) {
    passed = false;
    failureReason = err instanceof Error ? err.message : String(err);
    devError('PLAYWRIGHT', `Test case '${testCase.id}' failed: ${failureReason}`);
  }

  if (!passed) {
    try {
      failureScreenshot = await takeScreenshot(page, {
        format: 'jpeg',
        quality: 70,
        name: `failure-${testCase.id}`,
        projectRoot: options.projectRoot,
      });
    } catch {
      // ignore screenshot capture errors during failure reporting
    }
  }

  await context.close();
  const durationMs = Date.now() - startTime;

  return {
    testId: testCase.id,
    title: testCase.title,
    passed,
    durationMs,
    stepResults,
    failureReason,
    failureScreenshot,
    consoleErrors,
    networkErrors,
  };
}

/**
 * Runs a complete Playwright test suite and produces a comprehensive report.
 */
export async function runPlaywrightTestSuite(
  testSuite: PlaywrightTestSuite,
  projectRoot?: string
): Promise<TestSuiteResult> {
  const startTime = Date.now();
  devInfo('PLAYWRIGHT', `Starting test suite execution: '${testSuite.title}' (${testSuite.tests.length} tests)`);

  const browser = await launchBrowser(testSuite.launchOptions);
  const results: TestCaseResult[] = [];

  try {
    for (const testCase of testSuite.tests) {
      const testResult = await runPlaywrightTestCase(browser, testCase, {
        baseUrl: testSuite.baseUrl,
        projectRoot,
        launchOptions: testSuite.launchOptions,
      });
      results.push(testResult);
    }
  } finally {
    await browser.close();
    activeBrowsers.delete(browser);
  }

  const totalDurationMs = Date.now() - startTime;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.length - passedTests;
  const summary = `Suite '${testSuite.title}': ${passedTests}/${results.length} passed (${failedTests} failed) in ${totalDurationMs}ms.`;

  devInfo('PLAYWRIGHT', summary);

  return {
    suiteId: testSuite.id,
    title: testSuite.title,
    totalTests: results.length,
    passedTests,
    failedTests,
    totalDurationMs,
    results,
    executedAt: new Date().toISOString(),
    summary,
  };
}

/**
 * Closes all running browser instances.
 */
export async function closeAllBrowsers(): Promise<void> {
  for (const browser of activeBrowsers) {
    try {
      await browser.close();
    } catch {
      // ignore close errors
    }
  }
  activeBrowsers.clear();
}

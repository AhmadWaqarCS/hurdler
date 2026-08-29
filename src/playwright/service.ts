import {
  launchBrowser,
  createPageSession,
  navigateTo,
  takeScreenshot,
  inspectPage,
  executeActions,
  runPlaywrightTestSuite,
  closeAllBrowsers,
} from './engine.js';
import { buildUIContext } from './ui-context.js';
import { devInfo, devDebug } from '../core/dev-mode/index.js';
import type {
  BrowserLaunchOptions,
  ScreenshotOptions,
  ScreenshotResult,
  BrowserAction,
  BrowserActionResult,
  PageInspectionData,
  UIContextPacket,
  PlaywrightTestCase,
  PlaywrightTestSuite,
  TestSuiteResult,
} from './types.js';

/**
 * High-level orchestration service for the Hurdler Playwright testing subsystem.
 */
export class PlaywrightService {
  /**
   * Navigates to a URL and captures a compressed JPEG screenshot.
   */
  async navigateAndScreenshot(
    url: string,
    screenshotOptions: ScreenshotOptions = {},
    launchOptions: BrowserLaunchOptions = {}
  ): Promise<{
    screenshot: ScreenshotResult;
    title: string;
    url: string;
    consoleErrors: number;
    networkErrors: number;
  }> {
    devInfo('PLAYWRIGHT', `Navigating and taking screenshot for: ${url}`);
    const browser = await launchBrowser(launchOptions);
    const { context, page, consoleErrors, networkErrors } = await createPageSession(
      browser,
      launchOptions
    );

    try {
      await navigateTo(page, url, {
        waitForSelector: screenshotOptions.selector,
        timeoutMs: launchOptions.timeoutMs ?? 30000,
      });

      const title = await page.title();
      const currentUrl = page.url();

      const screenshot = await takeScreenshot(page, {
        format: 'jpeg',
        quality: 75,
        ...screenshotOptions,
      });

      return {
        screenshot,
        title,
        url: currentUrl,
        consoleErrors: consoleErrors.length,
        networkErrors: networkErrors.length,
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  /**
   * Navigates to a page and extracts a full inspection report:
   * Rendered DOM HTML, visible text, console logs, network errors, and JPEG screenshot.
   */
  async inspectPage(
    url: string,
    options: {
      waitForSelector?: string;
      waitForTimeoutMs?: number;
      captureScreenshot?: boolean;
      screenshotQuality?: number;
      fullPageScreenshot?: boolean;
      maxHtmlChars?: number;
      projectRoot?: string;
      launchOptions?: BrowserLaunchOptions;
    } = {}
  ): Promise<PageInspectionData> {
    devInfo('PLAYWRIGHT', `Inspecting page at URL: ${url}`);
    const browser = await launchBrowser(options.launchOptions);
    const { context, page, consoleLogs, consoleErrors, networkErrors } =
      await createPageSession(browser, options.launchOptions);

    try {
      await navigateTo(page, url, {
        waitForSelector: options.waitForSelector,
        waitForTimeoutMs: options.waitForTimeoutMs,
        timeoutMs: options.launchOptions?.timeoutMs ?? 30000,
      });

      return await inspectPage(page, {
        ...options,
        consoleLogs,
        consoleErrors,
        networkErrors,
      });
    } finally {
      await context.close();
      await browser.close();
    }
  }

  /**
   * Navigates to a URL and runs an interactive sequence of browser actions.
   */
  async runActions(
    url: string,
    actions: BrowserAction[],
    options: {
      projectRoot?: string;
      launchOptions?: BrowserLaunchOptions;
    } = {}
  ): Promise<{
    url: string;
    title: string;
    success: boolean;
    stepResults: BrowserActionResult[];
    totalDurationMs: number;
    consoleErrors: number;
  }> {
    const startTime = Date.now();
    devInfo('PLAYWRIGHT', `Running ${actions.length} browser actions on: ${url}`);
    const browser = await launchBrowser(options.launchOptions);
    const { context, page, consoleErrors } = await createPageSession(
      browser,
      options.launchOptions
    );

    try {
      await navigateTo(page, url, {
        timeoutMs: options.launchOptions?.timeoutMs ?? 30000,
      });

      const stepResults = await executeActions(page, actions, options.projectRoot);
      const title = await page.title();
      const currentUrl = page.url();
      const success = stepResults.every((r) => r.success);
      const totalDurationMs = Date.now() - startTime;

      return {
        url: currentUrl,
        title,
        success,
        stepResults,
        totalDurationMs,
        consoleErrors: consoleErrors.length,
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  /**
   * Captures a multimodal UI Context packet (JPEG screenshot + rendered HTML + correlated source code).
   */
  async captureUIContext(options: {
    url: string;
    sourceFilePath?: string;
    waitForSelector?: string;
    waitForTimeoutMs?: number;
    screenshotQuality?: number;
    fullPage?: boolean;
    projectRoot?: string;
    launchOptions?: BrowserLaunchOptions;
  }): Promise<UIContextPacket> {
    return await buildUIContext(options);
  }

  /**
   * Executes a complete declarative test suite.
   */
  async runTestSuite(
    testSuite: PlaywrightTestSuite,
    projectRoot?: string
  ): Promise<TestSuiteResult> {
    return await runPlaywrightTestSuite(testSuite, projectRoot);
  }

  /**
   * Teardown helper to close all active browser processes.
   */
  async cleanup(): Promise<void> {
    devDebug('PLAYWRIGHT', 'Cleaning up all active Playwright browser sessions');
    await closeAllBrowsers();
  }
}

export const defaultPlaywrightService = new PlaywrightService();

import {
  PlaywrightTestCaseSchema,
  PlaywrightTestSuiteSchema,
  BrowserActionSchema,
} from './schema.js';

/**
 * Navigates to a URL and captures a compressed JPEG screenshot to minimize LLM token costs.
 *
 * @param url - Destination URL (e.g. 'http://localhost:3000/dashboard' or 'data:text/html,...').
 * @param screenshotOptions - Formatting, JPEG quality (1-100), full-page, element selector, and artifact path options.
 * @param launchOptions - Headless mode, viewport, timeout, and browser engine launch settings.
 * @returns Screenshot details including compressed JPEG base64 data URL, dimensions, and file path.
 *
 * @example
 * ```ts
 * const res = await navigateAndScreenshot('http://localhost:3000', { quality: 75 });
 * console.log(res.screenshot.dataUrl);
 * ```
 */
export async function navigateAndScreenshot(
  url: string,
  screenshotOptions?: ScreenshotOptions,
  launchOptions?: BrowserLaunchOptions
): Promise<{
  screenshot: ScreenshotResult;
  title: string;
  url: string;
  consoleErrors: number;
  networkErrors: number;
}> {
  return defaultPlaywrightService.navigateAndScreenshot(url, screenshotOptions, launchOptions);
}

/**
 * Inspects a web page, returning rendered DOM HTML snapshot, visible text summary, console logs, network errors, and screenshot.
 *
 * @param url - Destination web page URL to inspect.
 * @param options - Inspection configuration (selector wait, timeout, screenshot quality, HTML character limits).
 * @returns Comprehensive page inspection data structure.
 *
 * @example
 * ```ts
 * const inspection = await inspectWebPage('http://localhost:3000/login');
 * console.log(inspection.renderedText, inspection.consoleErrors);
 * ```
 */
export async function inspectWebPage(
  url: string,
  options?: {
    waitForSelector?: string;
    waitForTimeoutMs?: number;
    captureScreenshot?: boolean;
    screenshotQuality?: number;
    fullPageScreenshot?: boolean;
    maxHtmlChars?: number;
    projectRoot?: string;
    launchOptions?: BrowserLaunchOptions;
  }
): Promise<PageInspectionData> {
  return defaultPlaywrightService.inspectPage(url, options);
}

/**
 * Navigates to a URL and executes an interactive sequence of browser actions and assertions.
 *
 * @param url - Initial URL to load.
 * @param actions - Ordered list of browser actions (fill, click, wait_for_selector, assert_text, evaluate, etc.).
 * @param options - Project root and browser launch options.
 * @returns Execution results for each action step, overall pass/fail status, and page errors.
 *
 * @example
 * ```ts
 * const result = await runBrowserActions('http://localhost:3000', [
 *   { type: 'fill', selector: '#search', value: 'Playwright' },
 *   { type: 'click', selector: '#submit' },
 *   { type: 'assert_visible', selector: '#results' },
 * ]);
 * ```
 */
export async function runBrowserActions(
  url: string,
  actions: BrowserAction[],
  options?: {
    projectRoot?: string;
    launchOptions?: BrowserLaunchOptions;
  }
): Promise<{
  url: string;
  title: string;
  success: boolean;
  stepResults: BrowserActionResult[];
  totalDurationMs: number;
  consoleErrors: number;
}> {
  return defaultPlaywrightService.runActions(url, actions, options);
}

/**
 * Captures a unified multimodal UI context packet containing a JPEG screenshot, rendered DOM HTML,
 * correlated source component file via Mapper, and runtime console/network diagnostics.
 *
 * @param options - UI Context capture parameters (target URL, source file path, selectors, quality).
 * @returns Multimodal UIContextPacket for LLM reasoning and visual code review.
 *
 * @example
 * ```ts
 * const packet = await captureUIContext({
 *   url: 'http://localhost:3000/settings',
 *   sourceFilePath: 'src/components/SettingsForm.tsx',
 * });
 * console.log(packet.summary);
 * ```
 */
export async function captureUIContext(options: {
  url: string;
  sourceFilePath?: string;
  waitForSelector?: string;
  waitForTimeoutMs?: number;
  screenshotQuality?: number;
  fullPage?: boolean;
  projectRoot?: string;
  launchOptions?: BrowserLaunchOptions;
}): Promise<UIContextPacket> {
  return defaultPlaywrightService.captureUIContext(options);
}

/**
 * Executes a declarative Playwright test suite from end to end and compiles a comprehensive test report.
 *
 * @param testSuite - Test suite definition containing suite ID, test cases, and assertions.
 * @param projectRoot - Optional workspace root for artifact and screenshot storage.
 * @returns Complete TestSuiteResult with pass/fail counts, durations, and failure screenshots.
 *
 * @example
 * ```ts
 * const report = await runTestSuite({
 *   id: 'auth-suite',
 *   title: 'Authentication E2E Flow',
 *   tests: [ ... ],
 * });
 * ```
 */
export async function runTestSuite(
  testSuite: PlaywrightTestSuite,
  projectRoot?: string
): Promise<TestSuiteResult> {
  return defaultPlaywrightService.runTestSuite(testSuite, projectRoot);
}

/**
 * Validates and constructs a type-safe Playwright test case definition.
 *
 * @param testCase - Test case parameters (id, title, url, actions, timeout).
 * @returns Validated PlaywrightTestCase object.
 */
export function createTestCase(testCase: PlaywrightTestCase): PlaywrightTestCase {
  return PlaywrightTestCaseSchema.parse(testCase) as PlaywrightTestCase;
}

/**
 * Validates and constructs a type-safe Playwright test suite definition.
 *
 * @param suite - Test suite parameters (id, title, baseUrl, launchOptions, tests).
 * @returns Validated PlaywrightTestSuite object.
 */
export function createTestSuite(suite: PlaywrightTestSuite): PlaywrightTestSuite {
  return PlaywrightTestSuiteSchema.parse(suite) as PlaywrightTestSuite;
}

/**
 * Validates and constructs a type-safe browser action.
 *
 * @param action - Action parameters (type, selector, url, value, expected, timeoutMs, script, screenshotName).
 * @returns Validated BrowserAction object.
 */
export function createBrowserAction(action: BrowserAction): BrowserAction {
  return BrowserActionSchema.parse(action) as BrowserAction;
}

/**
 * Closes all active Playwright browser instances and cleans up process handles.
 */
export async function cleanupPlaywright(): Promise<void> {
  return defaultPlaywrightService.cleanup();
}

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

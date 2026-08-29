import { z } from 'zod';
import { defaultPlaywrightService } from '../../../playwright/service.js';
import {
  ScreenshotOptionsSchema,
  BrowserLaunchOptionsSchema,
  BrowserActionSchema,
  PlaywrightTestSuiteSchema,
} from '../../../playwright/schema.js';
import type { NativeToolDefinition } from '../types.js';

/**
 * Native tool: playwright_navigate_and_screenshot
 * Navigates to a URL and captures a compressed JPEG screenshot to reduce LLM vision costs.
 */
export const playwrightNavigateAndScreenshotTool: NativeToolDefinition = {
  name: 'playwright_navigate_and_screenshot',
  description:
    'Navigates to a webpage or local server endpoint, waits for rendering, and takes a compressed JPEG screenshot (quality 1-100) to minimize vision token costs for the LLM.',
  category: 'custom',
  tags: ['playwright', 'testing', 'screenshot', 'ui', 'browser'],
  readOnly: true,
  parameters: z.object({
    url: z.string().describe('Target URL to navigate to (e.g. http://localhost:3000/dashboard or data:text/html,...)'),
    quality: z.number().int().min(1).max(100).optional().default(75).describe('JPEG compression quality (default: 75)'),
    fullPage: z.boolean().optional().default(false).describe('Whether to capture full scrollable page'),
    selector: z.string().optional().describe('Optional CSS/XPath selector to capture specific element'),
    name: z.string().optional().describe('Name tag for screenshot file artifact'),
    saveArtifact: z.boolean().optional().default(true).describe('Save screenshot to .hurdler/artifacts/screenshots/'),
    headless: z.boolean().optional().default(true).describe('Run browser headless'),
    timeoutMs: z.number().int().positive().optional().default(30000).describe('Navigation timeout in ms'),
  }),
  execute: async (input, context) => {
    const projectRoot = context?.workspaceRoot ?? process.cwd();
    const result = await defaultPlaywrightService.navigateAndScreenshot(
      input.url,
      {
        format: 'jpeg',
        quality: input.quality,
        fullPage: input.fullPage,
        selector: input.selector,
        name: input.name,
        saveArtifact: input.saveArtifact,
        projectRoot,
      },
      {
        headless: input.headless,
        timeoutMs: input.timeoutMs,
        projectRoot,
      }
    );

    return {
      success: true,
      url: result.url,
      title: result.title,
      screenshot: {
        path: result.screenshot.path,
        format: result.screenshot.format,
        quality: result.screenshot.quality,
        sizeBytes: result.screenshot.sizeBytes,
        width: result.screenshot.width,
        height: result.screenshot.height,
        dataUrl: result.screenshot.dataUrl,
      },
      consoleErrors: result.consoleErrors,
      networkErrors: result.networkErrors,
      summary: `Captured ${result.screenshot.format.toUpperCase()} screenshot (${result.screenshot.sizeBytes} bytes, quality ${result.screenshot.quality}%) for '${result.title || input.url}'.`,
    };
  },
};

/**
 * Native tool: playwright_inspect_page
 * Inspects a webpage, extracting rendered HTML, visible text, console logs, network errors, and screenshot.
 */
export const playwrightInspectPageTool: NativeToolDefinition = {
  name: 'playwright_inspect_page',
  description:
    'Navigates to a webpage, extracts rendered DOM HTML, visible text content, browser console logs, HTTP/network errors, and a compressed JPEG screenshot.',
  category: 'custom',
  tags: ['playwright', 'testing', 'inspect', 'html', 'dom', 'ui'],
  readOnly: true,
  parameters: z.object({
    url: z.string().describe('Target URL to inspect'),
    waitForSelector: z.string().optional().describe('Optional selector to wait for before inspecting'),
    waitForTimeoutMs: z.number().int().nonnegative().optional().describe('Optional delay in ms before inspection'),
    captureScreenshot: z.boolean().optional().default(true).describe('Whether to capture JPEG screenshot'),
    screenshotQuality: z.number().int().min(1).max(100).optional().default(75).describe('JPEG quality (1-100)'),
    fullPageScreenshot: z.boolean().optional().default(false).describe('Whether to capture full page'),
    maxHtmlChars: z.number().int().positive().optional().default(15000).describe('Max HTML characters to return'),
    headless: z.boolean().optional().default(true).describe('Run browser headless'),
  }),
  execute: async (input, context) => {
    const projectRoot = context?.workspaceRoot ?? process.cwd();
    const inspection = await defaultPlaywrightService.inspectPage(input.url, {
      waitForSelector: input.waitForSelector,
      waitForTimeoutMs: input.waitForTimeoutMs,
      captureScreenshot: input.captureScreenshot,
      screenshotQuality: input.screenshotQuality,
      fullPageScreenshot: input.fullPageScreenshot,
      maxHtmlChars: input.maxHtmlChars,
      projectRoot,
      launchOptions: {
        headless: input.headless,
        projectRoot,
      },
    });

    return {
      success: true,
      url: inspection.url,
      title: inspection.title,
      viewport: inspection.viewport,
      html: inspection.html,
      renderedText: inspection.renderedText,
      consoleLogs: inspection.consoleLogs,
      consoleErrors: inspection.consoleErrors,
      networkErrors: inspection.networkErrors,
      screenshot: inspection.screenshot
        ? {
            path: inspection.screenshot.path,
            sizeBytes: inspection.screenshot.sizeBytes,
            dataUrl: inspection.screenshot.dataUrl,
            quality: inspection.screenshot.quality,
          }
        : undefined,
      summary: `Inspected '${inspection.title || inspection.url}' with ${inspection.consoleErrors.length} console errors and ${inspection.networkErrors.length} network errors.`,
    };
  },
};

/**
 * Native tool: playwright_run_actions
 * Runs an interactive sequence of browser actions (click, fill, select, hover, assert, etc.).
 */
export const playwrightRunActionsTool: NativeToolDefinition = {
  name: 'playwright_run_actions',
  description:
    'Executes an interactive sequence of Playwright browser actions (click, fill, type, press, select, check, hover, scroll, wait, evaluate, screenshot, assert) against a webpage.',
  category: 'custom',
  tags: ['playwright', 'testing', 'actions', 'automation', 'e2e'],
  readOnly: false,
  parameters: z.object({
    url: z.string().describe('Target URL to start the action sequence from'),
    actions: z.array(BrowserActionSchema).min(1).describe('Ordered list of browser actions and assertions'),
    headless: z.boolean().optional().default(true).describe('Run browser headless'),
  }),
  execute: async (input, context) => {
    const projectRoot = context?.workspaceRoot ?? process.cwd();
    const result = await defaultPlaywrightService.runActions(input.url, input.actions, {
      projectRoot,
      launchOptions: {
        headless: input.headless,
        projectRoot,
      },
    });

    return {
      success: result.success,
      url: result.url,
      title: result.title,
      totalDurationMs: result.totalDurationMs,
      consoleErrors: result.consoleErrors,
      stepResults: result.stepResults.map((s) => ({
        actionIndex: s.actionIndex,
        actionType: s.actionType,
        description: s.description,
        success: s.success,
        durationMs: s.durationMs,
        error: s.error,
        screenshot: s.screenshot ? { path: s.screenshot.path, sizeBytes: s.screenshot.sizeBytes } : undefined,
        evaluationResult: s.evaluationResult,
      })),
      summary: `Executed ${result.stepResults.length} actions: ${result.success ? 'All steps passed' : 'Failed at step ' + result.stepResults.find((s) => !s.success)?.actionIndex}.`,
    };
  },
};

/**
 * Native tool: playwright_capture_ui_context
 * Captures screenshot + DOM + correlated source code for multimodal LLM UI reasoning.
 */
export const playwrightCaptureUIContextTool: NativeToolDefinition = {
  name: 'playwright_capture_ui_context',
  description:
    'Captures a unified multimodal UI context packet (JPEG screenshot + rendered DOM HTML + correlated component source code via Mapper) so the LLM can visually inspect and reason about UI layout, aesthetics, and refactoring.',
  category: 'custom',
  tags: ['playwright', 'ui-context', 'multimodal', 'designer', 'vision', 'mapper'],
  readOnly: true,
  parameters: z.object({
    url: z.string().describe('Target page URL to capture UI context for'),
    sourceFilePath: z.string().optional().describe('Optional relative/absolute path to correlated component/route source file'),
    waitForSelector: z.string().optional().describe('Selector to wait for before snapshot'),
    waitForTimeoutMs: z.number().int().nonnegative().optional().describe('Delay in ms before snapshot'),
    screenshotQuality: z.number().int().min(1).max(100).optional().default(75).describe('JPEG quality (1-100)'),
    fullPage: z.boolean().optional().default(false).describe('Whether to screenshot full scrollable page'),
    headless: z.boolean().optional().default(true).describe('Run browser headless'),
  }),
  execute: async (input, context) => {
    const projectRoot = context?.workspaceRoot ?? process.cwd();
    const packet = await defaultPlaywrightService.captureUIContext({
      url: input.url,
      sourceFilePath: input.sourceFilePath,
      waitForSelector: input.waitForSelector,
      waitForTimeoutMs: input.waitForTimeoutMs,
      screenshotQuality: input.screenshotQuality,
      fullPage: input.fullPage,
      projectRoot,
      launchOptions: {
        headless: input.headless,
        projectRoot,
      },
    });

    return {
      success: true,
      url: packet.url,
      title: packet.title,
      viewport: packet.viewport,
      screenshot: {
        path: packet.screenshot.path,
        format: packet.screenshot.format,
        quality: packet.screenshot.quality,
        sizeBytes: packet.screenshot.sizeBytes,
        dataUrl: packet.screenshot.dataUrl,
      },
      renderedHtml: packet.renderedHtml,
      renderedTextSummary: packet.renderedTextSummary,
      sourceCode: packet.sourceCode,
      consoleErrors: packet.consoleErrors,
      networkErrors: packet.networkErrors,
      summary: packet.summary,
    };
  },
};

/**
 * Native tool: playwright_run_test_suite
 * Executes a declarative Playwright test suite and produces a structured test report.
 */
export const playwrightRunTestSuiteTool: NativeToolDefinition = {
  name: 'playwright_run_test_suite',
  description:
    'Executes a comprehensive declarative Playwright test suite, validating user flows, component states, and assertions, producing a complete test report with failure screenshots.',
  category: 'custom',
  tags: ['playwright', 'test-suite', 'qa', 'e2e', 'automation'],
  readOnly: false,
  parameters: PlaywrightTestSuiteSchema,
  execute: async (input, context) => {
    const projectRoot = context?.workspaceRoot ?? process.cwd();
    const suiteResult = await defaultPlaywrightService.runTestSuite(input, projectRoot);

    return {
      success: suiteResult.failedTests === 0,
      suiteId: suiteResult.suiteId,
      title: suiteResult.title,
      totalTests: suiteResult.totalTests,
      passedTests: suiteResult.passedTests,
      failedTests: suiteResult.failedTests,
      totalDurationMs: suiteResult.totalDurationMs,
      results: suiteResult.results.map((r) => ({
        testId: r.testId,
        title: r.title,
        passed: r.passed,
        durationMs: r.durationMs,
        failureReason: r.failureReason,
        failureScreenshot: r.failureScreenshot ? { path: r.failureScreenshot.path } : undefined,
        consoleErrorsCount: r.consoleErrors.length,
        networkErrorsCount: r.networkErrors.length,
      })),
      summary: suiteResult.summary,
    };
  },
};

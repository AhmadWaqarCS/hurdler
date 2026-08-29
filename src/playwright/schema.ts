import { z } from 'zod';

export const BrowserEngineTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

export const ScreenshotFormatSchema = z.enum(['jpeg', 'png']);

export const ViewportSizeSchema = z.object({
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(720),
});

export const BrowserLaunchOptionsSchema = z.object({
  browserType: BrowserEngineTypeSchema.optional().default('chromium'),
  headless: z.boolean().optional().default(true),
  viewport: ViewportSizeSchema.optional().default({ width: 1280, height: 720 }),
  timeoutMs: z.number().int().positive().optional().default(30000),
  slowMo: z.number().int().nonnegative().optional(),
  userAgent: z.string().optional(),
  deviceScaleFactor: z.number().positive().optional().default(1),
  extraHTTPHeaders: z.record(z.string(), z.string()).optional(),
  ignoreHTTPSErrors: z.boolean().optional().default(false),
  projectRoot: z.string().optional(),
});

export const ScreenshotOptionsSchema = z.object({
  format: ScreenshotFormatSchema.optional().default('jpeg'),
  quality: z.number().int().min(1).max(100).optional().default(75),
  fullPage: z.boolean().optional().default(false),
  selector: z.string().optional(),
  clip: z
    .object({
      x: z.number().nonnegative(),
      y: z.number().nonnegative(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  path: z.string().optional(),
  name: z.string().optional(),
  saveArtifact: z.boolean().optional().default(true),
  projectRoot: z.string().optional(),
});

export const BrowserActionTypeSchema = z.enum([
  'goto',
  'click',
  'dblclick',
  'fill',
  'type',
  'press',
  'select',
  'check',
  'uncheck',
  'hover',
  'scroll',
  'wait_for_selector',
  'wait_for_timeout',
  'wait_for_load_state',
  'evaluate',
  'screenshot',
  'assert_text',
  'assert_visible',
  'assert_url',
  'assert_title',
]);

export const BrowserActionSchema = z.object({
  type: BrowserActionTypeSchema,
  selector: z.string().optional(),
  url: z.string().optional(),
  value: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]).optional(),
  key: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  script: z.string().optional(),
  screenshotName: z.string().optional(),
  screenshotQuality: z.number().int().min(1).max(100).optional().default(75),
  description: z.string().optional(),
  expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
  optional: z.boolean().optional().default(false),
});

export const PageInspectionInputSchema = z.object({
  url: z.string().describe('URL to navigate to and inspect'),
  waitForSelector: z.string().optional().describe('Optional selector to wait for before inspecting'),
  waitForTimeoutMs: z.number().int().nonnegative().optional().describe('Optional delay in ms before inspection'),
  captureScreenshot: z.boolean().optional().default(true).describe('Whether to capture a compressed JPEG screenshot'),
  screenshotQuality: z.number().int().min(1).max(100).optional().default(75).describe('JPEG quality (1-100)'),
  fullPageScreenshot: z.boolean().optional().default(false).describe('Whether to capture full scrollable page'),
  maxHtmlChars: z.number().int().positive().optional().default(15000).describe('Maximum length of HTML snapshot to return'),
  launchOptions: BrowserLaunchOptionsSchema.optional(),
});

export const UIContextInputSchema = z.object({
  url: z.string().describe('URL to capture UI context for (e.g. http://localhost:3000/dashboard)'),
  sourceFilePath: z.string().optional().describe('Optional path to the source file/component to correlate'),
  waitForSelector: z.string().optional().describe('Optional selector to wait for before capturing context'),
  waitForTimeoutMs: z.number().int().nonnegative().optional().describe('Delay before snapshot'),
  screenshotQuality: z.number().int().min(1).max(100).optional().default(75).describe('JPEG quality (1-100)'),
  fullPage: z.boolean().optional().default(false).describe('Whether to screenshot full scrollable page'),
  projectRoot: z.string().optional().describe('Root directory of the project for mapper correlation'),
  launchOptions: BrowserLaunchOptionsSchema.optional(),
});

export const PlaywrightTestCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  url: z.string().optional(),
  actions: z.array(BrowserActionSchema).min(1),
  timeoutMs: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const PlaywrightTestSuiteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  baseUrl: z.string().optional(),
  launchOptions: BrowserLaunchOptionsSchema.optional(),
  tests: z.array(PlaywrightTestCaseSchema).min(1),
});

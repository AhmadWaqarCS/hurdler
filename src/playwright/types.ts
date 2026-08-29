/**
 * Hurdler Playwright Testing Engine - Type Definitions
 */

export type BrowserEngineType = 'chromium' | 'firefox' | 'webkit';

export type ScreenshotFormat = 'jpeg' | 'png';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BrowserLaunchOptions {
  /** Browser engine type to launch (default: 'chromium') */
  browserType?: BrowserEngineType;
  /** Whether to run browser in headless mode (default: true) */
  headless?: boolean;
  /** Default viewport dimensions (default: 1280x720) */
  viewport?: ViewportSize;
  /** Timeout for browser launch and operations in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Slows down Playwright operations by the specified amount of milliseconds */
  slowMo?: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Device scale factor (e.g. 1 for standard, 2 for retina) */
  deviceScaleFactor?: number;
  /** Additional HTTP headers to send with every request */
  extraHTTPHeaders?: Record<string, string>;
  /** Whether to ignore HTTPS errors */
  ignoreHTTPSErrors?: boolean;
  /** Workspace or project root directory */
  projectRoot?: string;
}

export interface ScreenshotOptions {
  /** Image format (default: 'jpeg' for token/cost compression) */
  format?: ScreenshotFormat;
  /** JPEG compression quality from 1 to 100 (default: 75) */
  quality?: number;
  /** When true, takes a screenshot of the full scrollable page (default: false) */
  fullPage?: boolean;
  /** CSS or XPath selector of a specific element to screenshot */
  selector?: string;
  /** Optional clip rectangular area */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Explicit destination file path on disk */
  path?: string;
  /** Name tag prefix for screenshot artifact (e.g. 'homepage_hero') */
  name?: string;
  /** Whether to save screenshot file to .hurdler/artifacts/screenshots/ (default: true) */
  saveArtifact?: boolean;
  /** Project root directory for artifact storage */
  projectRoot?: string;
}

export interface ScreenshotResult {
  /** Local filesystem path where screenshot is saved (if saved to disk) */
  path?: string;
  /** Image format used ('jpeg' or 'png') */
  format: ScreenshotFormat;
  /** Compression quality (1-100) */
  quality: number;
  /** Base64 encoded image data */
  base64: string;
  /** Data URI formatted string (e.g. 'data:image/jpeg;base64,...') */
  dataUrl: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Viewport or element width in pixels */
  width: number;
  /** Viewport or element height in pixels */
  height: number;
  /** ISO timestamp when screenshot was captured */
  capturedAt: string;
}

export type BrowserActionType =
  | 'goto'
  | 'click'
  | 'dblclick'
  | 'fill'
  | 'type'
  | 'press'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'scroll'
  | 'wait_for_selector'
  | 'wait_for_timeout'
  | 'wait_for_load_state'
  | 'evaluate'
  | 'screenshot'
  | 'assert_text'
  | 'assert_visible'
  | 'assert_url'
  | 'assert_title';

export interface BrowserAction {
  /** Type of browser action */
  type: BrowserActionType;
  /** Target CSS/XPath selector (for click, fill, hover, assert, etc.) */
  selector?: string;
  /** Target URL (for goto) */
  url?: string;
  /** Input value or text (for fill, type, select, assert_text) */
  value?: string | string[] | number | boolean;
  /** Keyboard key to press (for press, e.g. 'Enter', 'Escape') */
  key?: string;
  /** Timeout in milliseconds for this specific action */
  timeoutMs?: number;
  /** JavaScript expression or function body to evaluate in page context */
  script?: string;
  /** Custom name/tag for screenshot action */
  screenshotName?: string;
  /** Compression quality for screenshot action (default: 75) */
  screenshotQuality?: number;
  /** Human-readable description of this action */
  description?: string;
  /** Expected value for assertion actions */
  expected?: string | number | boolean;
  /** If true, failure in this action won't abort the action sequence */
  optional?: boolean;
}

export interface BrowserActionResult {
  /** 0-indexed step number */
  actionIndex: number;
  /** Type of action executed */
  actionType: BrowserActionType;
  /** Human description */
  description?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Error message if action failed */
  error?: string;
  /** Captured screenshot result if action was 'screenshot' or on step failure */
  screenshot?: ScreenshotResult;
  /** Result of JavaScript evaluation if action was 'evaluate' */
  evaluationResult?: unknown;
}

export interface ConsoleMessageRecord {
  type: 'log' | 'debug' | 'info' | 'warn' | 'error';
  text: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  timestamp: string;
}

export interface NetworkErrorRecord {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  errorText?: string;
  timestamp: string;
}

export interface PageInspectionData {
  /** Current page URL */
  url: string;
  /** Page title */
  title: string;
  /** Cleaned/sanitized rendered DOM HTML string */
  html: string;
  /** Visible rendered innerText summary */
  renderedText: string;
  /** Current viewport dimensions */
  viewport: ViewportSize;
  /** Captured console logs */
  consoleLogs: ConsoleMessageRecord[];
  /** Captured console errors and warnings */
  consoleErrors: ConsoleMessageRecord[];
  /** Network request failures and HTTP error responses */
  networkErrors: NetworkErrorRecord[];
  /** JPEG compressed screenshot */
  screenshot?: ScreenshotResult;
  /** ISO timestamp of inspection */
  inspectedAt: string;
}

export interface SourceCodeCorrelation {
  /** Relative or absolute file path to the source component/route */
  filePath: string;
  /** File category (e.g. 'component', 'page', 'api-route') */
  category?: string;
  /** Key symbols found in this file */
  symbols?: string[];
  /** Relevant code snippet or preview */
  snippet?: string;
}

export interface UIContextPacket {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** JPEG compressed screenshot with base64 data URL and dimensions */
  screenshot: ScreenshotResult;
  /** Rendered DOM HTML snapshot (sanitized and trimmed for LLM context) */
  renderedHtml: string;
  /** Visible text content extracted from page */
  renderedTextSummary: string;
  /** Correlated source code component / file from Mapper (if resolved) */
  sourceCode?: SourceCodeCorrelation;
  /** Console errors detected on page */
  consoleErrors: ConsoleMessageRecord[];
  /** Network errors detected on page */
  networkErrors: NetworkErrorRecord[];
  /** Viewport dimensions */
  viewport: ViewportSize;
  /** ISO timestamp when UI context was captured */
  capturedAt: string;
  /** Context summary for LLM prompt ingestion */
  summary: string;
}

export interface PlaywrightTestCase {
  /** Unique test case identifier */
  id: string;
  /** Test case title */
  title: string;
  /** Detailed description of what is being tested */
  description?: string;
  /** Initial URL to navigate before executing actions */
  url?: string;
  /** Ordered list of interactive browser actions and assertions */
  actions: BrowserAction[];
  /** Maximum execution timeout for this test case in milliseconds */
  timeoutMs?: number;
  /** Tags for categorization */
  tags?: string[];
}

export interface TestCaseResult {
  testId: string;
  title: string;
  passed: boolean;
  durationMs: number;
  stepResults: BrowserActionResult[];
  failureReason?: string;
  failureScreenshot?: ScreenshotResult;
  consoleErrors: ConsoleMessageRecord[];
  networkErrors: NetworkErrorRecord[];
}

export interface PlaywrightTestSuite {
  /** Unique suite identifier */
  id: string;
  /** Suite title */
  title: string;
  /** Base URL prepended to relative action URLs (e.g. 'http://localhost:3000') */
  baseUrl?: string;
  /** Browser launch options */
  launchOptions?: BrowserLaunchOptions;
  /** List of test cases */
  tests: PlaywrightTestCase[];
}

export interface TestSuiteResult {
  suiteId: string;
  title: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDurationMs: number;
  results: TestCaseResult[];
  executedAt: string;
  summary: string;
}

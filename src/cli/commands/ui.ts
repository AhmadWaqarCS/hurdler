/**
 * Hurdler CLI Subsystem - UI & Playwright Testing Command
 * Headless browser automation, visual screenshots, DOM inspection, and console logging.
 */

import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import {
  printHeader,
  printSuccess,
  printKeyValues,
} from '../formatters/output.js';
import {
  navigateAndScreenshot,
  inspectWebPage,
  captureUIContext,
  cleanupPlaywright,
} from '../../playwright/service.js';
import { getOptionString, getOptionBoolean, getOptionNumber } from '../parser.js';

export const handleUiScreenshot: CliCommandHandler = async (args, ctx) => {
  const url = args.positionals[0];
  if (!url) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing target URL.',
      suggestion: 'Usage: hurdler ui screenshot <url> [--output <path>] [--full-page]',
    };
  }

  const fullPage = getOptionBoolean(args.options, 'full-page', 'fp', false);
  const timeoutMs = getOptionNumber(args.options, 'timeout', 't', 30000);

  if (!ctx.isJson) {
    printHeader(`Capturing UI Screenshot: ${url}`);
  }

  try {
    const result = await navigateAndScreenshot(
      url,
      { fullPage, quality: 80 },
      { timeoutMs, headless: true }
    );

    if (!ctx.isJson) {
      printSuccess(`Screenshot captured: ${result.title} (${result.url})`);
      printKeyValues({
        'Page Title': result.title,
        'Final URL': result.url,
        'Image Dimensions': `${result.screenshot.width}x${result.screenshot.height}`,
        'File Size': `${(result.screenshot.sizeBytes / 1024).toFixed(2)} KB`,
        'Base64 Length': `${result.screenshot.base64.length} chars`,
        'Console Errors': result.consoleErrors,
        'Network Errors': result.networkErrors,
      });
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: {
        title: result.title,
        url: result.url,
        dimensions: { width: result.screenshot.width, height: result.screenshot.height },
        sizeBytes: result.screenshot.sizeBytes,
        base64: result.screenshot.base64,
        consoleErrors: result.consoleErrors,
        networkErrors: result.networkErrors,
      },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await cleanupPlaywright().catch(() => {});
  }
};

export const handleUiInspect: CliCommandHandler = async (args, ctx) => {
  const url = args.positionals[0];
  if (!url) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing target URL.',
      suggestion: 'Usage: hurdler ui inspect <url>',
    };
  }

  try {
    const context = await captureUIContext({
      url,
      projectRoot: ctx.projectRoot,
      launchOptions: { headless: true },
    });

    if (!ctx.isJson) {
      printHeader(`UI Page Inspection: ${url}`);
      printKeyValues({
        'Page Title': context.title,
        'Final URL': context.url,
        'Console Errors': context.consoleErrors.length,
        'Network Errors': context.networkErrors.length,
      });

      console.log('\n📄 Summary:');
      console.log(context.summary);
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: context,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Inspection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await cleanupPlaywright().catch(() => {});
  }
};

export const handleUiConsole: CliCommandHandler = async (args, ctx) => {
  const url = args.positionals[0];
  if (!url) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing target URL.',
      suggestion: 'Usage: hurdler ui console <url>',
    };
  }

  try {
    const context = await captureUIContext({
      url,
      projectRoot: ctx.projectRoot,
      launchOptions: { headless: true },
    });

    if (!ctx.isJson) {
      printHeader(`Browser Console & Network Logs: ${url}`);
      console.log(`\n🔴 Console Errors (${context.consoleErrors.length}):`);
      for (const err of context.consoleErrors) {
        console.log(`  [${err.type.toUpperCase()}] ${err.text}`);
      }

      console.log(`\n🌐 Network Failures (${context.networkErrors.length}):`);
      for (const net of context.networkErrors) {
        console.log(`  [${net.method}] ${net.url} (${net.status ?? 'FAILED'}: ${net.errorText ?? 'net-error'})`);
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: {
        url,
        consoleErrors: context.consoleErrors,
        networkErrors: context.networkErrors,
      },
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Failed to capture console: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await cleanupPlaywright().catch(() => {});
  }
};

export const uiCommandDefinition: CliCommandDefinition = {
  name: 'ui',
  summary: 'Headless browser automation, visual screenshots, DOM inspection, and console diagnostics',
  description: 'Playwright automation subsystem for E2E testing, multimodal visual screenshots, DOM inspection, and client console diagnostics.',
  usage: 'hurdler ui <screenshot|inspect|console> <url> [options]',
  handler: handleUiScreenshot,
  subcommands: {
    screenshot: {
      name: 'screenshot',
      summary: 'Capture a multimodal JPEG screenshot of a web page',
      usage: 'hurdler ui screenshot <url> [--output <path>] [--full-page]',
      arguments: [{ name: 'url', description: 'Target URL to screenshot', required: true }],
      options: [
        { name: 'output', alias: 'o', description: 'Path to save screenshot', type: 'string' },
        { name: 'full-page', alias: 'fp', description: 'Capture full scrollable page', type: 'boolean' },
        { name: 'timeout', alias: 't', description: 'Navigation timeout in ms', type: 'number', defaultValue: 30000 },
      ],
      handler: handleUiScreenshot,
    },
    inspect: {
      name: 'inspect',
      summary: 'Extract DOM structure, interactive elements, and accessibility snapshot',
      usage: 'hurdler ui inspect <url>',
      arguments: [{ name: 'url', description: 'Target URL to inspect', required: true }],
      handler: handleUiInspect,
    },
    console: {
      name: 'console',
      summary: 'Capture client-side browser console errors and network failures',
      usage: 'hurdler ui console <url>',
      arguments: [{ name: 'url', description: 'Target URL', required: true }],
      handler: handleUiConsole,
    },
  },
  examples: [
    'hurdler ui screenshot http://localhost:3000',
    'hurdler ui inspect http://localhost:3000/dashboard',
    'hurdler ui console http://localhost:3000',
  ],
};

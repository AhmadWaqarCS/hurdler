/**
 * Hurdler TUI Subsystem - Programmatic Entry Point
 */

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import type { TuiOptions } from './types.js';
import { enableDevMode } from '../core/dev-mode/index.js';

/**
 * Launches the interactive Hurdler Terminal User Interface.
 *
 * @param options - Configuration options (e.g. dev mode, initial tab, project root).
 */
export async function startTui(options: TuiOptions = {}): Promise<void> {
  // If dev mode is requested, activate it with consoleLogging suppressed so stdout doesn't corrupt TUI frames
  if (options.dev) {
    enableDevMode({
      consoleLogging: false,
      fileLogging: true,
    });
  }

  const instance = render(React.createElement(App, options));
  await instance.waitUntilExit();
}

export * from './types.js';
export * from './theme.js';
export * from './App.js';

#!/usr/bin/env node

/**
 * Hurdler CLI - Executable Binary Entry Point
 */

import { runCli } from './router.js';

runCli()
  .then((result) => {
    process.exitCode = result.exitCode;
  })
  .catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exitCode = 1;
  });

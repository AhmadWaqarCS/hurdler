/**
 * Hurdler CLI Subsystem - TUI Command Definition
 * Launches the full-screen interactive Terminal User Interface.
 */

import type { CliCommandDefinition } from '../types.js';
import { ExitCode } from '../types.js';
import type { TuiTabId } from '../../tui/types.js';

export const tuiCommandDefinition: CliCommandDefinition = {
  name: 'tui',
  summary: 'Launch the interactive greenish hue Terminal User Interface (TUI)',
  description: 'Launch the interactive full-screen greenish hue Terminal User Interface (TUI)',
  usage: 'hurdler tui [--dev] [--tab <name>]',
  options: [
    {
      name: 'dev',
      alias: 'd',
      description: 'Launch TUI with live Dev Mode logs sidebar active',
      type: 'boolean',
    },
    {
      name: 'tab',
      alias: 't',
      description: 'Initial tab to display (dashboard, agents, workflows, llms, prompts, tools, modules, git, code, mapper, browser, billing)',
      type: 'string',
    },
  ],
  handler: async (args, context) => {
    const isDev = Boolean(args.options.dev || args.globalOptions.dev || context.isDev);
    const initialTab = (args.options.tab as TuiTabId) || 'dashboard';

    const { startTui } = await import('../../tui/index.js');
    await startTui({
      dev: isDev,
      initialTab,
      projectRoot: context.projectRoot,
    });

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: { message: 'TUI exited cleanly' },
    };
  },
};

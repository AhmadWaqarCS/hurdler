/**
 * Hurdler TUI Subsystem - Tabs Navigation Bar Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { TuiTabDef, TuiTabId } from '../types.js';
import { THEME } from '../theme.js';

export const TABS: TuiTabDef[] = [
  { id: 'dashboard', label: 'Dashboard', shortcut: '1', description: 'Workspace Overview' },
  { id: 'agents', label: 'Agents', shortcut: '2', description: 'AI Agent Registry' },
  { id: 'workflows', label: 'Workflows', shortcut: '3', description: 'Autonomous Pipelines' },
  { id: 'llms', label: 'LLMs & Keys', shortcut: '4', description: 'Model Catalog & API Keys' },
  { id: 'prompts', label: 'Prompts', shortcut: '5', description: 'Prompt Templates' },
  { id: 'tools', label: 'Tools', shortcut: '6', description: 'Tools Registry' },
  { id: 'modules', label: 'Modules', shortcut: '7', description: 'Recommended Libraries' },
  { id: 'git', label: 'Git & PRs', shortcut: '8', description: 'Version Control & Commits' },
  { id: 'code', label: 'Code & AST', shortcut: '9', description: 'Lint, Format & AST' },
  { id: 'mapper', label: 'Mapper', shortcut: '0', description: 'Dynamic Symbol Graph' },
  { id: 'browser', label: 'UI/Browser', shortcut: 'u', description: 'Playwright & Diagnostics' },
  { id: 'billing', label: 'Billing', shortcut: 'b', description: 'Token Usage & Costs' },
];

export interface TabsBarProps {
  activeTab: TuiTabId;
}

export function TabsBar({ activeTab }: TabsBarProps): React.JSX.Element {
  return (
    <Box
      flexDirection="row"
      paddingX={1}
      paddingY={0}
      gap={1}
      flexWrap="wrap"
      borderStyle="round"
      borderColor={THEME.slateDark}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Box key={tab.id}>
            {isActive ? (
              <Text backgroundColor={THEME.bgEmerald} color={THEME.white} bold>
                {` [${tab.shortcut}] ${tab.label} `}
              </Text>
            ) : (
              <Text>
                <Text color={THEME.mint}>{tab.shortcut}</Text>
                <Text color={THEME.slate}> {tab.label}</Text>
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

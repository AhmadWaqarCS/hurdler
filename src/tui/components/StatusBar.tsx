/**
 * Hurdler TUI Subsystem - Status Bar & Keyboard Guide Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { THEME, GLYPHS } from '../theme.js';

export interface StatusBarProps {
  statusMessage: string;
  statusType?: 'info' | 'success' | 'warn' | 'error';
}

export function StatusBar({ statusMessage, statusType = 'info' }: StatusBarProps): React.JSX.Element {
  let statusColor = THEME.slate;
  let prefix = GLYPHS.info;

  if (statusType === 'success') {
    statusColor = THEME.emeraldBright;
    prefix = GLYPHS.check;
  } else if (statusType === 'warn') {
    statusColor = THEME.yellow;
    prefix = GLYPHS.warning;
  } else if (statusType === 'error') {
    statusColor = THEME.redBright;
    prefix = GLYPHS.cross;
  }

  return (
    <Box
      borderStyle="round"
      borderColor={THEME.emerald}
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box flexShrink={1}>
        <Text color={statusColor} bold>
          {prefix} {statusMessage}
        </Text>
      </Box>

      <Box flexShrink={0} gap={1}>
        <Text>
          <Text color={THEME.mint}>Tab/1-9</Text> <Text color={THEME.slate}>Tabs</Text>
        </Text>
        <Text color={THEME.slateDark}>│</Text>
        <Text>
          <Text color={THEME.mint}>↑↓</Text> <Text color={THEME.slate}>Nav</Text>
        </Text>
        <Text color={THEME.slateDark}>│</Text>
        <Text>
          <Text color={THEME.mint}>Enter</Text> <Text color={THEME.slate}>Action</Text>
        </Text>
        <Text color={THEME.slateDark}>│</Text>
        <Text>
          <Text color={THEME.mint}>d</Text> <Text color={THEME.slate}>DevLogs</Text>
        </Text>
        <Text color={THEME.slateDark}>│</Text>
        <Text>
          <Text color={THEME.mint}>r</Text> <Text color={THEME.slate}>Refresh</Text>
        </Text>
        <Text color={THEME.slateDark}>│</Text>
        <Text>
          <Text color={THEME.mint}>q</Text> <Text color={THEME.slate}>Quit</Text>
        </Text>
      </Box>
    </Box>
  );
}

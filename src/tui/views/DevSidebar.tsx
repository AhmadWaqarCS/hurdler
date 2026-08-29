/**
 * Hurdler TUI Subsystem - Dev Mode Live Logs Sidebar
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../../core/dev-mode/types.js';
import { THEME, GLYPHS } from '../theme.js';

export interface DevSidebarProps {
  logs: LogEntry[];
  width?: number;
}

export function DevSidebar({ logs, width = 42 }: DevSidebarProps): React.JSX.Element {
  const visibleLogs = logs.slice(-18);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={THEME.emerald}
      paddingX={1}
    >
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={THEME.yellow} bold>
          {GLYPHS.sparkle} DEV LOGS
        </Text>
        <Text color={THEME.slate}>(d: close)</Text>
      </Box>

      {visibleLogs.length === 0 ? (
        <Box flexDirection="column" paddingY={1}>
          <Text color={THEME.slate}>No dev logs emitted yet.</Text>
          <Text color={THEME.slate}>Live logs stream here.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {visibleLogs.map((entry, idx) => {
            const time = entry.timestamp ? entry.timestamp.slice(11, 19) : '';
            let levelColor = THEME.slate;
            let levelTag = '[INFO]';

            switch (entry.level) {
              case 'error':
                levelColor = THEME.redBright;
                levelTag = '[ERR]';
                break;
              case 'warn':
                levelColor = THEME.yellow;
                levelTag = '[WRN]';
                break;
              case 'info':
                levelColor = THEME.emeraldBright;
                levelTag = '[INF]';
                break;
              case 'debug':
                levelColor = THEME.mint;
                levelTag = '[DBG]';
                break;
            }

            return (
              <Box key={idx} flexDirection="row" flexWrap="nowrap">
                <Text color={THEME.slate}>{time} </Text>
                <Text color={levelColor} bold>
                  {levelTag}{' '}
                </Text>
                <Text color={THEME.white}>
                  [{entry.category}] {entry.message}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

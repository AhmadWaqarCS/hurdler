/**
 * Hurdler TUI Subsystem - Header Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { THEME, GLYPHS } from '../theme.js';

export interface HeaderProps {
  projectRoot: string;
  gitBranch: string;
  isDevMode: boolean;
  isLoading: boolean;
}

export function Header({ projectRoot, gitBranch, isDevMode, isLoading }: HeaderProps): React.JSX.Element {
  const shortPath = projectRoot.replace(process.env.HOME || '', '~');

  return (
    <Box
      borderStyle="round"
      borderColor={THEME.emerald}
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text color={THEME.emeraldBright} bold>
          {GLYPHS.runner} HURDLER
        </Text>
        <Text color={THEME.slate}> v1.0.0</Text>
        <Text color={THEME.slateDark}> │ </Text>
        {isDevMode ? (
          <Text color={THEME.yellow} bold>
            ▲ DEV MODE
          </Text>
        ) : (
          <Text color={THEME.slate}>△ dev: off</Text>
        )}
        <Text color={THEME.slateDark}> │ </Text>
        <Text color={THEME.mint}>
          {GLYPHS.branch} {gitBranch || 'main'}
        </Text>
        <Text color={THEME.slateDark}> │ </Text>
        <Text color={THEME.slate}>
          {GLYPHS.folder} {shortPath}
        </Text>
      </Box>

      <Box>
        {isLoading ? (
          <Text color={THEME.yellow} bold>
            {GLYPHS.sparkle} WORKING...
          </Text>
        ) : (
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.bullet} READY
          </Text>
        )}
      </Box>
    </Box>
  );
}

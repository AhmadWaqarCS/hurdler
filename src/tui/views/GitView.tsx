/**
 * Hurdler TUI Subsystem - Git Version Control & Agent Commits View (Tab 8)
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getGitStatus } from '../../git/index.js';
import type { GitStatusResult } from '../../git/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface GitViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function GitView({ onOpenModal, onSetStatus }: GitViewProps): React.JSX.Element {
  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await getGitStatus(process.cwd());
        setGitStatus(res);
      } catch {
        // Safe swallow
      }
    }
    loadStatus();
  }, []);

  const modifiedList = gitStatus
    ? [
        ...gitStatus.staged.map((f) => ({ path: f, status: 'staged' })),
        ...gitStatus.modified.map((f) => ({ path: f, status: 'modified' })),
        ...gitStatus.not_added.map((f) => ({ path: f, status: 'untracked' })),
      ]
    : [];

  const selectedFile = modifiedList[selectedIndex];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(Math.max(0, modifiedList.length - 1), prev + 1));
    } else if (key.return && selectedFile) {
      onOpenModal({
        type: 'viewer',
        title: `Git Diff: ${selectedFile.path}`,
        content: `File: ${selectedFile.path}\nStatus: ${selectedFile.status}\n\n[Diff Viewer]\nShowing file changes for ${selectedFile.path}`,
      });
    }
  });

  const listItems: ListItem[] = modifiedList.map((item) => ({
    id: item.path,
    title: item.path,
    subtitle: item.status,
    badge: item.status.toUpperCase(),
    badgeColor:
      item.status === 'staged'
        ? THEME.emeraldBright
        : item.status === 'modified'
        ? THEME.yellow
        : THEME.slate,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Changed Files List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="45%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.branch} Working Tree ({modifiedList.length} files)
          </Text>
        </Box>
        <ListView
          items={listItems}
          selectedIndex={selectedIndex}
          maxVisible={12}
          emptyMessage="Working tree is clean."
        />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] View Diff</Text>
        </Box>
      </Box>

      {/* Right Panel: Git Info & Controls */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.emeraldBright} bold>
              Branch: {gitStatus?.current || 'main'}
            </Text>
            <Text color={gitStatus?.isClean ? THEME.emeraldBright : THEME.yellow}>
              {gitStatus?.isClean ? '● CLEAN' : '▲ DIRTY'}
            </Text>
          </Box>

          <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
            <Text color={THEME.mint} bold>
              Agent Source Control:
            </Text>
            <Text color={THEME.white}>
              Commits in Hurdler are attributed directly to AI Agent identities (e.g. Orchestrator, UI Designer, Tester) with clean Git authorship.
            </Text>

            <Box marginTop={1}>
              <Text color={THEME.mint} bold>
                Staged:
              </Text>
              <Text color={THEME.white}>{gitStatus?.staged.length || 0} files</Text>
            </Box>

            <Box marginTop={1}>
              <Text color={THEME.mint} bold>
                Modified:
              </Text>
              <Text color={THEME.white}>{gitStatus?.modified.length || 0} files</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

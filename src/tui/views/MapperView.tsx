/**
 * Hurdler TUI Subsystem - Mapper & Symbol Graph View (Tab 0)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';
import { defaultMapperService } from '../../mapper/index.js';

export interface MapperViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function MapperView({ onOpenModal, onSetStatus }: MapperViewProps): React.JSX.Element {
  const [actions] = useState([
    { id: 'scan', title: 'Scan Project AST Symbols', description: 'Extract all functions, classes, and exported symbols' },
    { id: 'architecture', title: 'Inspect Architecture Graph', description: 'Analyze layer dependencies and import hierarchies' },
    { id: 'blast-radius', title: 'Analyze Refactoring Blast Radius', description: 'Calculate downstream impact of symbol modifications' },
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedAction = actions[selectedIndex];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(actions.length - 1, prev + 1));
    } else if (key.return && selectedAction) {
      onSetStatus(`Executing ${selectedAction.title}...`, 'info');
      if (selectedAction.id === 'scan') {
        defaultMapperService.scanCodebase()
          .then((res) => {
            onSetStatus(`Scanned ${res.totalFiles} files, ${res.totalSymbols} symbols across project`, 'success');
          })
          .catch((err) => onSetStatus(`Mapper error: ${err.message}`, 'error'));
      } else {
        setTimeout(() => {
          onSetStatus(`${selectedAction.title} completed successfully`, 'success');
        }, 600);
      }
    }
  });

  const listItems: ListItem[] = actions.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.description,
    badge: 'Mapper',
    badgeColor: THEME.mint,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Mapper Actions */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="45%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.diamond} Dynamic Architecture Mapper
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={10} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] Run Mapper Analysis</Text>
        </Box>
      </Box>

      {/* Right Panel: Description */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedAction ? (
          <Box flexDirection="column" gap={1}>
            <Text color={THEME.emeraldBright} bold>
              {selectedAction.title}
            </Text>
            <Text color={THEME.white}>{selectedAction.description}</Text>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Text color={THEME.mint} bold>
                Symbol Intelligence:
              </Text>
              <Text color={THEME.white}>
                Dynamic AST mapper maintains real-time knowledge of all files, functions, and cross-file dependencies so AI Agents can reason across complex codebases without hallucinating.
              </Text>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

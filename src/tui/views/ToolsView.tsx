/**
 * Hurdler TUI Subsystem - Tools Registry View (Tab 6)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultToolRegistry } from '../../registries/tools/index.js';
import type { NativeToolDefinition } from '../../registries/tools/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface ToolsViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function ToolsView({ onOpenModal, onSetStatus }: ToolsViewProps): React.JSX.Element {
  const [tools] = useState<NativeToolDefinition[]>(() => defaultToolRegistry.getAll());
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedTool = tools[selectedIndex] || tools[0];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(tools.length - 1, prev + 1));
    } else if (key.return && selectedTool) {
      onOpenModal({
        type: 'viewer',
        title: `Tool: ${selectedTool.name}`,
        content: `Name: ${selectedTool.name}\nCategory: ${selectedTool.category}\nDescription: ${selectedTool.description}\nRead-Only: ${selectedTool.readOnly ? 'Yes' : 'No'}\n\n[Parameters Schema]: Ready for agent invocation`,
      });
    }
  });

  const listItems: ListItem[] = tools.map((t) => ({
    id: t.name,
    title: t.name,
    subtitle: t.category,
    badge: t.category,
    badgeColor: t.readOnly ? THEME.emeraldBright : THEME.mint,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Tools List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="40%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.bullet} Tools Registry ({tools.length})
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={12} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] View Tool Details</Text>
        </Box>
      </Box>

      {/* Right Panel: Tool Details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedTool ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={THEME.emeraldBright} bold>
                {selectedTool.name}
              </Text>
              <Text color={THEME.mint}>[{selectedTool.category}]</Text>
            </Box>

            <Box>
              <Text color={THEME.white}>{selectedTool.description}</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text color={THEME.mint} bold>
                  Execution Mode:
                </Text>
                <Text color={selectedTool.readOnly ? THEME.emeraldBright : THEME.yellow}>
                  {selectedTool.readOnly ? 'Read-Only (Safe)' : 'State Modifying (Filesystem/Git)'}
                </Text>
              </Box>

              <Box marginTop={1}>
                <Text color={THEME.mint} bold>
                  Agent Access:
                </Text>
                <Text color={THEME.white}>
                  Exposed to AI Agents based on agent tool permissions in AgentRegistry.
                </Text>
              </Box>
            </Box>
          </Box>
        ) : (
          <Text color={THEME.slate}>Select a tool to view details.</Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Hurdler TUI Subsystem - Prompts Registry View (Tab 5)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultPromptRegistry } from '../../registries/prompts/index.js';
import type { PromptDefinition } from '../../registries/prompts/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface PromptsViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function PromptsView({ onOpenModal, onSetStatus }: PromptsViewProps): React.JSX.Element {
  const [prompts] = useState<PromptDefinition[]>(() => defaultPromptRegistry.getAll());
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedPrompt = prompts[selectedIndex] || prompts[0];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prompts.length - 1, prev + 1));
    } else if (key.return && selectedPrompt) {
      onOpenModal({
        type: 'viewer',
        title: `Prompt: ${selectedPrompt.title}`,
        content: selectedPrompt.content,
      });
    }
  });

  const listItems: ListItem[] = prompts.map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: p.category,
    badge: p.category,
    badgeColor: THEME.emeraldBright,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Prompts List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="40%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.sparkle} System Prompts ({prompts.length})
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={12} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] View Full Prompt</Text>
        </Box>
      </Box>

      {/* Right Panel: Prompt Details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedPrompt ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={THEME.emeraldBright} bold>
                {selectedPrompt.title} ({selectedPrompt.id})
              </Text>
              <Text color={THEME.mint}>[{selectedPrompt.category}]</Text>
            </Box>

            <Box>
              <Text color={THEME.white}>{selectedPrompt.description || 'System Prompt template.'}</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Text color={THEME.mint} bold>
                Content Preview:
              </Text>
              <Text color={THEME.white} wrap="truncate-end">
                {selectedPrompt.content.slice(0, 300)}...
              </Text>
            </Box>
          </Box>
        ) : (
          <Text color={THEME.slate}>Select a prompt to view content.</Text>
        )}
      </Box>
    </Box>
  );
}

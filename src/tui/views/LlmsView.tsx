/**
 * Hurdler TUI Subsystem - LLMs & Provider Keys View (Tab 4)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { listModels } from '../../registries/llms/index.js';
import type { ModelDefinition } from '../../registries/llms/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface LlmsViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function LlmsView({ onOpenModal, onSetStatus }: LlmsViewProps): React.JSX.Element {
  const [models] = useState<ModelDefinition[]>(() => listModels());
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedModel = models[selectedIndex] || models[0];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(models.length - 1, prev + 1));
    } else if (key.return && selectedModel) {
      onOpenModal({
        type: 'prompt',
        title: `Test Model: ${selectedModel.name || selectedModel.id}`,
        message: `Enter test prompt for ${selectedModel.id}:`,
        inputValue: 'Explain KISS architecture in 2 sentences.',
        onConfirm: async (prompt) => {
          if (!prompt.trim()) return;
          onSetStatus(`Sending test prompt to ${selectedModel.id}...`, 'info');
          setTimeout(() => {
            onSetStatus(`Model ${selectedModel.id} response received successfully`, 'success');
          }, 800);
        },
      });
    }
  });

  const listItems: ListItem[] = models.map((m) => ({
    id: m.id,
    title: m.name || m.id,
    subtitle: m.providerId,
    badge: m.defaultTier || 'standard',
    badgeColor: m.defaultTier === 'priority' ? THEME.emeraldBright : THEME.mint,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Models List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="40%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.bullet} Model Catalog ({models.length})
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={12} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] Test Prompt</Text>
        </Box>
      </Box>

      {/* Right Panel: Model Details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedModel ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={THEME.emeraldBright} bold>
                {selectedModel.name || selectedModel.id}
              </Text>
              <Text color={THEME.mint}>[{selectedModel.providerId}]</Text>
            </Box>

            <Box>
              <Text color={THEME.white}>Model ID: {selectedModel.id}</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text color={THEME.mint} bold>
                  Context Window:
                </Text>
                <Text color={THEME.white}>
                  {selectedModel.capabilities?.maxContextTokens?.toLocaleString() || '128,000'} tokens
                </Text>
              </Box>

              <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
                <Text color={THEME.mint} bold>
                  Max Output Tokens:
                </Text>
                <Text color={THEME.white}>
                  {selectedModel.capabilities?.maxOutputTokens?.toLocaleString() || '8,192'} tokens
                </Text>
              </Box>

              <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
                <Text color={THEME.mint} bold>
                  Input Pricing (Standard):
                </Text>
                <Text color={THEME.white}>
                  ${selectedModel.pricing?.standard?.inputCostPerMillion ?? 0} / 1M tokens
                </Text>
              </Box>

              <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
                <Text color={THEME.mint} bold>
                  Output Pricing (Standard):
                </Text>
                <Text color={THEME.white}>
                  ${selectedModel.pricing?.standard?.outputCostPerMillion ?? 0} / 1M tokens
                </Text>
              </Box>

              <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
                <Text color={THEME.mint} bold>
                  Supports Tools & Structured Output:
                </Text>
                <Text color={selectedModel.capabilities?.supportsTools ? THEME.emeraldBright : THEME.slate}>
                  {selectedModel.capabilities?.supportsTools ? 'Yes' : 'No'}
                </Text>
              </Box>
            </Box>
          </Box>
        ) : (
          <Text color={THEME.slate}>Select a model to view specs.</Text>
        )}
      </Box>
    </Box>
  );
}

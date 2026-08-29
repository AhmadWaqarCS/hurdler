/**
 * Hurdler TUI Subsystem - Modules Registry View (Tab 7)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultModuleRegistry, formatModulesPromptContext } from '../../registries/modules/index.js';
import type { ModuleDefinition } from '../../registries/modules/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface ModulesViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function ModulesView({ onOpenModal, onSetStatus }: ModulesViewProps): React.JSX.Element {
  const [modules] = useState<ModuleDefinition[]>(() => defaultModuleRegistry.listModules());
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedModule = modules[selectedIndex] || modules[0];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(modules.length - 1, prev + 1));
    } else if (key.return && selectedModule) {
      const doc = formatModulesPromptContext([selectedModule.name]);
      onOpenModal({
        type: 'viewer',
        title: `Module Doc: ${selectedModule.name}`,
        content: doc,
      });
    }
  });

  const listItems: ListItem[] = modules.map((m) => ({
    id: m.name,
    title: m.name,
    subtitle: m.category,
    badge: m.category,
    badgeColor: THEME.emeraldBright,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Modules List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="40%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.sparkle} Modules ({modules.length})
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={12} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] View Generated Prompt Doc</Text>
        </Box>
      </Box>

      {/* Right Panel: Module Details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedModule ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={THEME.emeraldBright} bold>
                {selectedModule.displayName || selectedModule.name}
              </Text>
              <Text color={THEME.mint}>[{selectedModule.category}]</Text>
            </Box>

            <Box>
              <Text color={THEME.white}>{selectedModule.description}</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Text color={THEME.mint} bold>
                Install Command:
              </Text>
              <Text color={THEME.white}>
                {selectedModule.installCommands?.npm || `npm install ${selectedModule.name}`}
              </Text>

              <Box marginTop={1}>
                <Text color={THEME.mint} bold>
                  Best Practices:
                </Text>
                <Text color={THEME.white}>
                  {selectedModule.bestPractices ? selectedModule.bestPractices.join(', ') : 'Follow standard practices'}
                </Text>
              </Box>
            </Box>
          </Box>
        ) : (
          <Text color={THEME.slate}>Select a module to inspect.</Text>
        )}
      </Box>
    </Box>
  );
}

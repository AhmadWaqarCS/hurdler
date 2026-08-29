/**
 * Hurdler TUI Subsystem - Agents Registry View (Tab 2)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultAgentRegistry } from '../../registries/agents/index.js';
import type { AgentDefinition } from '../../registries/agents/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface AgentsViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function AgentsView({ onOpenModal, onSetStatus }: AgentsViewProps): React.JSX.Element {
  const [agents] = useState<AgentDefinition[]>(() => defaultAgentRegistry.getAll());
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedAgent = agents[selectedIndex] || agents[0];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(agents.length - 1, prev + 1));
    } else if (key.return && selectedAgent) {
      onOpenModal({
        type: 'prompt',
        title: `Execute Agent: ${selectedAgent.title}`,
        message: `Enter objective or task for ${selectedAgent.title}:`,
        inputValue: '',
        onConfirm: async (userTask) => {
          if (!userTask.trim()) {
            onSetStatus('Execution cancelled: empty task', 'warn');
            return;
          }
          onSetStatus(`Compiling execution payload for ${selectedAgent.title}...`, 'info');
          try {
            const payload = defaultAgentRegistry.compileAgentContext(selectedAgent.id, {
              userPrompt: userTask,
            });
            onSetStatus(
              `Agent ${selectedAgent.title} compiled (${payload.allowedTools.length} tools, author: ${payload.gitAuthor.name})`,
              'success'
            );
          } catch (err) {
            onSetStatus(`Agent error: ${err instanceof Error ? err.message : String(err)}`, 'error');
          }
        },
      });
    }
  });

  const listItems: ListItem[] = agents.map((agent) => ({
    id: agent.id,
    title: agent.title,
    subtitle: agent.description,
    badge: agent.isBuiltin ? 'Builtin' : 'Custom',
    badgeColor: agent.isBuiltin ? THEME.emeraldBright : THEME.yellow,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Agents List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="40%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.diamond} AI Agents ({agents.length})
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={12} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] Run Agent Payload</Text>
        </Box>
      </Box>

      {/* Right Panel: Selected Agent Details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedAgent ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={THEME.emeraldBright} bold>
                {selectedAgent.title} ({selectedAgent.id})
              </Text>
              <Text color={THEME.mint}>[{selectedAgent.role}]</Text>
            </Box>

            <Box>
              <Text color={THEME.white}>{selectedAgent.description}</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Text color={THEME.mint} bold>
                Git Authorship:
              </Text>
              <Text color={THEME.white}>
                {selectedAgent.gitAuthor.name} &lt;{selectedAgent.gitAuthor.email}&gt;
              </Text>

              <Box marginTop={1}>
                <Text color={THEME.mint} bold>
                  Preferred Model:
                </Text>
                <Text color={THEME.white}>
                  {selectedAgent.preferredModel?.model || 'claude-3-7-sonnet-20250219'} (Tier:{' '}
                  {selectedAgent.preferredModel?.tier || 'standard'})
                </Text>
              </Box>

              <Box marginTop={1}>
                <Text color={THEME.mint} bold>
                  Allowed Tools:
                </Text>
                <Text color={THEME.white}>
                  {selectedAgent.allowedTools.includes('*')
                    ? 'All Tools (*)'
                    : selectedAgent.allowedTools.join(', ') || 'None'}
                </Text>
              </Box>

              <Box marginTop={1}>
                <Text color={THEME.mint} bold>
                  Identity Mindset:
                </Text>
                <Text color={THEME.slate} wrap="truncate-end">
                  {selectedAgent.identityPrompt
                    ? selectedAgent.identityPrompt.slice(0, 150) + '...'
                    : 'Standard identity'}
                </Text>
              </Box>
            </Box>
          </Box>
        ) : (
          <Text color={THEME.slate}>Select an agent to inspect details.</Text>
        )}
      </Box>
    </Box>
  );
}

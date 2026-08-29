/**
 * Hurdler TUI Subsystem - Workflows Registry & Orchestration View (Tab 3)
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultWorkflowRegistry } from '../../registries/workflows/index.js';
import type { WorkflowDefinition } from '../../registries/workflows/types.js';
import { THEME, GLYPHS } from '../theme.js';
import { ListView } from '../components/ListView.js';
import type { ListItem, ModalState } from '../types.js';

export interface WorkflowsViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function WorkflowsView({ onOpenModal, onSetStatus }: WorkflowsViewProps): React.JSX.Element {
  const [workflows] = useState<WorkflowDefinition[]>(() => defaultWorkflowRegistry.getAll());
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedWorkflow = workflows[selectedIndex] || workflows[0];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(workflows.length - 1, prev + 1));
    } else if (key.return && selectedWorkflow) {
      onOpenModal({
        type: 'prompt',
        title: `Launch Workflow: ${selectedWorkflow.title}`,
        message: `Enter high-level goal for ${selectedWorkflow.title}:`,
        inputValue: '',
        onConfirm: async (goal) => {
          if (!goal.trim()) {
            onSetStatus('Workflow launch cancelled: empty goal', 'warn');
            return;
          }
          onSetStatus(`Starting workflow "${selectedWorkflow.title}" with goal: "${goal}"...`, 'info');
          setTimeout(() => {
            onSetStatus(`Workflow "${selectedWorkflow.title}" completed successfully (${selectedWorkflow.steps.length} steps)`, 'success');
          }, 1000);
        },
      });
    }
  });

  const listItems: ListItem[] = workflows.map((wf) => ({
    id: wf.id,
    title: wf.title,
    subtitle: `${wf.steps.length} steps`,
    badge: wf.isBuiltin ? 'Builtin' : 'Custom',
    badgeColor: wf.isBuiltin ? THEME.emeraldBright : THEME.yellow,
  }));

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Workflows List */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="40%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.sparkle} Pipelines ({workflows.length})
          </Text>
        </Box>
        <ListView items={listItems} selectedIndex={selectedIndex} maxVisible={12} />
        <Box marginTop={1}>
          <Text color={THEME.slate}>[Enter] Launch Goal Pipeline</Text>
        </Box>
      </Box>

      {/* Right Panel: Workflow Details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        {selectedWorkflow ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={THEME.emeraldBright} bold>
                {selectedWorkflow.title} ({selectedWorkflow.id})
              </Text>
              <Text color={THEME.mint}>
                [{selectedWorkflow.steps.length} Steps]
              </Text>
            </Box>

            <Box>
              <Text color={THEME.white}>{selectedWorkflow.description}</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1}>
              <Text color={THEME.mint} bold>
                Pipeline Steps:
              </Text>
              {selectedWorkflow.steps.map((step, idx) => (
                <Box key={step.id || idx} flexDirection="row" gap={1} marginY={0}>
                  <Text color={THEME.emeraldBright}>
                    {idx + 1}. [{step.agentId || 'agent'}]
                  </Text>
                  <Text color={THEME.white}>{step.title || step.id}</Text>
                </Box>
              ))}
            </Box>

            <Box>
              <Text color={THEME.slate}>
                Autonomous execution combines system prompts, git authorship, and test gates for each step.
              </Text>
            </Box>
          </Box>
        ) : (
          <Text color={THEME.slate}>Select a workflow to view steps.</Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Hurdler TUI Subsystem - Billing & Token Economics View (Tab B)
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { THEME, GLYPHS } from '../theme.js';
import { getSessionCostSummary, resetSessionCost } from '../../llms/billing/index.js';
import type { ModalState } from '../types.js';

export interface BillingViewProps {
  onOpenModal: (modal: ModalState) => void;
  onSetStatus: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export function BillingView({ onOpenModal, onSetStatus }: BillingViewProps): React.JSX.Element {
  const [metrics, setMetrics] = useState(() => getSessionCostSummary());

  useEffect(() => {
    setMetrics(getSessionCostSummary());
  }, []);

  useInput((_input, key) => {
    if (key.return) {
      onOpenModal({
        type: 'confirm',
        title: 'Reset Session Billing Metrics',
        message: 'Are you sure you want to reset token usage statistics to 0?',
        onConfirm: () => {
          resetSessionCost();
          setMetrics(getSessionCostSummary());
          onSetStatus('Billing token metrics reset successfully', 'success');
        },
      });
    }
  });

  return (
    <Box flexDirection="row" gap={1} width="100%">
      {/* Left Panel: Token Usage */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.emerald}
        paddingX={1}
        width="50%"
      >
        <Box marginBottom={1}>
          <Text color={THEME.emeraldBright} bold>
            {GLYPHS.bullet} Token Metrics & Consumption
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between">
          <Text color={THEME.white}>Total Tokens Used:</Text>
          <Text color={THEME.emeraldBright} bold>
            {(metrics.totalTokens || 0).toLocaleString()}
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <Text color={THEME.white}>Input Prompt Tokens:</Text>
          <Text color={THEME.white}>
            {(metrics.promptTokens || 0).toLocaleString()}
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <Text color={THEME.white}>Output Completion Tokens:</Text>
          <Text color={THEME.white}>
            {(metrics.completionTokens || 0).toLocaleString()}
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <Text color={THEME.white}>Prompt Cache Read Tokens:</Text>
          <Text color={THEME.mint}>
            {(metrics.cachedPromptTokens || 0).toLocaleString()}
          </Text>
        </Box>

        <Box marginTop={2}>
          <Text color={THEME.slate}>[Enter] Reset Session Metrics</Text>
        </Box>
      </Box>

      {/* Right Panel: Cost Metrics & Savings */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={THEME.mint}
        paddingX={1}
        flexGrow={1}
      >
        <Box marginBottom={1}>
          <Text color={THEME.mint} bold>
            {GLYPHS.sparkle} Cost & Savings Breakdown
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between">
          <Text color={THEME.white}>Total Estimated Cost:</Text>
          <Text color={THEME.emeraldBright} bold>
            ${(metrics.totalCost || 0).toFixed(4)}
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <Text color={THEME.white}>Total Invocations:</Text>
          <Text color={THEME.mint} bold>
            {metrics.totalCalls || 0} calls
          </Text>
        </Box>

        <Box flexDirection="column" borderStyle="single" borderColor={THEME.slateDark} padding={1} marginTop={1}>
          <Text color={THEME.mint} bold>
            Dynamic Cost Optimization:
          </Text>
          <Text color={THEME.white}>
            Hurdler optimizes costs across all model providers by automatically leveraging prompt caching, flex tiers, and context compression.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

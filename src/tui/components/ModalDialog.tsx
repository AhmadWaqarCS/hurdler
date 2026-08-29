/**
 * Hurdler TUI Subsystem - Modal Dialog Component
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ModalState } from '../types.js';
import { THEME, GLYPHS } from '../theme.js';

export interface ModalDialogProps {
  modal: ModalState;
  onClose: () => void;
}

export function ModalDialog({ modal, onClose }: ModalDialogProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState(modal.inputValue || '');
  const [selectedIndex, setSelectedIndex] = useState(modal.selectedIndex || 0);

  useInput((input, key) => {
    if (key.escape) {
      if (modal.onCancel) modal.onCancel();
      onClose();
      return;
    }

    if (modal.type === 'prompt') {
      if (key.return) {
        if (modal.onConfirm) modal.onConfirm(inputValue);
        onClose();
      } else if (key.backspace || key.delete) {
        setInputValue((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setInputValue((prev) => prev + input);
      }
    } else if (modal.type === 'confirm') {
      if (key.return || input === 'y' || input === 'Y') {
        if (modal.onConfirm) modal.onConfirm('yes');
        onClose();
      } else if (input === 'n' || input === 'N') {
        if (modal.onCancel) modal.onCancel();
        onClose();
      }
    } else if (modal.type === 'select' && modal.options) {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min((modal.options?.length || 1) - 1, prev + 1));
      } else if (key.return) {
        const selected = modal.options[selectedIndex];
        if (modal.onConfirm && selected) modal.onConfirm(selected.value);
        onClose();
      }
    } else if (modal.type === 'viewer') {
      if (key.return) {
        onClose();
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={THEME.emeraldBright}
      paddingX={2}
      paddingY={1}
      width="80%"
      alignSelf="center"
    >
      <Box marginBottom={1}>
        <Text color={THEME.emeraldBright} bold>
          {GLYPHS.sparkle} {modal.title}
        </Text>
      </Box>

      {modal.message && (
        <Box marginBottom={1}>
          <Text color={THEME.white}>{modal.message}</Text>
        </Box>
      )}

      {modal.type === 'prompt' && (
        <Box flexDirection="column" marginY={1}>
          <Box borderStyle="single" borderColor={THEME.mint} paddingX={1}>
            <Text color={THEME.mint}>&gt; </Text>
            <Text color={THEME.white}>{inputValue}</Text>
            <Text color={THEME.emeraldBright} bold>
              █
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={THEME.slate}>Press [Enter] to submit, [Esc] to cancel</Text>
          </Box>
        </Box>
      )}

      {modal.type === 'confirm' && (
        <Box flexDirection="column" marginY={1}>
          <Box flexDirection="row" gap={2}>
            <Text backgroundColor={THEME.bgEmerald} color={THEME.white} bold>
              {' [ Enter / Y: Confirm ] '}
            </Text>
            <Text color={THEME.slate}>[ Esc / N: Cancel ]</Text>
          </Box>
        </Box>
      )}

      {modal.type === 'select' && modal.options && (
        <Box flexDirection="column" marginY={1}>
          {modal.options.map((opt, i) => {
            const isSel = i === selectedIndex;
            return (
              <Box key={opt.value} flexDirection="row" gap={1}>
                <Text color={isSel ? THEME.emeraldBright : 'transparent'}>
                  {isSel ? GLYPHS.arrowRight : ' '}
                </Text>
                {isSel ? (
                  <Text backgroundColor={THEME.bgEmerald} color={THEME.white} bold>
                    {` ${opt.label} `}
                  </Text>
                ) : (
                  <Text color={THEME.white}>{opt.label}</Text>
                )}
                {opt.description && <Text color={THEME.slate}>- {opt.description}</Text>}
              </Box>
            );
          })}
          <Box marginTop={1}>
            <Text color={THEME.slate}>Use [↑↓] to choose, [Enter] to select, [Esc] to cancel</Text>
          </Box>
        </Box>
      )}

      {modal.type === 'viewer' && (
        <Box flexDirection="column" marginY={1}>
          <Box borderStyle="single" borderColor={THEME.slateDark} padding={1} maxHeight={15}>
            <Text color={THEME.white}>{modal.content}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={THEME.slate}>Press [Enter] or [Esc] to close</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

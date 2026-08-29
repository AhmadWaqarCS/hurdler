/**
 * Hurdler TUI Subsystem - Selectable List View Component
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ListItem } from '../types.js';
import { THEME, GLYPHS } from '../theme.js';

export interface ListViewProps {
  items: ListItem[];
  selectedIndex: number;
  maxVisible?: number;
  emptyMessage?: string;
}

export function ListView({
  items,
  selectedIndex,
  maxVisible = 10,
  emptyMessage = 'No items found.',
}: ListViewProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={THEME.slate}>{emptyMessage}</Text>
      </Box>
    );
  }

  const scrollOffset = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      Math.max(0, items.length - maxVisible)
    )
  );

  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, index) => {
        const itemIndex = scrollOffset + index;
        const isSelected = itemIndex === selectedIndex;

        return (
          <Box key={item.id || index} flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" gap={1}>
              <Text color={isSelected ? THEME.emeraldBright : 'transparent'}>
                {isSelected ? GLYPHS.arrowRight : ' '}
              </Text>
              {isSelected ? (
                <Text backgroundColor={THEME.bgEmerald} color={THEME.white} bold>
                  {` ${item.title} `}
                </Text>
              ) : (
                <Text color={THEME.white}>{item.title}</Text>
              )}
              {item.subtitle && (
                <Text color={THEME.slate}>- {item.subtitle}</Text>
              )}
            </Box>

            {item.badge && (
              <Box>
                <Text color={item.badgeColor || THEME.mint}>[{item.badge}]</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {items.length > maxVisible && (
        <Box marginTop={1}>
          <Text color={THEME.slate}>
            {`Showing ${scrollOffset + 1}-${Math.min(items.length, scrollOffset + maxVisible)} of ${items.length} (↑↓ to scroll)`}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Hurdler CLI Subsystem - Table Formatter
 * Generates clean Unicode / ASCII box tables with auto-column width and truncation.
 */

export interface TableColumn {
  /** Column key matching row object property */
  key: string;
  /** Header label displayed at top of table */
  label: string;
  /** Maximum width for column (default: 40) */
  maxWidth?: number;
  /** Minimum width for column (default: 5) */
  minWidth?: number;
  /** Alignment of text: 'left' | 'right' | 'center' */
  align?: 'left' | 'right' | 'center';
}

export interface TableOptions {
  /** Include outer border lines (default: true) */
  border?: boolean;
  /** Indent string prepended to each row (e.g. '  ') */
  indent?: string;
}

/**
 * Formats an array of objects into an ASCII/Unicode table string.
 */
export function formatTable(
  rows: Record<string, unknown>[],
  columns: TableColumn[],
  options: TableOptions = {}
): string {
  if (!rows || rows.length === 0) {
    return 'No entries found.';
  }

  const border = options.border ?? true;
  const indent = options.indent ?? '';

  // Calculate optimal width per column
  const widths: Record<string, number> = {};

  for (const col of columns) {
    let max = col.label.length;
    for (const row of rows) {
      const val = formatCellValue(row[col.key]);
      if (val.length > max) {
        max = val.length;
      }
    }
    const minW = col.minWidth ?? 4;
    const maxW = col.maxWidth ?? 50;
    widths[col.key] = Math.max(minW, Math.min(max, maxW));
  }

  const lines: string[] = [];

  // Top border
  if (border) {
    lines.push(
      indent +
        '┌' +
        columns.map((c) => '─'.repeat(widths[c.key] + 2)).join('┬') +
        '┐'
    );
  }

  // Header row
  const headerCells = columns.map((c) =>
    ` ${padString(c.label, widths[c.key], c.align ?? 'left')} `
  );
  lines.push(indent + (border ? '│' : '') + headerCells.join(border ? '│' : ' ') + (border ? '│' : ''));

  // Header separator
  if (border) {
    lines.push(
      indent +
        '├' +
        columns.map((c) => '─'.repeat(widths[c.key] + 2)).join('┼') +
        '┤'
    );
  } else {
    lines.push(
      indent +
        columns.map((c) => '─'.repeat(widths[c.key] + 2)).join(' ')
    );
  }

  // Data rows
  for (const row of rows) {
    const dataCells = columns.map((c) => {
      const formatted = formatCellValue(row[c.key]);
      const truncated = truncateString(formatted, widths[c.key]);
      return ` ${padString(truncated, widths[c.key], c.align ?? 'left')} `;
    });
    lines.push(indent + (border ? '│' : '') + dataCells.join(border ? '│' : ' ') + (border ? '│' : ''));
  }

  // Bottom border
  if (border) {
    lines.push(
      indent +
        '└' +
        columns.map((c) => '─'.repeat(widths[c.key] + 2)).join('┴') +
        '┘'
    );
  }

  return lines.join('\n');
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(0, maxLen - 3)) + '...';
}

function padString(str: string, width: number, align: 'left' | 'right' | 'center'): string {
  if (str.length >= width) return str.slice(0, width);
  const diff = width - str.length;

  if (align === 'right') {
    return ' '.repeat(diff) + str;
  }
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  }
  return str + ' '.repeat(diff);
}

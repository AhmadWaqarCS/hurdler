/**
 * Hurdler TUI Subsystem - Type Definitions & Interfaces
 */

import type { LogEntry } from '../core/dev-mode/types.js';

export type TuiTabId =
  | 'dashboard'
  | 'agents'
  | 'workflows'
  | 'llms'
  | 'prompts'
  | 'tools'
  | 'modules'
  | 'git'
  | 'code'
  | 'mapper'
  | 'browser'
  | 'billing';

export interface TuiTabDef {
  id: TuiTabId;
  label: string;
  shortcut: string;
  description: string;
}

export type ModalType = 'prompt' | 'confirm' | 'viewer' | 'select';

export interface ModalState {
  type: ModalType;
  title: string;
  message?: string;
  inputValue?: string;
  options?: Array<{ label: string; value: string; description?: string }>;
  selectedIndex?: number;
  content?: string;
  onConfirm?: (value: string) => Promise<void> | void;
  onCancel?: () => void;
}

export interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  data?: unknown;
}

export interface TuiOptions {
  dev?: boolean;
  initialTab?: TuiTabId;
  projectRoot?: string;
}

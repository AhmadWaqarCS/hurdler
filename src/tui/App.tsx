/**
 * Hurdler TUI Subsystem - Root React / Ink Application Component
 */

import React, { useEffect, useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import type { TuiOptions, TuiTabId, ModalState } from './types.js';
import type { LogEntry } from '../core/dev-mode/types.js';
import { subscribeDevLogs, getRecentDevLogs, isDevMode } from '../core/dev-mode/index.js';
import { getGitStatus } from '../git/index.js';

import { Header } from './components/Header.js';
import { TabsBar, TABS } from './components/TabsBar.js';
import { StatusBar } from './components/StatusBar.js';
import { ModalDialog } from './components/ModalDialog.js';

import { DevSidebar } from './views/DevSidebar.js';
import { DashboardView } from './views/DashboardView.js';
import { AgentsView } from './views/AgentsView.js';
import { WorkflowsView } from './views/WorkflowsView.js';
import { LlmsView } from './views/LlmsView.js';
import { PromptsView } from './views/PromptsView.js';
import { ToolsView } from './views/ToolsView.js';
import { ModulesView } from './views/ModulesView.js';
import { GitView } from './views/GitView.js';
import { CodeView } from './views/CodeView.js';
import { MapperView } from './views/MapperView.js';
import { BrowserView } from './views/BrowserView.js';
import { BillingView } from './views/BillingView.js';

export function App({ dev = false, initialTab = 'dashboard', projectRoot = process.cwd() }: TuiOptions): React.JSX.Element {
  const { exit } = useApp();

  const [activeTab, setActiveTab] = useState<TuiTabId>(initialTab);
  const [devSidebarOpen, setDevSidebarOpen] = useState<boolean>(Boolean(dev || isDevMode()));
  const [devLogs, setDevLogs] = useState<LogEntry[]>(() => getRecentDevLogs(50));
  const [gitBranch, setGitBranch] = useState<string>('main');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Press Tab or number keys (1-9, 0, u, b) to navigate.');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'warn' | 'error'>('info');
  const [activeModal, setActiveModal] = useState<ModalState | null>(null);

  // Subscribe to real-time Dev Mode logs
  useEffect(() => {
    const unsubscribe = subscribeDevLogs((entry) => {
      setDevLogs((prev) => [...prev.slice(-100), entry]);
    });

    // Detect git branch
    getGitStatus(projectRoot || process.cwd())
      .then((st) => {
        if (st.current) setGitBranch(st.current);
      })
      .catch(() => {});

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSetStatus = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setStatusMessage(msg);
    setStatusType(type);
  };

  // Global Keyboard Navigation
  useInput((input, key) => {
    // If a modal is open, modal handles inputs
    if (activeModal) return;

    // Quit
    if (input === 'q' || input === 'Q') {
      exit();
      return;
    }

    // Toggle Dev Logs
    if (input === 'd' || input === 'D') {
      setDevSidebarOpen((prev) => {
        const next = !prev;
        handleSetStatus(next ? 'Dev Mode live sidebar opened' : 'Dev Mode live sidebar closed', 'info');
        return next;
      });
      return;
    }

    // Refresh
    if (input === 'r' || input === 'R') {
      handleSetStatus('Refreshed active view data', 'success');
      return;
    }

    // Tab Cycling
    if (key.tab) {
      const curIdx = TABS.findIndex((t) => t.id === activeTab);
      const nextIdx = (curIdx + (key.shift ? -1 : 1) + TABS.length) % TABS.length;
      const nextTab = TABS[nextIdx];
      if (nextTab) {
        setActiveTab(nextTab.id);
        handleSetStatus(`Switched to ${nextTab.label}`, 'info');
      }
      return;
    }

    // Direct Number / Letter Shortcuts
    switch (input) {
      case '1':
        setActiveTab('dashboard');
        handleSetStatus('Dashboard Overview', 'info');
        break;
      case '2':
        setActiveTab('agents');
        handleSetStatus('AI Agents Registry', 'info');
        break;
      case '3':
        setActiveTab('workflows');
        handleSetStatus('Multi-Agent Workflows', 'info');
        break;
      case '4':
        setActiveTab('llms');
        handleSetStatus('LLM Models & API Keys', 'info');
        break;
      case '5':
        setActiveTab('prompts');
        handleSetStatus('Prompts Registry', 'info');
        break;
      case '6':
        setActiveTab('tools');
        handleSetStatus('Tools Registry', 'info');
        break;
      case '7':
        setActiveTab('modules');
        handleSetStatus('Recommended Modules', 'info');
        break;
      case '8':
        setActiveTab('git');
        handleSetStatus('Git Version Control', 'info');
        break;
      case '9':
        setActiveTab('code');
        handleSetStatus('Code Quality & AST', 'info');
        break;
      case '0':
        setActiveTab('mapper');
        handleSetStatus('Dynamic Architecture Mapper', 'info');
        break;
      case 'u':
      case 'U':
        setActiveTab('browser');
        handleSetStatus('Playwright Browser & UI', 'info');
        break;
      case 'b':
      case 'B':
        setActiveTab('billing');
        handleSetStatus('Billing & Token Usage', 'info');
        break;
    }
  });

  return (
    <Box flexDirection="column" width="100%" minHeight={20}>
      {/* Header */}
      <Header
        projectRoot={projectRoot}
        gitBranch={gitBranch}
        isDevMode={devSidebarOpen}
        isLoading={isLoading}
      />

      {/* Tabs Navigation Bar */}
      <TabsBar activeTab={activeTab} />

      {/* Main Body (Active Tab View + Optional Dev Sidebar) */}
      <Box flexDirection="row" gap={1} marginY={0} flexGrow={1}>
        <Box flexGrow={1} flexDirection="column">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'agents' && (
            <AgentsView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'workflows' && (
            <WorkflowsView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'llms' && (
            <LlmsView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'prompts' && (
            <PromptsView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'tools' && (
            <ToolsView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'modules' && (
            <ModulesView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'git' && (
            <GitView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'code' && (
            <CodeView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'mapper' && (
            <MapperView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'browser' && (
            <BrowserView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
          {activeTab === 'billing' && (
            <BillingView onOpenModal={setActiveModal} onSetStatus={handleSetStatus} />
          )}
        </Box>

        {devSidebarOpen && <DevSidebar logs={devLogs} width={42} />}
      </Box>

      {/* Modal Overlay Dialog */}
      {activeModal && (
        <ModalDialog modal={activeModal} onClose={() => setActiveModal(null)} />
      )}

      {/* Status Bar */}
      <StatusBar statusMessage={statusMessage} statusType={statusType} />
    </Box>
  );
}

/**
 * Hurdler TUI Subsystem - Dashboard Overview View (Tab 1)
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { THEME, GLYPHS } from '../theme.js';
import { defaultAgentRegistry } from '../../registries/agents/index.js';
import { listModels } from '../../registries/llms/index.js';
import { defaultToolRegistry } from '../../registries/tools/index.js';
import { defaultWorkflowRegistry } from '../../registries/workflows/index.js';
import { defaultPromptRegistry } from '../../registries/prompts/index.js';
import { defaultModuleRegistry } from '../../registries/modules/index.js';
import { getGitStatus } from '../../git/index.js';
import { getSessionCostSummary } from '../../llms/billing/index.js';
import { getEnvConfig } from '../../core/config/env.js';

export function DashboardView(): React.JSX.Element {
  const [stats, setStats] = useState({
    agentsCount: 0,
    modelsCount: 0,
    toolsCount: 0,
    workflowsCount: 0,
    promptsCount: 0,
    modulesCount: 0,
    gitBranch: 'main',
    gitClean: true,
    modifiedFiles: 0,
    totalTokens: 0,
    totalCost: 0,
    hasAnthropicKey: false,
    hasGoogleKey: false,
    hasOpenAIKey: false,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const agents = defaultAgentRegistry.getAll();
        const models = listModels();
        const tools = defaultToolRegistry.getAll();
        const workflows = defaultWorkflowRegistry.getAll();
        const prompts = defaultPromptRegistry.getAll();
        const modules = defaultModuleRegistry.listModules();

        let gitBranch = 'main';
        let gitClean = true;
        let modifiedFiles = 0;

        try {
          const status = await getGitStatus(process.cwd());
          gitBranch = status.current || 'main';
          gitClean = status.isClean;
          modifiedFiles = status.modified.length + status.staged.length + status.not_added.length;
        } catch {
          // fallback
        }

        const billing = getSessionCostSummary();
        const envConfig = getEnvConfig();

        setStats({
          agentsCount: agents.length,
          modelsCount: models.length,
          toolsCount: tools.length,
          workflowsCount: workflows.length,
          promptsCount: prompts.length,
          modulesCount: modules.length,
          gitBranch,
          gitClean,
          modifiedFiles,
          totalTokens: billing.totalTokens || 0,
          totalCost: billing.totalCost || 0,
          hasAnthropicKey: Boolean(envConfig.anthropicApiKey),
          hasGoogleKey: Boolean(envConfig.googleApiKey || envConfig.geminiApiKey),
          hasOpenAIKey: Boolean(envConfig.openaiApiKey),
        });
      } catch {
        // Safe swallow
      }
    }

    loadStats();
  }, []);

  return (
    <Box flexDirection="column" gap={1} width="100%">
      {/* Top Banner */}
      <Box borderStyle="round" borderColor={THEME.emerald} paddingX={1} flexDirection="column">
        <Text color={THEME.emeraldBright} bold>
          {GLYPHS.sparkle} Welcome to Hurdler AI Agentic Coding Platform
        </Text>
        <Text color={THEME.slate}>
          Autonomous multi-agent software engineering environment with Git authorship, AST refactoring, and Playwright verification.
        </Text>
      </Box>

      {/* Grid: 2 Columns */}
      <Box flexDirection="row" gap={1}>
        {/* Left Column: Registry Stats */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={THEME.mint}
          paddingX={1}
          flexGrow={1}
        >
          <Box marginBottom={1}>
            <Text color={THEME.mint} bold>
              {GLYPHS.diamond} System Registries
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>AI Agents:</Text>
            <Text color={THEME.emeraldBright} bold>
              {stats.agentsCount} Active
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Multi-Agent Workflows:</Text>
            <Text color={THEME.emeraldBright} bold>
              {stats.workflowsCount} Pipelines
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>LLM Models Catalog:</Text>
            <Text color={THEME.emeraldBright} bold>
              {stats.modelsCount} Models
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Tools Registry:</Text>
            <Text color={THEME.emeraldBright} bold>
              {stats.toolsCount} Schemas
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Prompts Registry:</Text>
            <Text color={THEME.emeraldBright} bold>
              {stats.promptsCount} Templates
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Recommended Modules:</Text>
            <Text color={THEME.emeraldBright} bold>
              {stats.modulesCount} Packages
            </Text>
          </Box>
        </Box>

        {/* Right Column: Health & Keys */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={THEME.mint}
          paddingX={1}
          flexGrow={1}
        >
          <Box marginBottom={1}>
            <Text color={THEME.mint} bold>
              {GLYPHS.bullet} Providers & Git Status
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Google / Gemini Key:</Text>
            {stats.hasGoogleKey ? (
              <Text color={THEME.emeraldBright} bold>
                {GLYPHS.check} CONFIGURED
              </Text>
            ) : (
              <Text color={THEME.yellow}>{GLYPHS.warning} UNSET</Text>
            )}
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Anthropic Key:</Text>
            {stats.hasAnthropicKey ? (
              <Text color={THEME.emeraldBright} bold>
                {GLYPHS.check} CONFIGURED
              </Text>
            ) : (
              <Text color={THEME.yellow}>{GLYPHS.warning} UNSET</Text>
            )}
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>OpenAI Key:</Text>
            {stats.hasOpenAIKey ? (
              <Text color={THEME.emeraldBright} bold>
                {GLYPHS.check} CONFIGURED
              </Text>
            ) : (
              <Text color={THEME.yellow}>{GLYPHS.warning} UNSET</Text>
            )}
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Git Branch:</Text>
            <Text color={THEME.mint} bold>
              {GLYPHS.branch} {stats.gitBranch}
            </Text>
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Working Tree:</Text>
            {stats.gitClean ? (
              <Text color={THEME.emeraldBright}>Clean</Text>
            ) : (
              <Text color={THEME.yellow}>{stats.modifiedFiles} modified</Text>
            )}
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.white}>Session Tokens / Cost:</Text>
            <Text color={THEME.white}>
              {stats.totalTokens.toLocaleString()} tokens (${stats.totalCost.toFixed(4)})
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Quick Tips */}
      <Box borderStyle="round" borderColor={THEME.slateDark} paddingX={1}>
        <Text color={THEME.slate}>
          Tip: Press <Text color={THEME.mint}>2</Text> for Agents, <Text color={THEME.mint}>3</Text> for Workflows, <Text color={THEME.mint}>4</Text> for LLMs & Keys, <Text color={THEME.mint}>8</Text> for Git, <Text color={THEME.mint}>d</Text> to toggle Dev Logs.
        </Text>
      </Box>
    </Box>
  );
}

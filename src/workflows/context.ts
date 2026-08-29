import path from 'node:path';
import type {
  WorkflowDefinition,
} from '../registries/workflows/types.js';
import type {
  WorkflowExecutionContext,
  WorkflowExecutionOptions,
  FileContextRecord,
  DynamicSymbolSummary,
} from './types.js';
import type { TokenUsage, CostBreakdown } from '../llms/billing/types.js';
import { codeService } from '../code/service.js';
import { devDebug } from '../core/dev-mode/index.js';

/**
 * Initializes a clean Workflow Execution Context.
 */
export function createExecutionContext(
  workflow: WorkflowDefinition,
  options: WorkflowExecutionOptions = {}
): WorkflowExecutionContext {
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : process.cwd();

  const repoPath = options.repoPath
    ? path.resolve(options.repoPath)
    : projectRoot;

  return {
    workflowId: workflow.id,
    workflowTitle: workflow.title,
    projectRoot,
    repoPath,
    currentBranch: workflow.initialBranch,
    variables: { ...options.variables },
    files: new Map<string, FileContextRecord>(),
    symbols: new Map<string, DynamicSymbolSummary>(),
    stepResults: new Map(),
    totalTokens: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedPromptTokens: 0,
    },
    totalCost: {
      inputCost: 0,
      outputCost: 0,
      cachedReadCost: 0,
      cachedWriteCost: 0,
      totalCost: 0,
      savingsFromCaching: 0,
      currency: 'USD',
    },
    startTime: Date.now(),
    dryRun: options.dryRun ?? false,
  };
}

/**
 * Records a file addition or modification in the dynamic codebase context,
 * automatically extracting AST symbol signatures to maintain the dynamic symbols registry.
 */
export function recordFileChange(
  context: WorkflowExecutionContext,
  filePath: string,
  action: 'created' | 'modified' | 'deleted' | 'read',
  content?: string,
  stepId = 'unknown',
  agentId?: string
): FileContextRecord {
  const normalizedPath = filePath.startsWith('/')
    ? path.relative(context.projectRoot, filePath)
    : filePath;

  let outlineMarkdown: string | undefined;
  const exportedSymbols: string[] = [];

  if (content && (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx') || normalizedPath.endsWith('.js') || normalizedPath.endsWith('.jsx'))) {
    try {
      const outline = codeService.ast.outline(content, { detailLevel: 'standard' });
      outlineMarkdown = outline.markdown;

      const inspection = codeService.ast.inspectText(content, normalizedPath);
      for (const fn of inspection.functions) {
        if (fn.isExported) {
          exportedSymbols.push(fn.name);
          context.symbols.set(`${normalizedPath}:${fn.name}`, {
            name: fn.name,
            kind: 'function',
            filePath: normalizedPath,
            signature: `function ${fn.name}(${fn.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${fn.returnType}`,
            stepId,
            agentId,
          });
        }
      }

      for (const iface of inspection.interfaces) {
        if (iface.isExported) {
          exportedSymbols.push(iface.name);
          context.symbols.set(`${normalizedPath}:${iface.name}`, {
            name: iface.name,
            kind: 'interface',
            filePath: normalizedPath,
            stepId,
            agentId,
          });
        }
      }

      for (const cls of inspection.classes) {
        if (cls.isExported) {
          exportedSymbols.push(cls.name);
          context.symbols.set(`${normalizedPath}:${cls.name}`, {
            name: cls.name,
            kind: 'class',
            filePath: normalizedPath,
            stepId,
            agentId,
          });
        }
      }
    } catch {
      // Non-fatal AST parsing error for scratch/partial snippets
    }
  }

  const record: FileContextRecord = {
    filePath: normalizedPath,
    action,
    lastModifiedStepId: stepId,
    lastModifiedAgentId: agentId,
    content,
    outlineMarkdown,
    exportedSymbols,
    timestamp: new Date().toISOString(),
  };

  context.files.set(normalizedPath, record);
  devDebug(
    'WORKFLOW_CONTEXT',
    `Recorded file '${normalizedPath}' [action: ${action}, step: ${stepId}, agent: ${agentId ?? 'system'}]`
  );

  return record;
}

/**
 * Formats the active dynamic codebase context and exported symbols
 * as structured markdown to be injected into downstream agent prompts.
 */
export function formatCodebaseContextForPrompt(
  context: WorkflowExecutionContext,
  maxFiles = 10
): string {
  if (context.files.size === 0 && context.symbols.size === 0) {
    return '';
  }

  const sections: string[] = ['## Dynamic Codebase Context (Files & Symbols in Workflow):'];

  if (context.symbols.size > 0) {
    sections.push('### Available Exported Symbols:');
    const symbolList: string[] = [];
    for (const [key, sym] of context.symbols.entries()) {
      const sig = sym.signature ? ` -> \`${sym.signature}\`` : '';
      symbolList.push(`- **${sym.name}** (\`${sym.kind}\` in \`${sym.filePath}\`)${sig}`);
    }
    sections.push(symbolList.slice(0, 20).join('\n'));
  }

  if (context.files.size > 0) {
    sections.push('### Touched Files:');
    const filesArray = Array.from(context.files.values()).slice(-maxFiles);
    for (const file of filesArray) {
      sections.push(
        `- \`${file.filePath}\` (${file.action} by ${file.lastModifiedAgentId ?? 'unknown'})${
          file.exportedSymbols && file.exportedSymbols.length > 0
            ? ` — Exports: ${file.exportedSymbols.map((s) => `\`${s}\``).join(', ')}`
            : ''
        }`
      );
      if (file.outlineMarkdown) {
        sections.push(`\n<details><summary>Outline for ${file.filePath}</summary>\n\n${file.outlineMarkdown}\n\n</details>`);
      }
    }
  }

  return sections.join('\n\n');
}

/**
 * Accumulates token counts and dollar costs into execution context.
 */
export function accumulateTokensAndCost(
  context: WorkflowExecutionContext,
  usage?: TokenUsage,
  cost?: CostBreakdown
): void {
  if (usage) {
    context.totalTokens.promptTokens += usage.promptTokens ?? 0;
    context.totalTokens.completionTokens += usage.completionTokens ?? 0;
    context.totalTokens.totalTokens += usage.totalTokens ?? 0;
    context.totalTokens.cachedPromptTokens += usage.cachedPromptTokens ?? 0;
  }

  if (cost) {
    context.totalCost.inputCost += cost.inputCost ?? 0;
    context.totalCost.outputCost += cost.outputCost ?? 0;
    context.totalCost.cachedReadCost += cost.cachedReadCost ?? 0;
    context.totalCost.cachedWriteCost += cost.cachedWriteCost ?? 0;
    context.totalCost.totalCost += cost.totalCost ?? 0;
    context.totalCost.savingsFromCaching += cost.savingsFromCaching ?? 0;
  }
}

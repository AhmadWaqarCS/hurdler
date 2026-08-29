import fs from 'node:fs/promises';
import path from 'node:path';
import { defaultAgentRegistry } from '../registries/agents/service.js';
import { defaultPromptRegistry } from '../registries/prompts/service.js';
import { defaultToolRegistry } from '../registries/tools/service.js';
import { callLLM } from '../llms/engine/call-llm.js';
import { codeService } from '../code/service.js';
import { devDebug, devInfo, devWarn } from '../core/dev-mode/index.js';
import {
  recordFileChange,
  formatCodebaseContextForPrompt,
  accumulateTokensAndCost,
} from './context.js';
import { prepareStepBranch, commitStepChanges } from './git-step-handler.js';
import { runAutoDebugLoop } from './debugger-loop.js';
import { WorkflowStepError } from '../registries/workflows/errors.js';
import type {
  WorkflowStepDefinition,
} from '../registries/workflows/types.js';
import type {
  WorkflowExecutionContext,
  WorkflowExecutionOptions,
  WorkflowStepResult,
} from './types.js';
import type { ValidateAndPrettifyResult } from '../code/types.js';

/**
 * Extracts written or modified file paths from LLM generated text.
 */
function extractFilesFromResponse(text: string): { filePath: string; content: string }[] {
  const files: { filePath: string; content: string }[] = [];
  const fileRegex = /```(?:[a-zA-Z0-9_-]+)?\s*(?:file|filepath|path)?[:=]?\s*([^\n\r]+)\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(text)) !== null) {
    const rawPath = match[1].trim().replace(/^['"`]|['"`]$/g, '');
    const content = match[2];
    if (rawPath && !rawPath.includes(' ') && rawPath.includes('.')) {
      files.push({ filePath: rawPath, content });
    }
  }

  return files;
}

/**
 * Executes a single workflow step with full context binding, tool resolution,
 * automatic verification, and Git author commits.
 */
export async function executeStep(
  step: WorkflowStepDefinition,
  context: WorkflowExecutionContext,
  options: WorkflowExecutionOptions = {}
): Promise<WorkflowStepResult> {
  const startTime = Date.now();
  devInfo('WORKFLOW_STEP', `Executing step '${step.id}' (${step.title}) [mode: ${step.executionMode}]`);

  if (options.hooks?.onStepStart) {
    await options.hooks.onStepStart(step, context);
  }

  // 1. Prepare Git Branch
  await prepareStepBranch(step, context);

  let status: 'success' | 'failed' | 'skipped' = 'success';
  let outputs: string | Record<string, unknown> | undefined;
  const modifiedFiles: string[] = [];
  const lintResults: ValidateAndPrettifyResult[] = [];
  let gitCommitHash: string | undefined;
  let gitAuthor = step.agentId
    ? defaultAgentRegistry.getGitAuthor(step.agentId)
    : undefined;
  let errorMsg: string | undefined;

  try {
    // 2. Dispatch by Execution Mode
    if (step.executionMode === 'parallel' && step.parallelSteps && step.parallelSteps.length > 0) {
      // Parallel execution of sub-steps
      devInfo(
        'WORKFLOW_STEP',
        `Running ${step.parallelSteps.length} parallel sub-steps for '${step.id}'`
      );
      const subResults = await Promise.all(
        step.parallelSteps.map((subStep: WorkflowStepDefinition) =>
          executeStep(subStep, context, options)
        )
      );

      for (const res of subResults) {
        modifiedFiles.push(...res.modifiedFiles);
        if (res.lintResults) lintResults.push(...res.lintResults);
        if (res.status === 'failed' && !step.optional) {
          status = 'failed';
          errorMsg = res.error;
        }
      }
      outputs = { parallelResults: subResults };
    } else if (step.executionMode === 'automated') {
      // Automated non-LLM step (e.g. linting all touched files or verification)
      devInfo('WORKFLOW_STEP', `Running automated verification pipeline for '${step.id}'`);
      for (const fileRecord of context.files.values()) {
        if (fileRecord.action !== 'deleted') {
          const resolved = path.resolve(context.projectRoot, fileRecord.filePath);
          try {
            const lintRes = await codeService.pipeline.validateAndPrettify(resolved, {
              fixLint: true,
              projectRoot: context.projectRoot,
            });
            lintResults.push(lintRes);
            modifiedFiles.push(fileRecord.filePath);
          } catch {
            // non-fatal for non-code files
          }
        }
      }
      outputs = `Automated verification completed for ${modifiedFiles.length} file(s).`;
    } else {
      // Agent Execution Mode
      const agentId = step.agentId ?? 'orchestrator';
      const agentDef = defaultAgentRegistry.getOrNull(agentId);
      gitAuthor = defaultAgentRegistry.getGitAuthor(agentId);

      if (context.dryRun) {
        outputs = `[DRY-RUN] Simulated step execution by agent '${agentId}' for '${step.id}'`;
        devInfo('WORKFLOW_STEP', String(outputs));
      } else {
        // Build dynamic codebase context
        const codebaseContext = formatCodebaseContextForPrompt(context);

        // Combine inlinePrompts with extra instructions
        const inlineText =
          step.inlinePrompts && step.inlinePrompts.length > 0
            ? step.inlinePrompts.join('\n\n')
            : '';

        const extraInstructions = [inlineText, codebaseContext]
          .filter(Boolean)
          .join('\n\n');

        // Compile Agent Context
        const compiledContext = defaultAgentRegistry.compileAgentContext(
          agentId,
          {
            extraPrompts: step.prompts,
            extraInstructions: extraInstructions || undefined,
            variables: {
              stepId: step.id,
              stepTitle: step.title,
              stepDescription: step.description ?? '',
              ...context.variables,
            },
          },
          defaultPromptRegistry
        );

        // Resolve AI SDK tools
        const effectiveTools =
          step.tools.length > 0
            ? defaultToolRegistry.resolveTools({
                names: step.tools.includes('*') ? undefined : step.tools,
                excludeNames: step.disallowedTools,
              })
            : undefined;

        const provider = compiledContext.preferredModel?.provider ?? 'google';
        const model = compiledContext.preferredModel?.model ?? 'gemini-2.5-flash';
        const tier = options.modelTierOverride ?? step.modelTier ?? compiledContext.preferredModel?.tier ?? 'standard';

        const prompt = `${step.description ?? step.title}\n\nPlease perform this step adhering strictly to the KISS philosophy, domain boundaries, and feature isolation.`;

        const response = await callLLM({
          provider,
          model,
          tier,
          system: compiledContext.systemPrompt,
          prompt,
          tools: effectiveTools,
          temperature: step.temperature ?? 0.2,
          maxTokens: step.maxTokens,
          reasoningEffort: step.reasoningEffort ?? compiledContext.preferredModel?.reasoningEffort,
          abortSignal: options.abortSignal,
        });

        accumulateTokensAndCost(context, response.usage, response.cost);
        outputs = response.text;

        // Extract and write any created/modified files
        const extractedFiles = extractFilesFromResponse(response.text);
        for (const file of extractedFiles) {
          const absPath = path.resolve(context.projectRoot, file.filePath);
          await fs.mkdir(path.dirname(absPath), { recursive: true });
          await fs.writeFile(absPath, file.content, 'utf8');
          modifiedFiles.push(file.filePath);

          recordFileChange(
            context,
            file.filePath,
            'modified',
            file.content,
            step.id,
            agentId
          );
        }
      }
    }

    // 3. Post-Step Automated Linting & Prettification Pipeline
    if (
      options.autoLint !== false &&
      step.lintAction?.enabled !== false &&
      modifiedFiles.length > 0 &&
      !context.dryRun
    ) {
      for (const filePath of modifiedFiles) {
        const absPath = path.resolve(context.projectRoot, filePath);
        try {
          const lintRes = await codeService.pipeline.validateAndPrettify(absPath, {
            fixLint: step.lintAction?.fix ?? true,
            projectRoot: context.projectRoot,
          });

          lintResults.push(lintRes);
          if (options.hooks?.onLintChecked) {
            await options.hooks.onLintChecked(filePath, lintRes, context);
          }

          // 4. Auto-Debugger Remediation Loop on Lint Failures
          if (
            !lintRes.isValid &&
            step.lintAction?.autoDebug !== false &&
            options.autoDebug !== false
          ) {
            const debugRes = await runAutoDebugLoop(
              filePath,
              lintRes,
              context,
              step.lintAction?.maxDebugRetries ?? 3
            );
            if (!debugRes.success && !step.optional) {
              status = 'failed';
              errorMsg = `Lint validation failed for '${filePath}' after auto-debugger attempts.`;
            }
          }
        } catch {
          // Ignore non-JS/TS files
        }
      }
    }

    // 5. Post-Step Git Staging & Multi-Agent Author Commit
    if (
      options.autoCommit !== false &&
      step.gitAction?.commit !== false &&
      modifiedFiles.length > 0
    ) {
      const commitRes = await commitStepChanges(step, modifiedFiles, context);
      if (commitRes.committed && commitRes.commitHash) {
        gitCommitHash = commitRes.commitHash;
        if (commitRes.gitAuthor) gitAuthor = commitRes.gitAuthor;
        if (options.hooks?.onGitCommit && commitRes.gitAuthor && commitRes.message) {
          await options.hooks.onGitCommit(commitRes.commitHash, commitRes.gitAuthor, commitRes.message, context);
        }
      }
    }
  } catch (err: any) {
    status = 'failed';
    errorMsg = err instanceof Error ? err.message : String(err);
    devWarn('WORKFLOW_STEP', `Step '${step.id}' failed: ${errorMsg}`);
    if (options.hooks?.onStepError) {
      await options.hooks.onStepError(step, err instanceof Error ? err : new Error(errorMsg), context);
    }
    if (!step.optional && options.stopOnError !== false) {
      throw new WorkflowStepError(step.id, context.workflowId, errorMsg, { originalError: err });
    }
  }

  const durationMs = Date.now() - startTime;
  const result: WorkflowStepResult = {
    stepId: step.id,
    stepTitle: step.title,
    agentId: step.agentId,
    status,
    executionMode: step.executionMode,
    outputs,
    modifiedFiles,
    lintResults: lintResults.length > 0 ? lintResults : undefined,
    gitCommitHash,
    gitAuthor,
    durationMs,
    error: errorMsg,
    timestamp: new Date().toISOString(),
  };

  context.stepResults.set(step.id, result);

  if (options.hooks?.onStepComplete) {
    await options.hooks.onStepComplete(step, result, context);
  }

  devInfo(
    'WORKFLOW_STEP',
    `Completed step '${step.id}' in ${durationMs}ms [status: ${status}, modified: ${modifiedFiles.length} file(s)]`
  );

  return result;
}

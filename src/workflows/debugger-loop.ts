import fs from 'node:fs/promises';
import path from 'node:path';
import { codeService } from '../code/service.js';
import { defaultAgentRegistry } from '../registries/agents/service.js';
import { defaultPromptRegistry } from '../registries/prompts/service.js';
import { callLLM } from '../llms/engine/call-llm.js';
import { devInfo, devWarn } from '../core/dev-mode/index.js';
import { recordFileChange, accumulateTokensAndCost } from './context.js';
import type { ValidateAndPrettifyResult } from '../code/types.js';
import type { WorkflowExecutionContext } from './types.js';

export interface AutoDebugLoopResult {
  success: boolean;
  attempts: number;
  finalLintResult: ValidateAndPrettifyResult;
  repairedContent?: string;
}

/**
 * Executes an automated self-healing debugger loop for code that failed lint or AST verification.
 * Automatically delegates to the 'debugger' agent with formatted diagnostic reports.
 */
export async function runAutoDebugLoop(
  filePath: string,
  initialLintResult: ValidateAndPrettifyResult,
  context: WorkflowExecutionContext,
  maxRetries = 3
): Promise<AutoDebugLoopResult> {
  if (initialLintResult.isValid) {
    return {
      success: true,
      attempts: 0,
      finalLintResult: initialLintResult,
      repairedContent: initialLintResult.output,
    };
  }

  devInfo(
    'AUTO_DEBUG',
    `Starting self-healing debugger loop for '${filePath}' (${initialLintResult.errorCount} errors, ${initialLintResult.warningCount} warnings, maxRetries: ${maxRetries})`
  );

  let currentLintResult = initialLintResult;
  let attempts = 0;

  if (context.dryRun) {
    devInfo(
      'AUTO_DEBUG',
      `[DRY-RUN] Simulated successful debugger repair for '${filePath}'`
    );
    return {
      success: true,
      attempts: 1,
      finalLintResult: {
        ...initialLintResult,
        isValid: true,
        formatted: true,
        errorCount: 0,
        messages: [],
      },
      repairedContent: initialLintResult.output,
    };
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(context.projectRoot, filePath);

  while (attempts < maxRetries && !currentLintResult.isValid) {
    attempts++;
    devInfo('AUTO_DEBUG', `Auto-debugger attempt ${attempts}/${maxRetries} for '${filePath}'`);

    const diagnosticReport =
      currentLintResult.llmDiagnosticSummary ??
      `Lint Errors in ${filePath} (${currentLintResult.errorCount} errors):\n` +
        currentLintResult.messages
          .map((m) => `  - Line ${m.line}:${m.column} [${m.ruleId ?? 'error'}]: ${m.message}`)
          .join('\n');

    const currentCode =
      currentLintResult.output ??
      (await fs.readFile(resolvedPath, 'utf8').catch(() => ''));

    // Compile Debugger Agent context
    const debuggerContext = defaultAgentRegistry.compileAgentContext(
      'debugger',
      {
        extraInstructions: `You are repairing automated lint/compilation errors in file: ${filePath}.\nDiagnose the root cause and output ONLY the complete repaired file contents with no markdown backticks or commentary if possible, or clear code blocks.`,
        variables: {
          filePath,
          errorCount: String(currentLintResult.errorCount),
        },
      },
      defaultPromptRegistry
    );

    const prompt = `### File to Repair: \`${filePath}\`\n\n### Lint & Diagnostics:\n${diagnosticReport}\n\n### Current Code:\n\`\`\`typescript\n${currentCode}\n\`\`\`\n\nPlease provide the complete corrected code that resolves all errors strictly following KISS and zero regressions.`;

    try {
      const response = await callLLM({
        provider: debuggerContext.preferredModel?.provider ?? 'google',
        model: debuggerContext.preferredModel?.model ?? 'gemini-2.5-flash',
        tier: debuggerContext.preferredModel?.tier ?? 'standard',
        system: debuggerContext.systemPrompt,
        prompt,
        temperature: 0.1,
      });

      accumulateTokensAndCost(context, response.usage, response.cost);

      let repairedCode = response.text.trim();
      if (repairedCode.startsWith('```')) {
        const lines = repairedCode.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) lines.pop();
        repairedCode = lines.join('\n');
      }

      await fs.writeFile(resolvedPath, repairedCode, 'utf8');

      // Re-run validation pipeline
      currentLintResult = await codeService.pipeline.validateAndPrettify(resolvedPath, {
        fixLint: true,
        projectRoot: context.projectRoot,
      });

      recordFileChange(
        context,
        filePath,
        'modified',
        currentLintResult.output ?? repairedCode,
        'auto-debug',
        'debugger'
      );

      if (currentLintResult.isValid) {
        devInfo(
          'AUTO_DEBUG',
          `Auto-debugger successfully fixed '${filePath}' on attempt ${attempts}!`
        );
        return {
          success: true,
          attempts,
          finalLintResult: currentLintResult,
          repairedContent: currentLintResult.output ?? repairedCode,
        };
      }
    } catch (err) {
      devWarn('AUTO_DEBUG', `Auto-debugger attempt ${attempts} failed with execution error: ${err}`);
    }
  }

  devWarn(
    'AUTO_DEBUG',
    `Auto-debugger could not fully resolve errors in '${filePath}' after ${attempts} attempts.`
  );

  return {
    success: currentLintResult.isValid,
    attempts,
    finalLintResult: currentLintResult,
    repairedContent: currentLintResult.output,
  };
}

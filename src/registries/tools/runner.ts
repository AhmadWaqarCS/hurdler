import { devDebug, devError, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import type { NativeToolDefinition, ToolExecutionContext, ToolExecutionResult } from './types.js';

/**
 * Executes a native tool safely with runtime parameter validation, execution timing,
 * dev-mode logging, and structured error reporting.
 */
export async function executeTool<TInput = any, TOutput = any>(
  tool: NativeToolDefinition<TInput, TOutput>,
  input: unknown,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult<TOutput>> {
  const startTime = Date.now();
  const toolName = tool.name;

  devDebug('TOOL_EXECUTION', `Executing tool '${toolName}'`, {
    toolName,
    category: tool.category,
    input,
    context: {
      workspaceRoot: context?.workspaceRoot,
      agentId: context?.agentId,
      workflowId: context?.workflowId,
      timeoutMs: context?.timeoutMs,
    },
  });

  // Parameter validation against Zod schema
  const parsed = tool.parameters.safeParse(input);
  if (!parsed.success) {
    const errorMsg = `Parameter validation failed for tool '${toolName}': ${JSON.stringify(parsed.error.issues)}`;
    devWarn('TOOL_EXECUTION', errorMsg, { issues: parsed.error.issues });
    return {
      toolName,
      success: false,
      error: errorMsg,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    let executionPromise = tool.execute(parsed.data, context);

    // Optional timeout enforcement
    if (context?.timeoutMs && context.timeoutMs > 0) {
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Tool '${toolName}' execution timed out after ${context.timeoutMs}ms`));
        }, context.timeoutMs);
      });

      executionPromise = Promise.race([
        executionPromise.finally(() => clearTimeout(timeoutHandle)),
        timeoutPromise,
      ]);
    }

    const output = await executionPromise;
    const durationMs = Date.now() - startTime;

    devInfo('TOOL_EXECUTION', `Tool '${toolName}' executed successfully in ${durationMs}ms`, {
      toolName,
      durationMs,
    });

    return {
      toolName,
      success: true,
      output,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    devError('TOOL_EXECUTION', `Tool '${toolName}' failed after ${durationMs}ms: ${errorMessage}`, err, {
      toolName,
      input,
      durationMs,
    });

    return {
      toolName,
      success: false,
      error: errorMessage,
      durationMs,
    };
  }
}

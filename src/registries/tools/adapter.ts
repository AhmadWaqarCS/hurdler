import { tool as createAiTool, type Tool } from 'ai';
import { executeTool } from './runner.js';
import type { NativeToolDefinition, ToolExecutionContext } from './types.js';

/**
 * Converts a Hurdler NativeToolDefinition into a Vercel AI SDK compatible Tool object.
 */
export function toAISDKTool(
  toolDef: NativeToolDefinition,
  context?: ToolExecutionContext
): Tool {
  return createAiTool({
    description: toolDef.description,
    inputSchema: toolDef.parameters as any,
    execute: async (input: any) => {
      const result = await executeTool(toolDef, input, context);
      if (!result.success) {
        return {
          error: result.error,
        };
      }
      return result.output;
    },
  } as any);
}

/**
 * Converts an array or list of NativeToolDefinitions into a Record<string, Tool> map
 * ready for direct consumption by callLLM({ tools }) and streamLLM({ tools }).
 */
export function toAISDKToolMap(
  tools: NativeToolDefinition[],
  context?: ToolExecutionContext
): Record<string, Tool> {
  const map: Record<string, Tool> = {};
  for (const toolDef of tools) {
    map[toolDef.name] = toAISDKTool(toolDef, context);
  }
  return map;
}

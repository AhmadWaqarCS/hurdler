import type { ModelMessage, Tool, TextStreamPart } from 'ai';
import type { z } from 'zod';
import type { ApiTier, ThinkingEffort } from '../../registries/llms/types.js';
import type { CostBreakdown, TokenUsage } from '../billing/types.js';

export interface BaseLLMOptions {
  /** Target LLM provider ID (e.g. 'anthropic', 'google', 'google-vertex') */
  provider: string;
  /** Target Model ID (e.g. 'claude-sonnet-5', 'gemini-3.7-flash') */
  model: string;
  /** API Tier to use (default: 'standard') */
  tier?: ApiTier;
  /** Direct text prompt */
  prompt?: string;
  /** Array of multi-turn conversation messages */
  messages?: ModelMessage[];
  /** System instructions */
  system?: string;
  /** Cached prompt content or messages to apply prompt caching where supported */
  cachedPrompt?: string | ModelMessage[];
  /** Tools registry / tools dictionary to make available to the LLM */
  tools?: Record<string, Tool>;
  /** Sampling temperature (0.0 to 2.0) */
  temperature?: number;
  /** Maximum number of output tokens */
  maxTokens?: number;
  /** Nucleus sampling top_p */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Seed for deterministic generation */
  seed?: number;
  /** Maximum retry attempts across keys on rate limits or failures (default: 3) */
  maxRetries?: number;
  /** Abort signal for request cancellation */
  abortSignal?: AbortSignal;
  /** Custom HTTP headers for the provider API request */
  headers?: Record<string, string>;
  /** Custom base URL for the provider API */
  baseURL?: string;
  /** Reasoning / Thinking effort level ('low' | 'medium' | 'high' | 'xhigh' | 'max') */
  reasoningEffort?: ThinkingEffort;
  /** Alias for reasoningEffort */
  effort?: ThinkingEffort;
}

export interface CallLLMOptions<T = unknown> extends BaseLLMOptions {
  /** Optional Zod schema for structured output generation */
  schema?: z.ZodType<T>;
  /** Name of the structured output schema */
  schemaName?: string;
  /** Description of the structured output schema */
  schemaDescription?: string;
}

export interface LLMResponse<T = unknown> {
  /** Generated text response */
  text: string;
  /** Structured output if schema was provided */
  object?: T;
  /** Tool calls invoked during execution */
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
  }>;
  /** Results from tool executions */
  toolResults?: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
    output: unknown;
  }>;
  /** Finish reason (e.g. 'stop', 'length', 'tool-calls', etc.) */
  finishReason: string;
  /** Exact token usage breakdown */
  usage: TokenUsage;
  /** Exact cost calculations and caching savings */
  cost: CostBreakdown;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** API tier used */
  tier: ApiTier;
  /** Key index used from the provider key pool */
  keyIndex: number;
  /** Masked key for audit identification */
  maskedKey: string;
  /** Response metadata */
  response?: unknown;
}

export interface StreamLLMOptions extends BaseLLMOptions {}

export interface StreamLLMResponse {
  /** Asynchronous stream of text chunks */
  textStream: AsyncIterable<string>;
  /** Asynchronous stream of all stream parts (text, tool calls, reasoning) */
  fullStream: AsyncIterable<TextStreamPart<any>>;
  /** Promise that resolves to final token usage, cost, and finish reason once stream finishes */
  getFinalStats(): Promise<{
    text: string;
    usage: TokenUsage;
    cost: CostBreakdown;
    finishReason: string;
  }>;
  /** Helper to pipe text stream into Web Response */
  toTextStreamResponse(init?: ResponseInit): Response;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** API tier used */
  tier: ApiTier;
  /** Key index used */
  keyIndex: number;
  /** Masked key used */
  maskedKey: string;
}

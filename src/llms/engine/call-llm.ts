import { generateText, Output, type ModelMessage } from 'ai';
import { devDebug, devError, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import { defaultLLMRegistry } from '../../registries/llms/service.js';
import { calculateCost, normalizeUsage } from '../billing/calculator.js';
import { defaultCostTracker } from '../billing/tracker.js';
import { defaultKeyManager } from '../keys/key-manager.js';
import { createLanguageModel } from '../providers/factory.js';
import { LLMExecutionError, LLMValidationError } from './errors.js';
import type { CallLLMOptions, LLMResponse } from './types.js';

/**
 * Builds messages array supporting prompt caching and system instructions.
 */
function buildMessages(options: CallLLMOptions): { system?: string; messages: ModelMessage[] } {
  let system = options.system;
  const messages: ModelMessage[] = [];

  // Handle cached prompt if provided
  if (options.cachedPrompt) {
    if (typeof options.cachedPrompt === 'string') {
      system = system ? `${options.cachedPrompt}\n\n${system}` : options.cachedPrompt;
    } else if (Array.isArray(options.cachedPrompt)) {
      messages.push(...options.cachedPrompt);
    }
  }

  if (options.messages && options.messages.length > 0) {
    messages.push(...options.messages);
  } else if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }

  return { system, messages };
}

/**
 * Executes a direct (non-streaming) LLM request with automatic multi-key failover,
 * token usage tracking, and exact cost billing calculations.
 */
export async function callLLM<T = unknown>(options: CallLLMOptions<T>): Promise<LLMResponse<T>> {
  if (!options.provider) {
    throw new LLMValidationError("Field 'provider' is required.");
  }
  if (!options.model) {
    throw new LLMValidationError("Field 'model' is required.");
  }
  if (!options.prompt && (!options.messages || options.messages.length === 0)) {
    throw new LLMValidationError("Either 'prompt' or non-empty 'messages' must be provided.");
  }

  const startTime = Date.now();

  // Validate provider, model, and tier against registry
  const { provider, model, tier, pricing } = defaultLLMRegistry.validateModelSupport(
    options.provider,
    options.model,
    options.tier
  );

  const { system, messages } = buildMessages(options);
  const maxRetries = options.maxRetries ?? 3;
  let lastError: unknown = null;

  const mode = options.schema ? 'structured' : options.tools ? 'tools' : 'text';
  devInfo(
    'LLM',
    `Initiating call to ${provider.id}:${model.id} (Tier: ${tier}, Mode: ${mode})`,
    {
      provider: provider.id,
      model: model.id,
      tier,
      mode,
      schemaName: options.schemaName,
      tools: options.tools ? Object.keys(options.tools) : undefined,
      messageCount: messages.length,
      hasCachedPrompt: Boolean(options.cachedPrompt),
    }
  );

  // Check if model accepts custom sampling parameters (e.g. Claude Sonnet 5 returns 400 if set)
  const allowCustomSampling = model.capabilities.supportsCustomSamplingParams !== false;
  const temperature = allowCustomSampling
    ? options.temperature ?? model.capabilities.defaultTemperature
    : undefined;
  const topP = allowCustomSampling ? options.topP : undefined;
  const frequencyPenalty = allowCustomSampling ? options.frequencyPenalty : undefined;
  const presencePenalty = allowCustomSampling ? options.presencePenalty : undefined;

  // Build provider options for reasoning effort (e.g. Anthropic effort levels)
  const targetEffort = options.effort ?? options.reasoningEffort;
  const providerOptions: Record<string, Record<string, any>> = {};
  if (targetEffort) {
    if (provider.id === 'anthropic') {
      providerOptions.anthropic = { effort: targetEffort };
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const activeKeyInfo = defaultKeyManager.getActiveKey(provider.id);

    if (attempt > 0) {
      devWarn(
        'LLM',
        `Retrying call to ${provider.id}:${model.id} (Attempt ${attempt + 1}/${maxRetries + 1}) with key ${activeKeyInfo.maskedKey}`
      );
    } else {
      devDebug(
        'LLM',
        `Using key index ${activeKeyInfo.index} (${activeKeyInfo.maskedKey}) for ${provider.id}`
      );
    }

    try {
      const languageModel = createLanguageModel(provider.id, model.id, {
        apiKey: activeKeyInfo.key,
        baseURL: options.baseURL,
        headers: options.headers,
      });

      if (options.schema) {
        // Modern Structured Object generation via generateText({ output: Output.object(...) })
        const result = await generateText({
          model: languageModel,
          output: Output.object({
            schema: options.schema,
            name: options.schemaName,
            description: options.schemaDescription,
          }),
          system,
          messages,
          providerOptions: Object.keys(providerOptions).length > 0 ? (providerOptions as any) : undefined,
          temperature,
          maxOutputTokens: options.maxTokens,
          topP,
          frequencyPenalty,
          presencePenalty,
          seed: options.seed,
          abortSignal: options.abortSignal,
        });

        defaultKeyManager.markKeySuccess(provider.id, activeKeyInfo.key);

        const usage = normalizeUsage(result.usage);
        const cost = calculateCost(usage, pricing);
        const durationMs = Date.now() - startTime;

        defaultCostTracker.recordCall({
          providerId: provider.id,
          modelId: model.id,
          tier,
          usage,
          cost,
        });

        devInfo(
          'LLM',
          `Structured call succeeded for ${provider.id}:${model.id}. Tokens: ${usage.totalTokens} (Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Cached: ${usage.cachedPromptTokens}). Cost: $${cost.totalCost.toFixed(6)}`,
          {
            finishReason: result.finishReason,
            usage,
            cost,
            keyIndex: activeKeyInfo.index,
            maskedKey: activeKeyInfo.maskedKey,
          },
          durationMs
        );

        return {
          text: result.text || JSON.stringify(result.output, null, 2),
          object: result.output as T,
          finishReason: result.finishReason ?? 'stop',
          usage,
          cost,
          provider: provider.id,
          model: model.id,
          tier,
          keyIndex: activeKeyInfo.index,
          maskedKey: activeKeyInfo.maskedKey,
          response: result.finalStep?.response,
        };
      }

      // Standard Text generation (with optional tool calling)
      const result = await generateText({
        model: languageModel,
        system,
        messages,
        tools: options.tools,
        providerOptions: Object.keys(providerOptions).length > 0 ? (providerOptions as any) : undefined,
        temperature,
        maxOutputTokens: options.maxTokens,
        topP,
        frequencyPenalty,
        presencePenalty,
        seed: options.seed,
        abortSignal: options.abortSignal,
      });

      defaultKeyManager.markKeySuccess(provider.id, activeKeyInfo.key);

      const usage = normalizeUsage(result.usage);
      const cost = calculateCost(usage, pricing);
      const durationMs = Date.now() - startTime;

      defaultCostTracker.recordCall({
        providerId: provider.id,
        modelId: model.id,
        tier,
        usage,
        cost,
      });

      const toolCalls = result.toolCalls?.map((tc: any) => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: tc.input ?? tc.args,
      }));

      const toolResults = result.toolResults?.map((tr: any) => ({
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        input: tr.input ?? tr.args,
        output: tr.output ?? tr.result,
      }));

      devInfo(
        'LLM',
        `Call succeeded for ${provider.id}:${model.id}. Tokens: ${usage.totalTokens} (Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Cached: ${usage.cachedPromptTokens}). Cost: $${cost.totalCost.toFixed(6)}`,
        {
          finishReason: result.finishReason,
          toolCallsCount: toolCalls?.length ?? 0,
          usage,
          cost,
          keyIndex: activeKeyInfo.index,
          maskedKey: activeKeyInfo.maskedKey,
        },
        durationMs
      );

      return {
        text: result.text,
        toolCalls,
        toolResults,
        finishReason: result.finishReason ?? 'stop',
        usage,
        cost,
        provider: provider.id,
        model: model.id,
        tier,
        keyIndex: activeKeyInfo.index,
        maskedKey: activeKeyInfo.maskedKey,
        response: result.finalStep?.response,
      };
    } catch (error) {
      lastError = error;
      devWarn(
        'LLM',
        `Call attempt ${attempt + 1} failed for ${provider.id}:${model.id} using key ${activeKeyInfo.maskedKey}: ${error instanceof Error ? error.message : String(error)}`,
        { provider: provider.id, model: model.id, key: activeKeyInfo.maskedKey, error }
      );
      // Mark key as failed; rotates key index automatically
      defaultKeyManager.markKeyFailure(provider.id, activeKeyInfo.key, error);

      // If this was the last attempt, loop will terminate
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  devError(
    'LLM',
    `Call failed permanently for ${provider.id}:${model.id} after ${maxRetries + 1} attempt(s): ${errorMessage}`,
    lastError,
    { provider: provider.id, model: model.id, tier }
  );
  throw new LLMExecutionError(provider.id, model.id, errorMessage, lastError);
}


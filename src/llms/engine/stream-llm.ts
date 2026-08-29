import { streamText, type ModelMessage } from 'ai';
import { devDebug, devError, devInfo } from '../../core/dev-mode/dev-mode.js';
import { defaultLLMRegistry } from '../../registries/llms/service.js';
import { calculateCost, normalizeUsage } from '../billing/calculator.js';
import { defaultCostTracker } from '../billing/tracker.js';
import { defaultKeyManager } from '../keys/key-manager.js';
import { createLanguageModel } from '../providers/factory.js';
import { LLMExecutionError, LLMValidationError } from './errors.js';
import type { StreamLLMOptions, StreamLLMResponse } from './types.js';

function buildMessages(options: StreamLLMOptions): { system?: string; messages: ModelMessage[] } {
  let system = options.system;
  const messages: ModelMessage[] = [];

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
 * Executes a streaming LLM request, returning an async iterable text stream and
 * a deferred promise for final token/cost billing statistics upon stream completion.
 */
export async function streamLLM(options: StreamLLMOptions): Promise<StreamLLMResponse> {
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

  const { provider, model, tier, pricing } = defaultLLMRegistry.validateModelSupport(
    options.provider,
    options.model,
    options.tier
  );

  const { system, messages } = buildMessages(options);
  const activeKeyInfo = defaultKeyManager.getActiveKey(provider.id);

  devInfo(
    'LLM',
    `Initiating streaming call to ${provider.id}:${model.id} (Tier: ${tier})`,
    {
      provider: provider.id,
      model: model.id,
      tier,
      messageCount: messages.length,
      tools: options.tools ? Object.keys(options.tools) : undefined,
      maskedKey: activeKeyInfo.maskedKey,
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

  try {
    const languageModel = createLanguageModel(provider.id, model.id, {
      apiKey: activeKeyInfo.key,
      baseURL: options.baseURL,
      headers: options.headers,
    });

    devDebug(
      'LLM',
      `Using key index ${activeKeyInfo.index} (${activeKeyInfo.maskedKey}) for streaming ${provider.id}`
    );

    const result = streamText({
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
      onFinish: (event) => {
        defaultKeyManager.markKeySuccess(provider.id, activeKeyInfo.key);
        const usage = normalizeUsage(event.usage);
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
          `Stream finished for ${provider.id}:${model.id}. Tokens: ${usage.totalTokens} (Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Cached: ${usage.cachedPromptTokens}). Cost: $${cost.totalCost.toFixed(6)}`,
          {
            finishReason: event.finishReason,
            usage,
            cost,
            maskedKey: activeKeyInfo.maskedKey,
          },
          durationMs
        );
      },
      onError: ({ error }) => {
        devError(
          'LLM',
          `Streaming error for ${provider.id}:${model.id}: ${error instanceof Error ? error.message : String(error)}`,
          error,
          { provider: provider.id, model: model.id, key: activeKeyInfo.maskedKey }
        );
        defaultKeyManager.markKeyFailure(provider.id, activeKeyInfo.key, error);
      },
    });

    const getFinalStats = async () => {
      const [text, rawUsage, finishReason] = await Promise.all([
        result.text,
        result.usage,
        result.finishReason,
      ]);

      const usage = normalizeUsage(rawUsage);
      const cost = calculateCost(usage, pricing);

      return {
        text,
        usage,
        cost,
        finishReason: finishReason ?? 'stop',
      };
    };

    return {
      textStream: result.textStream,
      fullStream: result.fullStream,
      getFinalStats,
      toTextStreamResponse: (init) => result.toTextStreamResponse(init),
      provider: provider.id,
      model: model.id,
      tier,
      keyIndex: activeKeyInfo.index,
      maskedKey: activeKeyInfo.maskedKey,
    };
  } catch (error) {
    defaultKeyManager.markKeyFailure(provider.id, activeKeyInfo.key, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    devError(
      'LLM',
      `Failed to initiate stream for ${provider.id}:${model.id}: ${errorMessage}`,
      error,
      { provider: provider.id, model: model.id, key: activeKeyInfo.maskedKey }
    );
    throw new LLMExecutionError(provider.id, model.id, errorMessage, error);
  }
}


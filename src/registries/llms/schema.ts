import { z } from 'zod';

export const ApiTierSchema = z.enum(['standard', 'flex', 'priority', 'batch']);

export const InputModalitySchema = z.enum(['text', 'image', 'video', 'audio', 'pdf']);
export const OutputModalitySchema = z.enum(['text', 'audio', 'image']);
export const ThinkingEffortSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export const ThinkingTypeSchema = z.enum(['adaptive', 'manual_budget', 'levels', 'none']);

export const TierPricingSchema = z.object({
  /** Cost in USD per 1,000,000 un-cached input tokens */
  inputCostPerMillion: z.number().min(0),
  /** Cost in USD per 1,000,000 output (completion) tokens */
  outputCostPerMillion: z.number().min(0),
  /** Cost in USD per 1,000,000 cached input read tokens */
  cachedReadCostPerMillion: z.number().min(0).optional(),
  /** Cost in USD per 1,000,000 cached input write/creation tokens (e.g. 5m write) */
  cachedWriteCostPerMillion: z.number().min(0).optional(),
  /** Cost in USD per 1,000,000 cached input write for 1-hour cache TTL (if supported) */
  cachedWrite1hCostPerMillion: z.number().min(0).optional(),
});

export const ModelPricingMapSchema = z.object({
  standard: TierPricingSchema,
  flex: TierPricingSchema.optional(),
  priority: TierPricingSchema.optional(),
  batch: TierPricingSchema.optional(),
}).catchall(TierPricingSchema);

export const ModelCapabilitiesSchema = z.object({
  // Modalities
  inputModalities: z.array(InputModalitySchema).default(['text']),
  outputModalities: z.array(OutputModalitySchema).default(['text']),

  // Core capabilities
  supportsStreaming: z.boolean().default(true),
  supportsTools: z.boolean().default(true),
  supportsStructuredOutputs: z.boolean().default(true),
  supportsPromptCaching: z.boolean().default(false),
  supportsReasoning: z.boolean().default(false),

  // Reasoning / Thinking specs
  thinkingType: ThinkingTypeSchema.optional(),
  supportedThinkingEfforts: z.array(ThinkingEffortSchema).optional(),
  defaultThinkingEffort: ThinkingEffortSchema.optional(),

  // Tooling & Grounding capabilities
  supportsSearchGrounding: z.boolean().default(false),
  supportsMapsGrounding: z.boolean().default(false),
  supportsCodeExecution: z.boolean().default(false),
  supportsComputerUse: z.boolean().default(false),
  supportsFileSearch: z.boolean().default(false),
  supportsUrlContext: z.boolean().default(false),
  supportsLiveApi: z.boolean().default(false),
  supportsAudioGeneration: z.boolean().default(false),
  supportsImageGeneration: z.boolean().default(false),

  // Inference Tiers
  supportsBatch: z.boolean().default(false),
  supportsFlex: z.boolean().default(false),
  supportsPriority: z.boolean().default(false),

  // Token Limits
  maxContextTokens: z.number().positive(),
  maxOutputTokens: z.number().positive(),
  maxBatchOutputTokens: z.number().positive().optional(),

  // Sampling constraints
  supportsCustomSamplingParams: z.boolean().default(true),
  defaultTemperature: z.number().min(0).max(2).optional(),

  // Metadata
  knowledgeCutoff: z.string().optional(),
  releaseDate: z.string().optional(),
});

export const ModelDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  providerId: z.string().min(1),
  capabilities: ModelCapabilitiesSchema,
  pricing: ModelPricingMapSchema,
  defaultTier: ApiTierSchema.default('standard'),
  isDeprecated: z.boolean().optional(),
});

export const ProviderDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  envKeyNames: z.array(z.string()).default([]),
  models: z.record(z.string(), ModelDefinitionSchema),
});

export const ModelUpdateSchema = ModelDefinitionSchema.partial().omit({ id: true });
export const ProviderUpdateSchema = ProviderDefinitionSchema.partial().omit({ id: true });
export const LLMRegistryMapSchema = z.record(z.string(), ProviderDefinitionSchema);

export const LLMEngineConfigSchema = z.object({
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultTier: ApiTierSchema.optional(),
  rateLimitCooldownMs: z.number().positive().optional(),
  quotaExhaustionCooldownMs: z.number().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
});


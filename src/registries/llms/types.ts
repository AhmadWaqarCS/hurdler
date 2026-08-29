import type { z } from 'zod';
import type {
  ApiTierSchema,
  InputModalitySchema,
  OutputModalitySchema,
  ThinkingEffortSchema,
  ThinkingTypeSchema,
  TierPricingSchema,
  ModelPricingMapSchema,
  ModelCapabilitiesSchema,
  ModelDefinitionSchema,
  ProviderDefinitionSchema,
  ModelUpdateSchema,
  ProviderUpdateSchema,
  LLMRegistryMapSchema,
  LLMEngineConfigSchema,
} from './schema.js';

export type ApiTier = z.infer<typeof ApiTierSchema>;
export type InputModality = z.infer<typeof InputModalitySchema>;
export type OutputModality = z.infer<typeof OutputModalitySchema>;
export type ThinkingEffort = z.infer<typeof ThinkingEffortSchema>;
export type ThinkingType = z.infer<typeof ThinkingTypeSchema>;
export type TierPricing = z.infer<typeof TierPricingSchema>;
export type ModelPricingMap = z.infer<typeof ModelPricingMapSchema>;
export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>;
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;
export type ProviderDefinition = z.infer<typeof ProviderDefinitionSchema>;
export type ModelUpdate = z.infer<typeof ModelUpdateSchema>;
export type ProviderUpdate = z.infer<typeof ProviderUpdateSchema>;
export type LLMRegistryMap = z.infer<typeof LLMRegistryMapSchema>;
export type LLMEngineConfig = z.infer<typeof LLMEngineConfigSchema>;


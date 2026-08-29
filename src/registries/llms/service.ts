import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo } from '../../core/dev-mode/dev-mode.js';
import { ProviderDefinitionSchema, ModelDefinitionSchema } from './schema.js';
import { STATIC_PROVIDERS } from './static-registry.js';
import type {
  ProviderDefinition,
  ModelDefinition,
  ApiTier,
  TierPricing,
} from './types.js';
import { HurdlerError } from '../../core/errors/base-error.js';

export class ModelNotRegisteredError extends HurdlerError {
  constructor(providerId: string, modelId: string) {
    super(`Model '${modelId}' is not registered under provider '${providerId}'.`, {
      code: 'MODEL_NOT_REGISTERED',
      details: { providerId, modelId },
    });
  }
}

export class ProviderNotRegisteredError extends HurdlerError {
  constructor(providerId: string) {
    super(`Provider '${providerId}' is not registered in the LLM models registry.`, {
      code: 'PROVIDER_NOT_REGISTERED',
      details: { providerId },
    });
  }
}

export class UnsupportedTierError extends HurdlerError {
  constructor(providerId: string, modelId: string, tier: string, supportedTiers: string[]) {
    super(
      `API Tier '${tier}' is not supported for model '${modelId}' (Provider: '${providerId}'). Supported tiers: ${supportedTiers.join(', ')}.`,
      {
        code: 'UNSUPPORTED_TIER',
        details: { providerId, modelId, tier, supportedTiers },
      }
    );
  }
}

/**
 * Service for querying, registering, and validating LLM providers, models, capabilities, and pricing.
 */
export class LLMRegistryService {
  private readonly providerRegistry: BaseRegistry<string, ProviderDefinition>;

  constructor(initialProviders?: Record<string, ProviderDefinition>) {
    this.providerRegistry = new BaseRegistry<string, ProviderDefinition>({
      name: 'LLMProvidersRegistry',
      schema: ProviderDefinitionSchema,
      keyExtractor: (p) => p.id,
    });

    const providersToLoad = initialProviders ?? STATIC_PROVIDERS;
    for (const [id, provider] of Object.entries(providersToLoad)) {
      this.providerRegistry.register(id, provider);
    }
  }

  /**
   * Retrieves a provider definition by ID.
   */
  getProvider(providerId: string): ProviderDefinition {
    const normalized = providerId.toLowerCase().trim();
    const provider = this.providerRegistry.getOrNull(normalized);
    if (!provider) {
      throw new ProviderNotRegisteredError(providerId);
    }
    return provider;
  }

  /**
   * Checks if a provider is registered.
   */
  hasProvider(providerId: string): boolean {
    return this.providerRegistry.has(providerId.toLowerCase().trim());
  }

  /**
   * Retrieves a model definition for a given provider and model ID.
   */
  getModel(providerId: string, modelId: string): ModelDefinition {
    const provider = this.getProvider(providerId);
    const model = provider.models[modelId];
    if (!model) {
      throw new ModelNotRegisteredError(provider.id, modelId);
    }
    return model;
  }

  /**
   * Checks if a model exists under a provider.
   */
  hasModel(providerId: string, modelId: string): boolean {
    const provider = this.providerRegistry.getOrNull(providerId.toLowerCase().trim());
    if (!provider) {
      return false;
    }
    return Boolean(provider.models[modelId]);
  }

  /**
   * Retrieves tier pricing configuration for a model, ensuring the requested tier is supported.
   */
  getTierPricing(providerId: string, modelId: string, tier?: ApiTier): TierPricing {
    const model = this.getModel(providerId, modelId);
    const targetTier = tier ?? model.defaultTier;
    const pricing = model.pricing[targetTier];

    if (!pricing) {
      const supportedTiers = Object.keys(model.pricing);
      throw new UnsupportedTierError(providerId, modelId, targetTier, supportedTiers);
    }

    return pricing;
  }

  /**
   * Validates provider, model, and tier in one go.
   */
  validateModelSupport(
    providerId: string,
    modelId: string,
    tier?: ApiTier
  ): {
    provider: ProviderDefinition;
    model: ModelDefinition;
    tier: ApiTier;
    pricing: TierPricing;
  } {
    const provider = this.getProvider(providerId);
    const model = this.getModel(providerId, modelId);
    const effectiveTier = tier ?? model.defaultTier;
    const pricing = this.getTierPricing(providerId, modelId, effectiveTier);

    devDebug('REGISTRY', `Validated model '${modelId}' under provider '${providerId}' (Tier: ${effectiveTier})`, {
      providerId,
      modelId,
      tier: effectiveTier,
      pricing,
    });

    return {
      provider,
      model,
      tier: effectiveTier,
      pricing,
    };
  }

  /**
   * Lists all registered providers.
   */
  listProviders(): ProviderDefinition[] {
    return this.providerRegistry.getAll();
  }

  /**
   * Lists all models, optionally filtered by provider.
   */
  listModels(providerId?: string): ModelDefinition[] {
    if (providerId) {
      const provider = this.getProvider(providerId);
      return Object.values(provider.models);
    }
    const allModels: ModelDefinition[] = [];
    for (const provider of this.providerRegistry.getAll()) {
      allModels.push(...Object.values(provider.models));
    }
    return allModels;
  }

  /**
   * Registers or updates a provider.
   */
  registerProvider(provider: ProviderDefinition): void {
    const validated = ProviderDefinitionSchema.parse(provider);
    if (this.providerRegistry.has(validated.id)) {
      this.providerRegistry.unregister(validated.id);
    }
    this.providerRegistry.register(validated.id, validated);
    devInfo('REGISTRY', `Registered provider '${validated.id}' with ${Object.keys(validated.models).length} model(s)`);
  }

  /**
   * Registers a new model under an existing provider.
   */
  registerModel(providerId: string, model: ModelDefinition): void {
    const provider = this.getProvider(providerId);
    const validatedModel = ModelDefinitionSchema.parse(model);

    provider.models[validatedModel.id] = validatedModel;
    devInfo('REGISTRY', `Registered model '${validatedModel.id}' under provider '${providerId}'`);
  }
}

/** Default singleton instance of the LLM Registry Service */
export const defaultLLMRegistry = new LLMRegistryService();

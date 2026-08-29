import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import {
  ProviderDefinitionSchema,
  ModelDefinitionSchema,
  ProviderUpdateSchema,
  ModelUpdateSchema,
} from './schema.js';
import { STATIC_PROVIDERS } from './static-registry.js';
import {
  saveLLMRegistryToDisk,
  loadLLMRegistryFromDisk,
  syncLLMRegistryWithDisk,
} from './storage.js';
import type {
  ProviderDefinition,
  ModelDefinition,
  ApiTier,
  TierPricing,
  ModelCapabilities,
  ProviderUpdate,
  ModelUpdate,
} from './types.js';
import { HurdlerError } from '../../core/errors/base-error.js';

export class ModelNotRegisteredError extends HurdlerError {
  constructor(providerId: string, modelId: string, availableModels: string[] = []) {
    const hint =
      availableModels.length > 0
        ? ` Available models under '${providerId}': ${availableModels.join(', ')}.`
        : ` No models are registered under '${providerId}'. You can register one using registerModel().`;
    super(`Model '${modelId}' is not registered under provider '${providerId}'.${hint}`, {
      code: 'MODEL_NOT_REGISTERED',
      details: { providerId, modelId, availableModels },
    });
  }
}

export class ProviderNotRegisteredError extends HurdlerError {
  constructor(providerId: string, registeredProviders: string[] = []) {
    const hint =
      registeredProviders.length > 0
        ? ` Registered providers: ${registeredProviders.join(', ')}.`
        : ` No providers currently registered.`;
    super(`Provider '${providerId}' is not registered in the LLM registry.${hint} You can register it using registerProvider().`, {
      code: 'PROVIDER_NOT_REGISTERED',
      details: { providerId, registeredProviders },
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
 * Service class for querying, registering, updating, and validating LLM providers and models.
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
   *
   * @param providerId - Provider identifier (e.g. 'google', 'anthropic').
   * @throws ProviderNotRegisteredError if provider is not registered.
   */
  getProvider(providerId: string): ProviderDefinition {
    const normalized = providerId.toLowerCase().trim();
    const provider = this.providerRegistry.getOrNull(normalized);
    if (!provider) {
      const available = this.providerRegistry.getAll().map((p) => p.id);
      throw new ProviderNotRegisteredError(providerId, available);
    }
    return provider;
  }

  /**
   * Checks if a provider is registered.
   *
   * @param providerId - Provider identifier.
   */
  hasProvider(providerId: string): boolean {
    return this.providerRegistry.has(providerId.toLowerCase().trim());
  }

  /**
   * Retrieves a model definition for a given provider and model ID.
   *
   * @param providerId - Provider identifier.
   * @param modelId - Model identifier (e.g. 'gemini-3.7-flash', 'claude-sonnet-5').
   * @throws ProviderNotRegisteredError | ModelNotRegisteredError
   */
  getModel(providerId: string, modelId: string): ModelDefinition {
    const provider = this.getProvider(providerId);
    const model = provider.models[modelId];
    if (!model) {
      const available = Object.keys(provider.models);
      throw new ModelNotRegisteredError(provider.id, modelId, available);
    }
    return model;
  }

  /**
   * Checks if a model exists under a provider.
   *
   * @param providerId - Provider identifier.
   * @param modelId - Model identifier.
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
   *
   * @param providerId - Provider identifier.
   * @param modelId - Model identifier.
   * @param tier - Optional inference tier (e.g. 'standard', 'flex', 'batch', 'priority').
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
   * Validates provider, model, and tier in one step, returning the resolved records.
   *
   * @param providerId - Provider identifier.
   * @param modelId - Model identifier.
   * @param tier - Optional inference tier.
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
   * Checks if a model and optional tier is supported without throwing.
   */
  isModelSupported(providerId: string, modelId: string, tier?: ApiTier): boolean {
    try {
      this.validateModelSupport(providerId, modelId, tier);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves capabilities for a registered model.
   */
  getModelCapabilities(providerId: string, modelId: string): ModelCapabilities {
    return this.getModel(providerId, modelId).capabilities;
  }

  /**
   * Lists all registered providers.
   */
  listProviders(): ProviderDefinition[] {
    return this.providerRegistry.getAll();
  }

  /**
   * Lists models across all providers, or filtered by provider.
   *
   * @param providerId - Optional provider filter.
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
   * Registers a new provider or updates an existing provider.
   *
   * @param provider - Provider definition to register.
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
   * Updates an existing provider with partial fields.
   *
   * @param providerId - Provider identifier.
   * @param updates - Partial provider definition.
   */
  updateProvider(providerId: string, updates: ProviderUpdate): ProviderDefinition {
    const existing = this.getProvider(providerId);
    const validatedUpdates = ProviderUpdateSchema.parse(updates);

    const updated: ProviderDefinition = {
      ...existing,
      ...validatedUpdates,
      id: existing.id,
      models: validatedUpdates.models
        ? { ...existing.models, ...validatedUpdates.models }
        : existing.models,
      envKeyNames: validatedUpdates.envKeyNames
        ? Array.from(new Set([...existing.envKeyNames, ...validatedUpdates.envKeyNames]))
        : existing.envKeyNames,
    };

    this.registerProvider(updated);
    devInfo('REGISTRY', `Updated provider '${providerId}'`);
    return updated;
  }

  /**
   * Unregisters a provider and all its models from the registry.
   *
   * @param providerId - Provider identifier to remove.
   * @returns true if provider was found and removed.
   */
  unregisterProvider(providerId: string): boolean {
    const normalized = providerId.toLowerCase().trim();
    const removed = this.providerRegistry.unregister(normalized);
    if (removed) {
      devInfo('REGISTRY', `Unregistered provider '${normalized}'`);
    }
    return removed;
  }

  /**
   * Registers a new model under a provider.
   *
   * @param providerId - Provider identifier.
   * @param model - Model definition.
   */
  registerModel(providerId: string, model: ModelDefinition): void {
    const provider = this.getProvider(providerId);
    const validatedModel = ModelDefinitionSchema.parse(model);

    provider.models[validatedModel.id] = validatedModel;
    devInfo('REGISTRY', `Registered model '${validatedModel.id}' under provider '${providerId}'`);
  }

  /**
   * Updates an existing model under a provider with partial fields.
   *
   * @param providerId - Provider identifier.
   * @param modelId - Model identifier.
   * @param updates - Partial model updates.
   */
  updateModel(providerId: string, modelId: string, updates: ModelUpdate): ModelDefinition {
    const provider = this.getProvider(providerId);
    const existingModel = this.getModel(providerId, modelId);
    const validatedUpdates = ModelUpdateSchema.parse(updates);

    const updated: ModelDefinition = {
      ...existingModel,
      ...validatedUpdates,
      id: existingModel.id,
      providerId: provider.id,
      capabilities: validatedUpdates.capabilities
        ? { ...existingModel.capabilities, ...validatedUpdates.capabilities }
        : existingModel.capabilities,
      pricing: validatedUpdates.pricing
        ? { ...existingModel.pricing, ...validatedUpdates.pricing }
        : existingModel.pricing,
    };

    provider.models[modelId] = updated;
    devInfo('REGISTRY', `Updated model '${modelId}' under provider '${providerId}'`);
    return updated;
  }

  /**
   * Unregisters a model from a provider.
   *
   * @param providerId - Provider identifier.
   * @param modelId - Model identifier to remove.
   * @returns true if model was found and removed.
   */
  unregisterModel(providerId: string, modelId: string): boolean {
    const provider = this.getProvider(providerId);
    if (provider.models[modelId]) {
      delete provider.models[modelId];
      devInfo('REGISTRY', `Unregistered model '${modelId}' from provider '${providerId}'`);
      return true;
    }
    return false;
  }

  /**
   * Synchronizes this registry instance with `.hurdler/registries/llms.json` on disk.
   */
  async syncWithDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const diskMap = await syncLLMRegistryWithDisk(options);
    for (const [id, provider] of Object.entries(diskMap)) {
      this.registerProvider(provider);
    }
  }

  /**
   * Loads registry records from disk.
   */
  async loadFromDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const diskMap = await loadLLMRegistryFromDisk(options);
    if (diskMap) {
      for (const [id, provider] of Object.entries(diskMap)) {
        this.registerProvider(provider);
      }
    }
  }

  /**
   * Persists current in-memory registry to `.hurdler/registries/llms.json`.
   */
  async saveToDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const allProviders = this.providerRegistry.getAll();
    await saveLLMRegistryToDisk(allProviders, options);
  }

  /**
   * Resets registry back to baseline static providers.
   */
  reset(): void {
    this.providerRegistry.clear();
    for (const [id, provider] of Object.entries(STATIC_PROVIDERS)) {
      this.providerRegistry.register(id, provider);
    }
    devInfo('REGISTRY', 'Reset LLM registry to baseline static providers');
  }
}

/** Default singleton instance of the LLM Registry Service */
export const defaultLLMRegistry = new LLMRegistryService();

// ============================================================================
// STANDALONE FUNCTIONAL API (Function-First Paradigm)
// ============================================================================

/**
 * Retrieves a provider definition by ID from the default registry.
 *
 * @example
 * ```ts
 * const provider = getProvider('google');
 * console.log(provider.name);
 * ```
 */
export function getProvider(providerId: string): ProviderDefinition {
  return defaultLLMRegistry.getProvider(providerId);
}

/**
 * Checks whether a provider is registered in the default registry.
 */
export function hasProvider(providerId: string): boolean {
  return defaultLLMRegistry.hasProvider(providerId);
}

/**
 * Lists all registered providers from the default registry.
 */
export function listProviders(): ProviderDefinition[] {
  return defaultLLMRegistry.listProviders();
}

/**
 * Registers a new provider or replaces an existing provider in the default registry.
 * Optionally persists changes to `.hurdler/registries/llms.json`.
 *
 * @example
 * ```ts
 * registerProvider({
 *   id: 'openai',
 *   name: 'OpenAI',
 *   envKeyNames: ['OPENAI_API_KEY'],
 *   models: { ... }
 * });
 * ```
 */
export function registerProvider(
  provider: ProviderDefinition,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): void {
  defaultLLMRegistry.registerProvider(provider);
  if (options?.persist) {
    saveLLMRegistry(options).catch((err) => {
      devWarn('REGISTRY', `Failed to persist registry after registering provider '${provider.id}': ${err.message}`);
    });
  }
}

/**
 * Updates an existing provider in the default registry with partial fields.
 */
export function updateProvider(
  providerId: string,
  updates: ProviderUpdate,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): ProviderDefinition {
  const updated = defaultLLMRegistry.updateProvider(providerId, updates);
  if (options?.persist) {
    saveLLMRegistry(options).catch((err) => {
      devWarn('REGISTRY', `Failed to persist registry after updating provider '${providerId}': ${err.message}`);
    });
  }
  return updated;
}

/**
 * Unregisters a provider from the default registry.
 */
export function unregisterProvider(
  providerId: string,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): boolean {
  const removed = defaultLLMRegistry.unregisterProvider(providerId);
  if (removed && options?.persist) {
    saveLLMRegistry(options).catch((err) => {
      devWarn('REGISTRY', `Failed to persist registry after unregistering provider '${providerId}': ${err.message}`);
    });
  }
  return removed;
}

/**
 * Retrieves a model definition from the default registry.
 *
 * @example
 * ```ts
 * const model = getModel('google', 'gemini-3.7-flash');
 * console.log(model.capabilities.maxContextTokens);
 * ```
 */
export function getModel(providerId: string, modelId: string): ModelDefinition {
  return defaultLLMRegistry.getModel(providerId, modelId);
}

/**
 * Checks whether a model is registered under a provider.
 */
export function hasModel(providerId: string, modelId: string): boolean {
  return defaultLLMRegistry.hasModel(providerId, modelId);
}

/**
 * Lists all models, optionally filtered by provider.
 */
export function listModels(providerId?: string): ModelDefinition[] {
  return defaultLLMRegistry.listModels(providerId);
}

/**
 * Registers a new model under a provider in the default registry.
 * Optionally persists to `.hurdler/registries/llms.json`.
 */
export function registerModel(
  providerId: string,
  model: ModelDefinition,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): void {
  defaultLLMRegistry.registerModel(providerId, model);
  if (options?.persist) {
    saveLLMRegistry(options).catch((err) => {
      devWarn('REGISTRY', `Failed to persist registry after registering model '${model.id}': ${err.message}`);
    });
  }
}

/**
 * Updates an existing model with partial attributes.
 */
export function updateModel(
  providerId: string,
  modelId: string,
  updates: ModelUpdate,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): ModelDefinition {
  const updated = defaultLLMRegistry.updateModel(providerId, modelId, updates);
  if (options?.persist) {
    saveLLMRegistry(options).catch((err) => {
      devWarn('REGISTRY', `Failed to persist registry after updating model '${modelId}': ${err.message}`);
    });
  }
  return updated;
}

/**
 * Unregisters a model from a provider.
 */
export function unregisterModel(
  providerId: string,
  modelId: string,
  options?: { persist?: boolean; targetPath?: string; projectRoot?: string }
): boolean {
  const removed = defaultLLMRegistry.unregisterModel(providerId, modelId);
  if (removed && options?.persist) {
    saveLLMRegistry(options).catch((err) => {
      devWarn('REGISTRY', `Failed to persist registry after unregistering model '${modelId}': ${err.message}`);
    });
  }
  return removed;
}

/**
 * Retrieves tier pricing for a model.
 */
export function getTierPricing(providerId: string, modelId: string, tier?: ApiTier): TierPricing {
  return defaultLLMRegistry.getTierPricing(providerId, modelId, tier);
}

/**
 * Validates provider, model, and tier support in one call.
 */
export function validateModelSupport(
  providerId: string,
  modelId: string,
  tier?: ApiTier
): {
  provider: ProviderDefinition;
  model: ModelDefinition;
  tier: ApiTier;
  pricing: TierPricing;
} {
  return defaultLLMRegistry.validateModelSupport(providerId, modelId, tier);
}

/**
 * Checks if a model and tier combination is valid and supported.
 */
export function isModelSupported(providerId: string, modelId: string, tier?: ApiTier): boolean {
  return defaultLLMRegistry.isModelSupported(providerId, modelId, tier);
}

/**
 * Retrieves capabilities definition for a registered model.
 */
export function getModelCapabilities(providerId: string, modelId: string): ModelCapabilities {
  return defaultLLMRegistry.getModelCapabilities(providerId, modelId);
}

/**
 * Loads registry records from `.hurdler/registries/llms.json` into default registry.
 */
export async function loadLLMRegistry(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
  await defaultLLMRegistry.loadFromDisk(options);
}

/**
 * Saves default in-memory registry to `.hurdler/registries/llms.json`.
 */
export async function saveLLMRegistry(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
  await defaultLLMRegistry.saveToDisk(options);
}

/**
 * Synchronizes default in-memory registry with `.hurdler/registries/llms.json`.
 * If file does not exist, creates it with baseline providers.
 */
export async function syncLLMRegistry(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
  await defaultLLMRegistry.syncWithDisk(options);
}

/**
 * Resets default registry back to baseline static providers.
 */
export function resetLLMRegistry(): void {
  defaultLLMRegistry.reset();
}

import type { LanguageModel } from 'ai';

export interface ProviderFactoryOptions {
  apiKey: string;
  baseURL?: string;
  headers?: Record<string, string>;
  providerOptions?: Record<string, unknown>;
}

export type LanguageModelInstance = LanguageModel;

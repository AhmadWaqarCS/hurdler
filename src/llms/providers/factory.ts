import path from 'path';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import type { LanguageModel } from 'ai';
import { maskApiKey } from '../../common/helpers.js';
import { devDebug } from '../../core/dev-mode/dev-mode.js';
import { ProviderNotRegisteredError } from '../../registries/llms/service.js';
import type { ProviderFactoryOptions } from './types.js';

/**
 * Creates a configured Vercel AI SDK LanguageModel instance for a specific provider and model.
 */
export function createLanguageModel(
  providerId: string,
  modelId: string,
  options: ProviderFactoryOptions
): LanguageModel {
  const normalizedProvider = providerId.toLowerCase().trim();

  devDebug('PROVIDER', `Creating LanguageModel instance for provider '${normalizedProvider}', model '${modelId}'`, {
    provider: normalizedProvider,
    model: modelId,
    maskedApiKey: maskApiKey(options.apiKey),
    hasBaseURL: Boolean(options.baseURL),
    hasHeaders: Boolean(options.headers),
  });

  switch (normalizedProvider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        headers: options.headers,
      });
      return anthropic(modelId);
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        headers: options.headers,
      });
      return google(modelId);
    }

    case 'google-vertex': {
      const project =
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT_ID ||
        process.env.GOOGLE_VERTEX_PROJECT;
      const location =
        process.env.GOOGLE_CLOUD_LOCATION ||
        process.env.GCP_LOCATION ||
        process.env.GCP_REGION ||
        process.env.GOOGLE_VERTEX_LOCATION ||
        'us-central1';

      // Check if credentials file path is provided via env or key manager
      let credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credentialsFile && options.apiKey && (options.apiKey.endsWith('.json') || options.apiKey.includes('/'))) {
        credentialsFile = options.apiKey;
      }
      if (credentialsFile) {
        credentialsFile = path.resolve(process.cwd(), credentialsFile);
      }

      // Only pass apiKey for Vertex Express mode if it's an actual API key (typically starts with AIzaSy)
      const isExpressApiKey =
        options.apiKey &&
        options.apiKey.startsWith('AIza') &&
        options.apiKey !== 'google-adc-default';

      const vertex = createVertex({
        project,
        location,
        baseURL: options.baseURL,
        headers: options.headers,
        apiKey: isExpressApiKey ? options.apiKey : undefined,
        googleAuthOptions: credentialsFile ? { keyFilename: credentialsFile } : undefined,
      });
      return vertex(modelId);
    }

    default:
      throw new ProviderNotRegisteredError(providerId);
  }
}

import path from 'path';
import dotenv from 'dotenv';
import { EnvConfigSchema, type EnvConfig } from './types.js';
import { parseCommaSeparatedList } from '../../common/helpers.js';
import { devDebug } from '../dev-mode/dev-mode.js';

// Load .env automatically if present
dotenv.config();

// Ensure relative service account credential paths are resolved absolutely for Google auth
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

let parsedConfig: EnvConfig | null = null;

/**
 * Loads and validates environment variables.
 */
export function getEnvConfig(): EnvConfig {
  if (!parsedConfig) {
    const result = EnvConfigSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Environment validation failed: ${result.error.message}`);
    }
    parsedConfig = result.data;
    devDebug('CONFIG', 'Environment configuration loaded successfully', {
      nodeEnv: parsedConfig.NODE_ENV,
      devMode: parsedConfig.DEV_MODE ?? parsedConfig.HURDLER_DEV_MODE,
      logLevel: parsedConfig.LOG_LEVEL,
    });
  }
  return parsedConfig;
}

/**
 * Extracts all configured API keys or authentication identifiers for a specific provider.
 * Searches:
 * 1. Explicit envKeyNames defined by provider
 * 2. Comma-separated list formats (`${PROVIDER}_API_KEYS`)
 * 3. Indexed formats (`${PROVIDER}_API_KEY_1`, `${PROVIDER}_API_KEY_2`, etc.)
 * 4. Provider-specific credentials (e.g. ADC for Google Vertex)
 */
export function getProviderApiKeys(providerId: string, customEnvKeyNames?: string[]): string[] {
  const env = process.env;
  const keys: string[] = [];

  const addKey = (val?: string) => {
    if (val && typeof val === 'string') {
      const parsed = parseCommaSeparatedList(val);
      for (const k of parsed) {
        if (k && !keys.includes(k)) {
          keys.push(k);
        }
      }
    }
  };

  // Check explicit envKeyNames if supplied
  if (customEnvKeyNames && customEnvKeyNames.length > 0) {
    for (const keyName of customEnvKeyNames) {
      addKey(env[keyName]);
    }
  }

  // Common naming conventions based on providerId
  const normalizedId = providerId.toUpperCase().replace(/-/g, '_');
  addKey(env[`${normalizedId}_API_KEY`]);
  addKey(env[`${normalizedId}_API_KEYS`]);

  // Provider-specific default aliases
  if (providerId === 'google') {
    addKey(env.GOOGLE_GENERATIVE_AI_API_KEY);
    addKey(env.GEMINI_API_KEY);
    addKey(env.GEMINI_API_KEYS);
  } else if (providerId === 'anthropic') {
    addKey(env.CLAUDE_API_KEY);
    addKey(env.CLAUDE_API_KEYS);
  } else if (providerId === 'google-vertex') {
    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      addKey(env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    if (env.GOOGLE_CLOUD_PROJECT) {
      addKey(env.GOOGLE_CLOUD_PROJECT);
    }
    if (env.GCP_PROJECT_ID) {
      addKey(env.GCP_PROJECT_ID);
    }

    // Default system ADC identifier if no explicit key was pushed
    if (keys.length === 0) {
      keys.push('google-adc-default');
    }
  }

  // Check indexed variables (e.g. ANTHROPIC_API_KEY_1, ANTHROPIC_API_KEY_2, ...)
  let index = 1;
  while (index <= 50) {
    const indexedKey = env[`${normalizedId}_API_KEY_${index}`];
    if (indexedKey) {
      addKey(indexedKey);
      index++;
    } else {
      break;
    }
  }

  return keys;
}

/**
 * Reset loaded config cache (useful for testing or reloading)
 */
export function reloadEnvConfig(): EnvConfig {
  parsedConfig = null;
  dotenv.config();
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
      process.cwd(),
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
  }
  return getEnvConfig();
}

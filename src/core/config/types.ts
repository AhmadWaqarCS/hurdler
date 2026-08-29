import { z } from 'zod';

export const EnvConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEYS: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_API_KEYS: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().optional(),
  GCP_LOCATION: z.string().optional(),
  GCP_REGION: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  DEV_MODE: z.string().optional(),
  HURDLER_DEV_MODE: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  LOGS_DIR: z.string().optional(),
}).passthrough();

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

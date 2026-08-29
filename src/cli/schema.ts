/**
 * Hurdler CLI Subsystem - Schema Definitions & Validation
 */

import { z } from 'zod';

export const CliGlobalOptionsSchema = z.object({
  dev: z.boolean().optional().default(false),
  json: z.boolean().optional().default(false),
  help: z.boolean().optional().default(false),
  version: z.boolean().optional().default(false),
  quiet: z.boolean().optional().default(false),
  cwd: z.string().optional(),
  config: z.string().optional(),
});

export const CliPaginationOptionsSchema = z.object({
  limit: z.coerce.number().int().positive().optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const CliFilterOptionsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  provider: z.string().optional(),
  tier: z.string().optional(),
});

/**
 * Validates global CLI options using Zod.
 */
export function validateGlobalOptions(raw: Record<string, unknown>) {
  return CliGlobalOptionsSchema.parse(raw);
}

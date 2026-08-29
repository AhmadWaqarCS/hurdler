import { z } from 'zod';

export const PackageNameRegex =
  /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export const ModuleCategorySchema = z.union([
  z.enum([
    'validation',
    'orm_database',
    'framework_frontend',
    'framework_backend',
    'ui_components',
    'icons',
    'state_management',
    'auth',
    'testing',
    'api_client',
    'utilities',
    'styling',
    'ai_llm',
  ]),
  z.string().min(1, 'Custom category must not be empty'),
]);

export const RuntimeEnvironmentSchema = z.union([
  z.enum(['node', 'edge', 'browser', 'universal']),
  z.string().min(1, 'Custom runtime must not be empty'),
]);

export const PackageTypeSchema = z.enum(['esm', 'cjs', 'dual']);

export const VersionStrategySchema = z.enum(['exact', 'caret', 'tilde', 'latest_stable']);

export const PackageManagerSchema = z.enum(['npm', 'pnpm', 'yarn', 'bun']);

export const InstallCommandsSchema = z.object({
  npm: z.string().optional(),
  pnpm: z.string().optional(),
  yarn: z.string().optional(),
  bun: z.string().optional(),
});

export const ModuleDefinitionSchema = z.object({
  /** Canonical npm package name identifier */
  name: z
    .string()
    .min(1, 'Package name must not be empty')
    .regex(PackageNameRegex, 'Invalid npm package name identifier'),
  /** Human-readable display name */
  displayName: z.string().min(1, 'Display name must not be empty'),
  /** Functional category */
  category: ModuleCategorySchema.default('utilities'),
  /** Short description of the module */
  description: z.string().min(1, 'Description must not be empty'),
  /** Official documentation URL */
  docUrl: z.string().url('Must be a valid documentation URL'),
  /** Optional GitHub / source repository URL */
  repoUrl: z.string().url('Must be a valid repository URL').optional(),
  /** Optional npm package registry URL */
  npmUrl: z.string().url('Must be a valid npm URL').optional(),
  /** Recommended semver range specifier */
  recommendedVersion: z.string().min(1, 'Recommended version must not be empty'),
  /** Fixed verified stable exact version */
  pinnedVersion: z.string().min(1, 'Pinned version must not be empty'),
  /** Minimum Node.js version constraint */
  minNodeVersion: z.string().optional(),
  /** Whether the package is installed as a devDependency */
  isDevDependency: z.boolean().default(false),
  /** Predefined package manager install command templates */
  installCommands: InstallCommandsSchema.optional(),
  /** Supported runtime environments */
  runtime: z.array(RuntimeEnvironmentSchema).min(1).default(['node']),
  /** Module format standard */
  packageType: PackageTypeSchema.default('esm'),
  /** Searchable keywords and tags */
  tags: z.array(z.string()).default([]),
  /** Required peer dependencies */
  peerDependencies: z.array(z.string()).default([]),
  /** Vetted companion modules commonly used together */
  recommendedCompanions: z.array(z.string()).default([]),
  /** Actionable best practices for LLM code generation */
  bestPractices: z.array(z.string()).default([]),
  /** Anti-patterns and deprecated usages for LLM guards */
  antiPatterns: z.array(z.string()).default([]),
  /** Canonical modern code example demonstrating standard usage */
  exampleUsage: z.string().optional(),
  /** Extensible metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ModuleUpdateSchema = z.object({
  displayName: z.string().min(1).optional(),
  category: ModuleCategorySchema.optional(),
  description: z.string().min(1).optional(),
  docUrl: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  npmUrl: z.string().url().optional(),
  recommendedVersion: z.string().min(1).optional(),
  pinnedVersion: z.string().min(1).optional(),
  minNodeVersion: z.string().optional(),
  isDevDependency: z.boolean().optional(),
  installCommands: InstallCommandsSchema.optional(),
  runtime: z.array(RuntimeEnvironmentSchema).min(1).optional(),
  packageType: PackageTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  peerDependencies: z.array(z.string()).optional(),
  recommendedCompanions: z.array(z.string()).optional(),
  bestPractices: z.array(z.string()).optional(),
  antiPatterns: z.array(z.string()).optional(),
  exampleUsage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ModuleBundleSchema = z.object({
  id: z.string().min(1, 'Bundle ID must not be empty'),
  name: z.string().min(1, 'Bundle name must not be empty'),
  description: z.string().min(1, 'Bundle description must not be empty'),
  modules: z.array(z.string()).min(1, 'Bundle must contain at least one module'),
  devModules: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const BundleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  modules: z.array(z.string()).min(1).optional(),
  devModules: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ModuleFilterOptionsSchema = z.object({
  names: z.array(z.string()).optional(),
  categories: z.array(ModuleCategorySchema).optional(),
  tags: z.array(z.string()).optional(),
  runtime: RuntimeEnvironmentSchema.optional(),
  isDevDependency: z.boolean().optional(),
  search: z.string().optional(),
});

export const BundleFilterOptionsSchema = z.object({
  ids: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  includesModule: z.string().optional(),
  search: z.string().optional(),
});

export const PackageDependenciesOptionsSchema = z.object({
  strategy: VersionStrategySchema.default('caret'),
  includePeers: z.boolean().default(true),
  includeCompanions: z.boolean().default(false),
});

export const ModulePromptOptionsSchema = z.object({
  includeExamples: z.boolean().default(true),
  includeBestPractices: z.boolean().default(true),
  includeAntiPatterns: z.boolean().default(true),
  includeInstallCommand: z.boolean().default(true),
  packageManager: PackageManagerSchema.default('npm'),
  versionStrategy: VersionStrategySchema.default('exact'),
  detailLevel: z.enum(['compact', 'detailed', 'full']).default('detailed'),
});

export const ModuleRegistryMapSchema = z.record(z.string(), ModuleDefinitionSchema);
export const ModuleBundleRegistryMapSchema = z.record(z.string(), ModuleBundleSchema);

export const PersistedModuleRegistrySchema = z.object({
  modules: ModuleRegistryMapSchema.default({}),
  bundles: ModuleBundleRegistryMapSchema.default({}),
});

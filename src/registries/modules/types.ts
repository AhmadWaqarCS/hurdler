/**
 * Modules Registry Subsystem - Type Definitions
 *
 * Defines the core data structures, filter options, update payloads, and configuration
 * options for the Hurdler Node.js modules and preset stack bundles registry.
 */

/**
 * Functional category classification for Node.js modules.
 */
export type ModuleCategory =
  | 'validation'
  | 'orm_database'
  | 'framework_frontend'
  | 'framework_backend'
  | 'ui_components'
  | 'icons'
  | 'state_management'
  | 'auth'
  | 'testing'
  | 'api_client'
  | 'utilities'
  | 'styling'
  | 'ai_llm'
  | (string & {});

/**
 * Supported runtime environment target.
 */
export type RuntimeEnvironment =
  | 'node'
  | 'edge'
  | 'browser'
  | 'universal'
  | (string & {});

/**
 * Package distribution format.
 */
export type PackageType = 'esm' | 'cjs' | 'dual';

/**
 * Semver version strategy for dependencies resolution.
 */
export type VersionStrategy = 'exact' | 'caret' | 'tilde' | 'latest_stable';

/**
 * Target package manager for CLI install commands.
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Predefined package manager installation command templates.
 */
export interface InstallCommands {
  npm?: string;
  pnpm?: string;
  yarn?: string;
  bun?: string;
}

/**
 * Complete metadata and configuration specification for a registered module.
 */
export interface ModuleDefinition {
  /** Canonical npm package name identifier (e.g. 'zod', 'prisma', '@prisma/client', 'next') */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Functional category classification */
  category: ModuleCategory;
  /** Short description of the module and its role */
  description: string;
  /** Official documentation URL */
  docUrl: string;
  /** Optional GitHub / source repository URL */
  repoUrl?: string;
  /** Optional npm package registry URL */
  npmUrl?: string;
  /** Recommended semver range specifier (e.g. '^3.23.8') */
  recommendedVersion: string;
  /** Fixed verified stable exact version (e.g. '3.23.8') */
  pinnedVersion: string;
  /** Minimum Node.js version constraint (e.g. '>=18.18.0') */
  minNodeVersion?: string;
  /** Whether the package is typically installed as a devDependency */
  isDevDependency?: boolean;
  /** Predefined package manager install command templates */
  installCommands?: InstallCommands;
  /** Supported runtime environments */
  runtime: RuntimeEnvironment[];
  /** Module format standard */
  packageType: PackageType;
  /** Searchable keywords and tags */
  tags: string[];
  /** Required peer dependencies with optional version specifiers */
  peerDependencies?: string[];
  /** Vetted companion modules commonly used together */
  recommendedCompanions?: string[];
  /** Actionable best practices for LLM code generation */
  bestPractices?: string[];
  /** Anti-patterns and deprecated usages for LLM guards */
  antiPatterns?: string[];
  /** Canonical modern code example demonstrating standard usage */
  exampleUsage?: string;
  /** Extensible metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Partial update payload for modifying an existing module.
 */
export interface ModuleUpdate {
  displayName?: string;
  category?: ModuleCategory;
  description?: string;
  docUrl?: string;
  repoUrl?: string;
  npmUrl?: string;
  recommendedVersion?: string;
  pinnedVersion?: string;
  minNodeVersion?: string;
  isDevDependency?: boolean;
  installCommands?: InstallCommands;
  runtime?: RuntimeEnvironment[];
  packageType?: PackageType;
  tags?: string[];
  peerDependencies?: string[];
  recommendedCompanions?: string[];
  bestPractices?: string[];
  antiPatterns?: string[];
  exampleUsage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result structure for generated package.json dependencies.
 */
export interface PackageJsonDependenciesResult {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * Predefined stack preset bundle containing grouped modules for specific application architectures.
 */
export interface ModuleBundle {
  /** Unique bundle identifier (e.g. 'nextjs_fullstack', 'database_prisma') */
  id: string;
  /** Human-readable bundle name */
  name: string;
  /** Bundle description */
  description: string;
  /** Core module names included in this bundle */
  modules: string[];
  /** Optional devDependency module names */
  devModules?: string[];
  /** Searchable tags */
  tags?: string[];
  /** Extensible metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Partial update payload for modifying an existing module bundle.
 */
export interface BundleUpdate {
  name?: string;
  description?: string;
  modules?: string[];
  devModules?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Filtering options for querying modules.
 */
export interface ModuleFilterOptions {
  /** Whitelist of specific module names */
  names?: string[];
  /** Filter by category */
  categories?: ModuleCategory[];
  /** Filter by tags (must match at least one) */
  tags?: string[];
  /** Filter by supported runtime environment */
  runtime?: RuntimeEnvironment;
  /** Filter by devDependency status */
  isDevDependency?: boolean;
  /** Search query matching against name, displayName, description, or tags */
  search?: string;
}

/**
 * Filtering options for querying module preset bundles.
 */
export interface BundleFilterOptions {
  /** Whitelist of specific bundle IDs */
  ids?: string[];
  /** Filter by tags (must match at least one) */
  tags?: string[];
  /** Filter by module name included in the bundle */
  includesModule?: string;
  /** Search query matching against id, name, description, or tags */
  search?: string;
}

/**
 * Options for generating package.json dependencies.
 */
export interface PackageDependenciesOptions {
  /** Version strategy to apply ('exact' | 'caret' | 'tilde' | 'latest_stable', default: 'caret') */
  strategy?: VersionStrategy;
  /** Include peer dependencies automatically (default: true) */
  includePeers?: boolean;
  /** Include recommended companions (default: false) */
  includeCompanions?: boolean;
}

/**
 * Options for generating LLM prompt context markdown.
 */
export interface ModulePromptOptions {
  /** Include code examples in prompt output (default: true) */
  includeExamples?: boolean;
  /** Include best practice guidelines (default: true) */
  includeBestPractices?: boolean;
  /** Include anti-pattern warnings (default: true) */
  includeAntiPatterns?: boolean;
  /** Include install command in prompt (default: true) */
  includeInstallCommand?: boolean;
  /** Target package manager for install commands (default: 'npm') */
  packageManager?: PackageManager;
  /** Version strategy to show in prompt (default: 'exact') */
  versionStrategy?: VersionStrategy;
  /** Level of detail: 'compact' | 'detailed' | 'full' (default: 'detailed') */
  detailLevel?: 'compact' | 'detailed' | 'full';
}

/**
 * Key-value mapping of module name to ModuleDefinition.
 */
export type ModuleRegistryMap = Record<string, ModuleDefinition>;

/**
 * Key-value mapping of bundle id to ModuleBundle.
 */
export type ModuleBundleMap = Record<string, ModuleBundle>;

/**
 * Structure of the persisted JSON file (.hurdler/registries/modules.json).
 */
export interface PersistedModuleRegistry {
  modules: ModuleRegistryMap;
  bundles: ModuleBundleMap;
}

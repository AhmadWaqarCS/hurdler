/**
 * Modules Registry Subsystem - Type Definitions
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

export type RuntimeEnvironment =
  | 'node'
  | 'edge'
  | 'browser'
  | 'universal'
  | (string & {});

export type PackageType = 'esm' | 'cjs' | 'dual';

export type VersionStrategy = 'exact' | 'caret' | 'tilde' | 'latest_stable';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface InstallCommands {
  npm?: string;
  pnpm?: string;
  yarn?: string;
  bun?: string;
}

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

export interface PackageJsonDependenciesResult {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

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

export interface PackageDependenciesOptions {
  /** Version strategy to apply ('exact' | 'caret' | 'tilde' | 'latest_stable', default: 'caret') */
  strategy?: VersionStrategy;
  /** Include peer dependencies automatically (default: true) */
  includePeers?: boolean;
  /** Include recommended companions (default: false) */
  includeCompanions?: boolean;
}

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

export type ModuleRegistryMap = Record<string, ModuleDefinition>;
export type ModuleBundleMap = Record<string, ModuleBundle>;

export interface PersistedModuleRegistry {
  modules: ModuleRegistryMap;
  bundles: ModuleBundleMap;
}


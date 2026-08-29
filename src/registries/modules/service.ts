import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import {
  ModuleDefinitionSchema,
  ModuleUpdateSchema,
  ModuleBundleSchema,
  BundleUpdateSchema,
  ModuleFilterOptionsSchema,
  BundleFilterOptionsSchema,
  PackageDependenciesOptionsSchema,
  ModulePromptOptionsSchema,
} from './schema.js';
import {
  ModuleNotFoundError,
  BundleNotFoundError,
  InvalidModuleDefinitionError,
  InvalidBundleDefinitionError,
} from './errors.js';
import {
  STATIC_MODULES,
  STATIC_MODULE_BUNDLES,
} from './static-modules.js';
import {
  formatModulesForLLM,
  formatInstallCommands,
  formatPackageJsonDependencies as formatPackageJsonDeps,
  formatPackageJsonDependenciesSnippet as formatPackageJsonDepsSnippet,
} from './formatter.js';
import {
  saveModuleRegistryToDisk,
  loadModuleRegistryFromDisk,
  syncModuleRegistryWithDisk,
} from './storage.js';
import type {
  ModuleDefinition,
  ModuleUpdate,
  ModuleBundle,
  BundleUpdate,
  ModuleFilterOptions,
  BundleFilterOptions,
  PackageDependenciesOptions,
  ModulePromptOptions,
  PackageManager,
  VersionStrategy,
  PackageJsonDependenciesResult,
  ModuleCategory,
  RuntimeEnvironment,
  PersistedModuleRegistry,
} from './types.js';

/**
 * Service managing the modules registry, bundles, dependency resolution, and LLM context generation.
 */
export class ModuleRegistryService {
  private readonly moduleRegistry: BaseRegistry<string, ModuleDefinition>;
  private readonly bundleRegistry: BaseRegistry<string, ModuleBundle>;

  constructor(
    initialModules?: Record<string, ModuleDefinition>,
    initialBundles?: Record<string, ModuleBundle>
  ) {
    this.moduleRegistry = new BaseRegistry<string, ModuleDefinition>({
      name: 'ModulesRegistry',
      schema: ModuleDefinitionSchema,
      keyExtractor: (m) => m.name.toLowerCase().trim(),
    });

    this.bundleRegistry = new BaseRegistry<string, ModuleBundle>({
      name: 'ModuleBundlesRegistry',
      schema: ModuleBundleSchema,
      keyExtractor: (b) => b.id.toLowerCase().trim(),
    });

    // Populate static modules
    const modulesToLoad = initialModules ?? STATIC_MODULES;
    for (const [key, mod] of Object.entries(modulesToLoad)) {
      this.moduleRegistry.register(key.toLowerCase().trim(), mod);
    }

    // Populate static bundles
    const bundlesToLoad = initialBundles ?? STATIC_MODULE_BUNDLES;
    for (const [key, bundle] of Object.entries(bundlesToLoad)) {
      this.bundleRegistry.register(key.toLowerCase().trim(), bundle);
    }
  }

  /**
   * Retrieves a module definition by package name.
   *
   * @param name - Canonical npm package name.
   * @throws ModuleNotFoundError if module is not registered.
   */
  getModule(name: string): ModuleDefinition {
    const normalized = name.toLowerCase().trim();
    const mod = this.moduleRegistry.getOrNull(normalized);
    if (!mod) {
      const available = this.moduleRegistry.getAll().map((m) => m.name);
      throw new ModuleNotFoundError(name, available);
    }
    return mod;
  }

  /**
   * Retrieves a module definition or null if not found.
   *
   * @param name - Canonical npm package name.
   */
  getModuleOrNull(name: string): ModuleDefinition | null {
    const normalized = name.toLowerCase().trim();
    return this.moduleRegistry.getOrNull(normalized);
  }

  /**
   * Checks if a module is registered in the catalog.
   *
   * @param name - Canonical npm package name.
   */
  hasModule(name: string): boolean {
    return this.moduleRegistry.has(name.toLowerCase().trim());
  }

  /**
   * Lists all modules, optionally applying search/filter criteria.
   *
   * @param filter - Optional filter and search options.
   */
  listModules(filter?: ModuleFilterOptions): ModuleDefinition[] {
    if (!filter) {
      return this.moduleRegistry.getAll();
    }

    const validated = ModuleFilterOptionsSchema.parse(filter);

    return this.moduleRegistry.filter((mod) => {
      if (validated.names && validated.names.length > 0) {
        const lowerNames = validated.names.map((n) => n.toLowerCase().trim());
        if (!lowerNames.includes(mod.name.toLowerCase())) {
          return false;
        }
      }

      if (validated.categories && validated.categories.length > 0) {
        if (!validated.categories.includes(mod.category)) {
          return false;
        }
      }

      if (validated.tags && validated.tags.length > 0) {
        const hasTag = validated.tags.some((tag) =>
          mod.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
        );
        if (!hasTag) {
          return false;
        }
      }

      if (validated.runtime) {
        if (!mod.runtime.includes(validated.runtime)) {
          return false;
        }
      }

      if (typeof validated.isDevDependency === 'boolean') {
        if (Boolean(mod.isDevDependency) !== validated.isDevDependency) {
          return false;
        }
      }

      if (validated.search) {
        const query = validated.search.toLowerCase().trim();
        const matchesName = mod.name.toLowerCase().includes(query);
        const matchesDisplay = mod.displayName.toLowerCase().includes(query);
        const matchesDesc = mod.description.toLowerCase().includes(query);
        const matchesTag = mod.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesDisplay && !matchesDesc && !matchesTag) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Returns all modules under a specific category.
   *
   * @param category - Category to filter by.
   */
  findModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
    return this.listModules({ categories: [category] });
  }

  /**
   * Returns all modules matching a runtime environment.
   *
   * @param runtime - Target runtime ('node', 'edge', 'browser', 'universal').
   */
  findModulesByRuntime(runtime: RuntimeEnvironment): ModuleDefinition[] {
    return this.listModules({ runtime });
  }

  /**
   * Returns all modules with a specific tag.
   *
   * @param tag - Tag string.
   */
  findModulesByTag(tag: string): ModuleDefinition[] {
    return this.listModules({ tags: [tag] });
  }

  /**
   * Retrieves official documentation URL for a given module.
   *
   * @param name - Canonical npm package name.
   */
  getModuleDocs(name: string): string {
    const mod = this.getModule(name);
    return mod.docUrl;
  }

  /**
   * Computes the complete set of resolved modules including peer dependencies and recommended companions.
   *
   * @param names - List of root module names.
   * @param options - Resolution options.
   */
  resolveModuleDependencies(
    names: string[],
    options?: { includePeers?: boolean; includeCompanions?: boolean }
  ): ModuleDefinition[] {
    const includePeers = options?.includePeers ?? true;
    const includeCompanions = options?.includeCompanions ?? false;

    const resolvedMap = new Map<string, ModuleDefinition>();
    const queue: string[] = [...names];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentName = queue.shift()!.trim();
      const normalized = currentName.toLowerCase();

      if (visited.has(normalized)) continue;
      visited.add(normalized);

      // Clean version specifier if present in name (e.g. 'react@^18.2.0' -> 'react')
      const basePkgName = currentName.startsWith('@')
        ? `@${currentName.slice(1).split('@')[0]}`
        : currentName.split('@')[0];

      const mod = this.getModuleOrNull(basePkgName);
      if (mod) {
        resolvedMap.set(mod.name, mod);

        if (includePeers && mod.peerDependencies) {
          for (const peer of mod.peerDependencies) {
            if (!visited.has(peer.toLowerCase())) {
              queue.push(peer);
            }
          }
        }

        if (includeCompanions && mod.recommendedCompanions) {
          for (const comp of mod.recommendedCompanions) {
            if (!visited.has(comp.toLowerCase())) {
              queue.push(comp);
            }
          }
        }
      } else {
        devWarn('REGISTRY', `Referenced module '${currentName}' is not registered in the modules registry.`);
      }
    }

    return Array.from(resolvedMap.values());
  }

  /**
   * Generates formatted CLI installation commands.
   *
   * @param names - List of module names.
   * @param packageManager - Target package manager ('npm', 'pnpm', 'yarn', 'bun').
   * @param strategy - Semver strategy ('exact', 'caret', 'tilde', 'latest_stable').
   */
  getInstallCommands(
    names: string[],
    packageManager: PackageManager = 'npm',
    strategy: VersionStrategy = 'exact'
  ) {
    const modules = this.resolveModuleDependencies(names, { includePeers: true });
    return formatInstallCommands(modules, packageManager, strategy);
  }

  /**
   * Generates clean package.json dependencies and devDependencies objects.
   *
   * @param names - List of module names.
   * @param options - Dependency resolution options.
   */
  generatePackageJsonDependencies(
    names: string[],
    options?: PackageDependenciesOptions
  ): PackageJsonDependenciesResult {
    const validated = PackageDependenciesOptionsSchema.parse(options ?? {});
    const modules = this.resolveModuleDependencies(names, {
      includePeers: validated.includePeers,
      includeCompanions: validated.includeCompanions,
    });
    return formatPackageJsonDeps(modules, { strategy: validated.strategy });
  }

  /**
   * Formats a JSON snippet of package.json dependencies.
   *
   * @param namesOrModules - List of module names or ModuleDefinition objects.
   * @param options - Dependency resolution options.
   */
  formatPackageJsonDependenciesSnippet(
    namesOrModules: string[] | ModuleDefinition[],
    options?: PackageDependenciesOptions
  ): string {
    const validated = PackageDependenciesOptionsSchema.parse(options ?? {});
    let modules: ModuleDefinition[];

    if (namesOrModules.length > 0 && typeof namesOrModules[0] === 'string') {
      modules = this.resolveModuleDependencies(namesOrModules as string[], {
        includePeers: validated.includePeers,
        includeCompanions: validated.includeCompanions,
      });
    } else {
      modules = namesOrModules as ModuleDefinition[];
    }

    return formatPackageJsonDepsSnippet(modules, { strategy: validated.strategy });
  }

  /**
   * Retrieves a preset bundle by ID.
   *
   * @param bundleId - Bundle identifier.
   * @throws BundleNotFoundError if bundle is not registered.
   */
  getPresetBundle(bundleId: string): ModuleBundle {
    const normalized = bundleId.toLowerCase().trim();
    const bundle = this.bundleRegistry.getOrNull(normalized);
    if (!bundle) {
      const available = this.bundleRegistry.getAll().map((b) => b.id);
      throw new BundleNotFoundError(bundleId, available);
    }
    return bundle;
  }

  /**
   * Retrieves a preset bundle or null if not found.
   *
   * @param bundleId - Bundle identifier.
   */
  getPresetBundleOrNull(bundleId: string): ModuleBundle | null {
    const normalized = bundleId.toLowerCase().trim();
    return this.bundleRegistry.getOrNull(normalized);
  }

  /**
   * Checks if a preset bundle is registered.
   *
   * @param bundleId - Bundle identifier.
   */
  hasPresetBundle(bundleId: string): boolean {
    return this.bundleRegistry.has(bundleId.toLowerCase().trim());
  }

  /**
   * Lists all available preset bundles, optionally applying filter criteria.
   *
   * @param filter - Optional filter and search options.
   */
  listPresetBundles(filter?: BundleFilterOptions): ModuleBundle[] {
    if (!filter) {
      return this.bundleRegistry.getAll();
    }

    const validated = BundleFilterOptionsSchema.parse(filter);

    return this.bundleRegistry.filter((bundle) => {
      if (validated.ids && validated.ids.length > 0) {
        const lowerIds = validated.ids.map((id) => id.toLowerCase().trim());
        if (!lowerIds.includes(bundle.id.toLowerCase())) {
          return false;
        }
      }

      if (validated.tags && validated.tags.length > 0) {
        const hasTag = validated.tags.some((tag) =>
          (bundle.tags ?? []).map((t) => t.toLowerCase()).includes(tag.toLowerCase())
        );
        if (!hasTag) {
          return false;
        }
      }

      if (validated.includesModule) {
        const queryMod = validated.includesModule.toLowerCase().trim();
        const hasModule = bundle.modules.some((m) => m.toLowerCase() === queryMod);
        const hasDevModule = (bundle.devModules ?? []).some((m) => m.toLowerCase() === queryMod);
        if (!hasModule && !hasDevModule) {
          return false;
        }
      }

      if (validated.search) {
        const query = validated.search.toLowerCase().trim();
        const matchesId = bundle.id.toLowerCase().includes(query);
        const matchesName = bundle.name.toLowerCase().includes(query);
        const matchesDesc = bundle.description.toLowerCase().includes(query);
        const matchesTag = (bundle.tags ?? []).some((t) => t.toLowerCase().includes(query));
        if (!matchesId && !matchesName && !matchesDesc && !matchesTag) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Returns all preset bundles matching a tag.
   *
   * @param tag - Tag string.
   */
  findBundlesByTag(tag: string): ModuleBundle[] {
    return this.listPresetBundles({ tags: [tag] });
  }

  /**
   * Formats modules into high-signal prompt context for LLMs.
   *
   * @param namesOrFilter - List of module names or filter options.
   * @param options - Formatting configuration.
   */
  formatForLLM(
    namesOrFilter?: string[] | ModuleFilterOptions,
    options?: ModulePromptOptions
  ): string {
    const validatedOpts = ModulePromptOptionsSchema.parse(options ?? {});
    let targetModules: ModuleDefinition[];

    if (Array.isArray(namesOrFilter)) {
      targetModules = this.resolveModuleDependencies(namesOrFilter, { includePeers: true });
    } else if (namesOrFilter) {
      targetModules = this.listModules(namesOrFilter);
    } else {
      targetModules = this.listModules();
    }

    devDebug('REGISTRY', `Formatting ${targetModules.length} module(s) for LLM prompt context.`);
    return formatModulesForLLM(targetModules, validatedOpts);
  }

  /**
   * Registers or updates a module definition dynamically.
   *
   * @param module - Full module definition.
   * @throws InvalidModuleDefinitionError if validation fails.
   */
  registerModule(module: ModuleDefinition): void {
    try {
      const validated = ModuleDefinitionSchema.parse(module);
      const key = validated.name.toLowerCase().trim();

      if (this.moduleRegistry.has(key)) {
        this.moduleRegistry.unregister(key);
      }

      this.moduleRegistry.register(key, validated);
      devInfo('REGISTRY', `Registered module '${validated.name}' (v${validated.pinnedVersion})`);
    } catch (err) {
      throw new InvalidModuleDefinitionError(module.name || 'unknown', err);
    }
  }

  /**
   * Registers multiple modules in batch.
   *
   * @param modules - Array of module definitions.
   */
  registerManyModules(modules: ModuleDefinition[]): void {
    for (const mod of modules) {
      this.registerModule(mod);
    }
  }

  /**
   * Updates an existing module with partial attributes.
   *
   * @param name - Canonical package name of the module to update.
   * @param updates - Partial module update payload.
   * @returns Updated module definition.
   * @throws ModuleNotFoundError if module is not found.
   * @throws InvalidModuleDefinitionError if updated definition fails schema validation.
   */
  updateModule(name: string, updates: ModuleUpdate): ModuleDefinition {
    const existing = this.getModule(name);
    const validatedUpdates = ModuleUpdateSchema.parse(updates);

    const merged: ModuleDefinition = {
      ...existing,
      ...validatedUpdates,
      name: existing.name, // Package name is immutable key
    };

    try {
      const validated = ModuleDefinitionSchema.parse(merged);
      const key = validated.name.toLowerCase().trim();

      this.moduleRegistry.unregister(key);
      this.moduleRegistry.register(key, validated);

      devInfo('REGISTRY', `Updated module '${validated.name}'`);
      return validated;
    } catch (err) {
      throw new InvalidModuleDefinitionError(name, err);
    }
  }

  /**
   * Registers a new preset bundle or overwrites an existing one.
   *
   * @param bundle - Full bundle definition.
   * @throws InvalidBundleDefinitionError if validation fails.
   */
  registerBundle(bundle: ModuleBundle): void {
    try {
      const validated = ModuleBundleSchema.parse(bundle);
      const key = validated.id.toLowerCase().trim();

      if (this.bundleRegistry.has(key)) {
        this.bundleRegistry.unregister(key);
      }

      this.bundleRegistry.register(key, validated);
      devInfo('REGISTRY', `Registered module bundle '${validated.id}' with ${validated.modules.length} module(s)`);
    } catch (err) {
      throw new InvalidBundleDefinitionError(bundle.id || 'unknown', err);
    }
  }

  /**
   * Registers multiple preset bundles in batch.
   *
   * @param bundles - Array of bundle definitions.
   */
  registerManyBundles(bundles: ModuleBundle[]): void {
    for (const b of bundles) {
      this.registerBundle(b);
    }
  }

  /**
   * Updates an existing preset bundle with partial attributes.
   *
   * @param id - Bundle ID of the bundle to update.
   * @param updates - Partial bundle update payload.
   * @returns Updated bundle definition.
   * @throws BundleNotFoundError if bundle is not found.
   * @throws InvalidBundleDefinitionError if updated definition fails validation.
   */
  updateBundle(id: string, updates: BundleUpdate): ModuleBundle {
    const existing = this.getPresetBundle(id);
    const validatedUpdates = BundleUpdateSchema.parse(updates);

    const merged: ModuleBundle = {
      ...existing,
      ...validatedUpdates,
      id: existing.id, // Bundle ID is immutable key
    };

    try {
      const validated = ModuleBundleSchema.parse(merged);
      const key = validated.id.toLowerCase().trim();

      this.bundleRegistry.unregister(key);
      this.bundleRegistry.register(key, validated);

      devInfo('REGISTRY', `Updated module bundle '${validated.id}'`);
      return validated;
    } catch (err) {
      throw new InvalidBundleDefinitionError(id, err);
    }
  }

  /**
   * Unregisters a module definition.
   *
   * @param name - Canonical package name.
   * @returns True if module was removed, false otherwise.
   */
  unregisterModule(name: string): boolean {
    const key = name.toLowerCase().trim();
    const removed = this.moduleRegistry.unregister(key);
    if (removed) {
      devInfo('REGISTRY', `Unregistered module '${name}'`);
    }
    return removed;
  }

  /**
   * Deletes a module from the registry (alias for unregisterModule).
   *
   * @param name - Canonical package name.
   */
  deleteModule(name: string): boolean {
    return this.unregisterModule(name);
  }

  /**
   * Unregisters a preset module bundle.
   *
   * @param id - Bundle ID.
   * @returns True if bundle was removed, false otherwise.
   */
  unregisterBundle(id: string): boolean {
    const key = id.toLowerCase().trim();
    const removed = this.bundleRegistry.unregister(key);
    if (removed) {
      devInfo('REGISTRY', `Unregistered module bundle '${id}'`);
    }
    return removed;
  }

  /**
   * Deletes a preset module bundle (alias for unregisterBundle).
   *
   * @param id - Bundle ID.
   */
  deleteBundle(id: string): boolean {
    return this.unregisterBundle(id);
  }

  /**
   * Clears custom module registrations and resets to static baseline.
   */
  clearCustom(): void {
    this.reset();
  }

  /**
   * Resets modules and bundles registries to initial static baseline.
   */
  reset(): void {
    this.moduleRegistry.clear();
    for (const [key, mod] of Object.entries(STATIC_MODULES)) {
      this.moduleRegistry.register(key.toLowerCase().trim(), mod);
    }

    this.bundleRegistry.clear();
    for (const [key, bundle] of Object.entries(STATIC_MODULE_BUNDLES)) {
      this.bundleRegistry.register(key.toLowerCase().trim(), bundle);
    }

    devInfo('REGISTRY', 'Reset modules and bundles registries to baseline static defaults');
  }

  /**
   * Loads modules and bundles from `.hurdler/registries/modules.json` into memory.
   *
   * @param options - Optional path overrides.
   */
  async loadFromDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const persisted = await loadModuleRegistryFromDisk(options);
    if (persisted) {
      for (const mod of Object.values(persisted.modules)) {
        this.registerModule(mod);
      }
      for (const bundle of Object.values(persisted.bundles)) {
        this.registerBundle(bundle);
      }
    }
  }

  /**
   * Saves current in-memory modules and bundles to `.hurdler/registries/modules.json`.
   *
   * @param options - Optional path overrides.
   */
  async saveToDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<void> {
    const modules = this.moduleRegistry.getAll();
    const bundles = this.bundleRegistry.getAll();
    await saveModuleRegistryToDisk(modules, bundles, options);
  }

  /**
   * Synchronizes in-memory registry with `.hurdler/registries/modules.json`.
   *
   * @param options - Optional path overrides.
   * @returns Merged persisted module registry.
   */
  async syncWithDisk(options?: { targetPath?: string; projectRoot?: string }): Promise<PersistedModuleRegistry> {
    const merged = await syncModuleRegistryWithDisk(options);
    for (const mod of Object.values(merged.modules)) {
      this.registerModule(mod);
    }
    for (const bundle of Object.values(merged.bundles)) {
      this.registerBundle(bundle);
    }
    return merged;
  }
}

/** Default singleton instance of the Module Registry Service */
export const defaultModuleRegistry = new ModuleRegistryService();

// -------------------------------------------------------------
// Pure Functional APIs (Functional programming facade)
// -------------------------------------------------------------

/**
 * Retrieves a module definition by package name.
 *
 * @param name - Canonical npm package name.
 * @throws ModuleNotFoundError if module is not registered.
 *
 * @example
 * ```typescript
 * const zod = getModule('zod');
 * console.log(zod.pinnedVersion); // '3.23.8'
 * ```
 */
export function getModule(name: string): ModuleDefinition {
  return defaultModuleRegistry.getModule(name);
}

/**
 * Retrieves a module definition or null if not found.
 *
 * @param name - Canonical npm package name.
 *
 * @example
 * ```typescript
 * const mod = getModuleOrNull('custom-package');
 * ```
 */
export function getModuleOrNull(name: string): ModuleDefinition | null {
  return defaultModuleRegistry.getModuleOrNull(name);
}

/**
 * Checks if a module is registered in the catalog.
 *
 * @param name - Canonical npm package name.
 *
 * @example
 * ```typescript
 * if (hasModule('prisma')) { ... }
 * ```
 */
export function hasModule(name: string): boolean {
  return defaultModuleRegistry.hasModule(name);
}

/**
 * Lists all modules, optionally applying search/filter criteria.
 *
 * @param filter - Optional filter and search options.
 *
 * @example
 * ```typescript
 * const ormModules = listModules({ categories: ['orm_database'] });
 * ```
 */
export function listModules(filter?: ModuleFilterOptions): ModuleDefinition[] {
  return defaultModuleRegistry.listModules(filter);
}

/**
 * Returns all modules under a specific category.
 *
 * @param category - Category to filter by.
 *
 * @example
 * ```typescript
 * const validationLibs = findModulesByCategory('validation');
 * ```
 */
export function findModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
  return defaultModuleRegistry.findModulesByCategory(category);
}

/**
 * Returns all modules matching a runtime environment.
 *
 * @param runtime - Target runtime ('node', 'edge', 'browser', 'universal').
 *
 * @example
 * ```typescript
 * const edgeCompatible = findModulesByRuntime('edge');
 * ```
 */
export function findModulesByRuntime(runtime: RuntimeEnvironment): ModuleDefinition[] {
  return defaultModuleRegistry.findModulesByRuntime(runtime);
}

/**
 * Returns all modules matching a specific tag.
 *
 * @param tag - Tag string.
 *
 * @example
 * ```typescript
 * const uiModules = findModulesByTag('ui');
 * ```
 */
export function findModulesByTag(tag: string): ModuleDefinition[] {
  return defaultModuleRegistry.findModulesByTag(tag);
}

/**
 * Retrieves the official documentation URL for a given module.
 *
 * @param name - Canonical npm package name.
 *
 * @example
 * ```typescript
 * const url = getModuleDocs('zod'); // 'https://zod.dev'
 * ```
 */
export function getModuleDocs(name: string): string {
  return defaultModuleRegistry.getModuleDocs(name);
}

/**
 * Computes the complete set of resolved modules including peer dependencies and recommended companions.
 *
 * @param names - List of module names.
 * @param options - Resolution options.
 *
 * @example
 * ```typescript
 * const resolved = resolveModuleDependencies(['prisma', 'next']);
 * ```
 */
export function resolveModuleDependencies(
  names: string[],
  options?: { includePeers?: boolean; includeCompanions?: boolean }
): ModuleDefinition[] {
  return defaultModuleRegistry.resolveModuleDependencies(names, options);
}

/**
 * Generates formatted CLI installation commands.
 *
 * @param names - List of module names.
 * @param packageManager - Target package manager ('npm', 'pnpm', 'yarn', 'bun').
 * @param strategy - Semver strategy ('exact', 'caret', 'tilde', 'latest_stable').
 *
 * @example
 * ```typescript
 * const cmds = getInstallCommands(['zod', 'prisma'], 'pnpm', 'exact');
 * ```
 */
export function getInstallCommands(
  names: string[],
  packageManager?: PackageManager,
  strategy?: VersionStrategy
) {
  return defaultModuleRegistry.getInstallCommands(names, packageManager, strategy);
}

/**
 * Generates clean package.json dependencies and devDependencies objects.
 *
 * @param names - List of module names.
 * @param options - Dependency resolution options.
 *
 * @example
 * ```typescript
 * const deps = generatePackageJsonDependencies(['zod', 'prisma']);
 * ```
 */
export function generatePackageJsonDependencies(
  names: string[],
  options?: PackageDependenciesOptions
): PackageJsonDependenciesResult {
  return defaultModuleRegistry.generatePackageJsonDependencies(names, options);
}

/**
 * Retrieves a preset stack bundle by ID.
 *
 * @param bundleId - Bundle identifier (e.g. 'nextjs_fullstack', 'database_prisma').
 * @throws BundleNotFoundError if bundle is not found.
 *
 * @example
 * ```typescript
 * const nextBundle = getPresetBundle('nextjs_fullstack');
 * ```
 */
export function getPresetBundle(bundleId: string): ModuleBundle {
  return defaultModuleRegistry.getPresetBundle(bundleId);
}

/**
 * Retrieves a preset bundle or null if not found.
 *
 * @param bundleId - Bundle identifier.
 */
export function getPresetBundleOrNull(bundleId: string): ModuleBundle | null {
  return defaultModuleRegistry.getPresetBundleOrNull(bundleId);
}

/**
 * Checks if a preset bundle is registered.
 *
 * @param bundleId - Bundle identifier.
 */
export function hasPresetBundle(bundleId: string): boolean {
  return defaultModuleRegistry.hasPresetBundle(bundleId);
}

/**
 * Lists all available preset bundles, optionally applying filter criteria.
 *
 * @param filter - Optional filter and search options.
 *
 * @example
 * ```typescript
 * const allBundles = listPresetBundles();
 * ```
 */
export function listPresetBundles(filter?: BundleFilterOptions): ModuleBundle[] {
  return defaultModuleRegistry.listPresetBundles(filter);
}

/**
 * Returns all preset bundles matching a tag.
 *
 * @param tag - Tag string.
 *
 * @example
 * ```typescript
 * const backendBundles = findBundlesByTag('backend');
 * ```
 */
export function findBundlesByTag(tag: string): ModuleBundle[] {
  return defaultModuleRegistry.findBundlesByTag(tag);
}

/**
 * Formats modules into high-signal prompt context markdown for LLMs.
 *
 * @param namesOrFilter - List of module names or filter options.
 * @param options - Formatting configuration.
 *
 * @example
 * ```typescript
 * const promptText = formatModulesPromptContext(['zod', 'prisma'], { detailLevel: 'full' });
 * ```
 */
export function formatModulesPromptContext(
  namesOrFilter?: string[] | ModuleFilterOptions,
  options?: ModulePromptOptions
): string {
  return defaultModuleRegistry.formatForLLM(namesOrFilter, options);
}

/**
 * Registers or overwrites a module definition dynamically.
 *
 * @param module - Full module definition.
 *
 * @example
 * ```typescript
 * registerModule({
 *   name: 'my-lib',
 *   displayName: 'My Library',
 *   category: 'utilities',
 *   description: 'Custom helper lib',
 *   docUrl: 'https://mylib.dev',
 *   recommendedVersion: '^1.0.0',
 *   pinnedVersion: '1.0.0',
 *   runtime: ['node'],
 *   packageType: 'esm',
 *   tags: ['custom'],
 * });
 * ```
 */
export function registerModule(module: ModuleDefinition): void {
  defaultModuleRegistry.registerModule(module);
}

/**
 * Registers multiple modules in batch.
 *
 * @param modules - Array of module definitions.
 */
export function registerManyModules(modules: ModuleDefinition[]): void {
  defaultModuleRegistry.registerManyModules(modules);
}

/**
 * Updates an existing module with partial attributes.
 *
 * @param name - Canonical package name.
 * @param updates - Partial module update payload.
 *
 * @example
 * ```typescript
 * updateModule('zod', { pinnedVersion: '3.24.1', recommendedVersion: '^3.24.1' });
 * ```
 */
export function updateModule(name: string, updates: ModuleUpdate): ModuleDefinition {
  return defaultModuleRegistry.updateModule(name, updates);
}

/**
 * Unregisters a module definition.
 *
 * @param name - Canonical package name.
 */
export function unregisterModule(name: string): boolean {
  return defaultModuleRegistry.unregisterModule(name);
}

/**
 * Deletes a module definition from the registry (alias for unregisterModule).
 *
 * @param name - Canonical package name.
 */
export function deleteModule(name: string): boolean {
  return defaultModuleRegistry.deleteModule(name);
}

/**
 * Registers a new preset stack bundle.
 *
 * @param bundle - Full bundle definition.
 *
 * @example
 * ```typescript
 * registerBundle({
 *   id: 'custom_stack',
 *   name: 'Custom Stack',
 *   description: 'My custom bundle',
 *   modules: ['zod', 'next'],
 * });
 * ```
 */
export function registerBundle(bundle: ModuleBundle): void {
  defaultModuleRegistry.registerBundle(bundle);
}

/**
 * Registers multiple preset bundles in batch.
 *
 * @param bundles - Array of bundle definitions.
 */
export function registerManyBundles(bundles: ModuleBundle[]): void {
  defaultModuleRegistry.registerManyBundles(bundles);
}

/**
 * Updates an existing preset bundle with partial attributes.
 *
 * @param id - Bundle ID.
 * @param updates - Partial bundle update payload.
 *
 * @example
 * ```typescript
 * updateBundle('database_prisma', { description: 'Updated Prisma stack' });
 * ```
 */
export function updateBundle(id: string, updates: BundleUpdate): ModuleBundle {
  return defaultModuleRegistry.updateBundle(id, updates);
}

/**
 * Unregisters a preset module bundle.
 *
 * @param id - Bundle ID.
 */
export function unregisterBundle(id: string): boolean {
  return defaultModuleRegistry.unregisterBundle(id);
}

/**
 * Deletes a preset module bundle (alias for unregisterBundle).
 *
 * @param id - Bundle ID.
 */
export function deleteBundle(id: string): boolean {
  return defaultModuleRegistry.deleteBundle(id);
}

/**
 * Clears custom module registrations and resets to baseline static defaults.
 */
export function clearCustomModules(): void {
  defaultModuleRegistry.clearCustom();
}

/**
 * Resets modules and bundles registries to baseline static defaults.
 */
export function resetModulesToBaseline(): void {
  defaultModuleRegistry.reset();
}

/**
 * Loads modules and bundles from `.hurdler/registries/modules.json` into memory.
 *
 * @param options - Optional path overrides.
 */
export async function loadModulesFromDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  await defaultModuleRegistry.loadFromDisk(options);
}

/**
 * Saves current in-memory modules and bundles to `.hurdler/registries/modules.json`.
 *
 * @param options - Optional path overrides.
 */
export async function saveModulesToDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<void> {
  await defaultModuleRegistry.saveToDisk(options);
}

/**
 * Synchronizes in-memory registry with `.hurdler/registries/modules.json`.
 *
 * @param options - Optional path overrides.
 */
export async function syncModulesWithDisk(options?: {
  targetPath?: string;
  projectRoot?: string;
}): Promise<PersistedModuleRegistry> {
  return defaultModuleRegistry.syncWithDisk(options);
}

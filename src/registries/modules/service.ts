import { BaseRegistry } from '../base/registry.js';
import { devDebug, devInfo, devWarn } from '../../core/dev-mode/dev-mode.js';
import {
  ModuleDefinitionSchema,
  ModuleBundleSchema,
  ModuleFilterOptionsSchema,
  PackageDependenciesOptionsSchema,
  ModulePromptOptionsSchema,
} from './schema.js';
import {
  ModuleNotFoundError,
  BundleNotFoundError,
  InvalidModuleDefinitionError,
} from './errors.js';
import {
  STATIC_MODULES,
  STATIC_MODULE_BUNDLES,
} from './static-modules.js';
import {
  formatModulesForLLM,
  formatInstallCommands,
  formatPackageJsonDependencies as formatPackageJsonDeps,
} from './formatter.js';
import type {
  ModuleDefinition,
  ModuleBundle,
  ModuleFilterOptions,
  PackageDependenciesOptions,
  ModulePromptOptions,
  PackageManager,
  VersionStrategy,
  PackageJsonDependenciesResult,
  ModuleCategory,
  RuntimeEnvironment,
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
   * Retrieves a module definition by name.
   */
  getModule(name: string): ModuleDefinition {
    const normalized = name.toLowerCase().trim();
    const mod = this.moduleRegistry.getOrNull(normalized);
    if (!mod) {
      throw new ModuleNotFoundError(name);
    }
    return mod;
  }

  /**
   * Retrieves a module definition or null if not found.
   */
  getModuleOrNull(name: string): ModuleDefinition | null {
    const normalized = name.toLowerCase().trim();
    return this.moduleRegistry.getOrNull(normalized);
  }

  /**
   * Checks if a module is registered.
   */
  hasModule(name: string): boolean {
    return this.moduleRegistry.has(name.toLowerCase().trim());
  }

  /**
   * Lists all modules, optionally applying search/filter criteria.
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
   */
  findModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
    return this.listModules({ categories: [category] });
  }

  /**
   * Returns all modules matching a runtime environment.
   */
  findModulesByRuntime(runtime: RuntimeEnvironment): ModuleDefinition[] {
    return this.listModules({ runtime });
  }

  /**
   * Returns all modules with a specific tag.
   */
  findModulesByTag(tag: string): ModuleDefinition[] {
    return this.listModules({ tags: [tag] });
  }

  /**
   * Retrieves official documentation URL for a given module.
   */
  getModuleDocs(name: string): string {
    const mod = this.getModule(name);
    return mod.docUrl;
  }

  /**
   * Computes the complete set of resolved modules including peer dependencies and recommended companions.
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
   * Retrieves a preset bundle by ID.
   */
  getPresetBundle(bundleId: string): ModuleBundle {
    const normalized = bundleId.toLowerCase().trim();
    const bundle = this.bundleRegistry.getOrNull(normalized);
    if (!bundle) {
      throw new BundleNotFoundError(bundleId);
    }
    return bundle;
  }

  /**
   * Lists all available preset bundles.
   */
  listPresetBundles(): ModuleBundle[] {
    return this.bundleRegistry.getAll();
  }

  /**
   * Formats modules into high-signal prompt context for LLMs.
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
   */
  registerManyModules(modules: ModuleDefinition[]): void {
    for (const mod of modules) {
      this.registerModule(mod);
    }
  }

  /**
   * Registers a new preset bundle.
   */
  registerBundle(bundle: ModuleBundle): void {
    const validated = ModuleBundleSchema.parse(bundle);
    const key = validated.id.toLowerCase().trim();

    if (this.bundleRegistry.has(key)) {
      this.bundleRegistry.unregister(key);
    }

    this.bundleRegistry.register(key, validated);
    devInfo('REGISTRY', `Registered module bundle '${validated.id}' with ${validated.modules.length} module(s)`);
  }
}

/** Default singleton instance of the Module Registry Service */
export const defaultModuleRegistry = new ModuleRegistryService();

// -------------------------------------------------------------
// Pure Functional APIs (Functional programming facade)
// -------------------------------------------------------------

export function getModule(name: string): ModuleDefinition {
  return defaultModuleRegistry.getModule(name);
}

export function hasModule(name: string): boolean {
  return defaultModuleRegistry.hasModule(name);
}

export function listModules(filter?: ModuleFilterOptions): ModuleDefinition[] {
  return defaultModuleRegistry.listModules(filter);
}

export function findModulesByCategory(category: ModuleCategory): ModuleDefinition[] {
  return defaultModuleRegistry.findModulesByCategory(category);
}

export function findModulesByRuntime(runtime: RuntimeEnvironment): ModuleDefinition[] {
  return defaultModuleRegistry.findModulesByRuntime(runtime);
}

export function findModulesByTag(tag: string): ModuleDefinition[] {
  return defaultModuleRegistry.findModulesByTag(tag);
}

export function getModuleDocs(name: string): string {
  return defaultModuleRegistry.getModuleDocs(name);
}

export function resolveModuleDependencies(
  names: string[],
  options?: { includePeers?: boolean; includeCompanions?: boolean }
): ModuleDefinition[] {
  return defaultModuleRegistry.resolveModuleDependencies(names, options);
}

export function getInstallCommands(
  names: string[],
  packageManager?: PackageManager,
  strategy?: VersionStrategy
) {
  return defaultModuleRegistry.getInstallCommands(names, packageManager, strategy);
}

export function generatePackageJsonDependencies(
  names: string[],
  options?: PackageDependenciesOptions
): PackageJsonDependenciesResult {
  return defaultModuleRegistry.generatePackageJsonDependencies(names, options);
}

export function getPresetBundle(bundleId: string): ModuleBundle {
  return defaultModuleRegistry.getPresetBundle(bundleId);
}

export function listPresetBundles(): ModuleBundle[] {
  return defaultModuleRegistry.listPresetBundles();
}

export function formatModulesPromptContext(
  namesOrFilter?: string[] | ModuleFilterOptions,
  options?: ModulePromptOptions
): string {
  return defaultModuleRegistry.formatForLLM(namesOrFilter, options);
}

export function registerModule(module: ModuleDefinition): void {
  defaultModuleRegistry.registerModule(module);
}

export function registerManyModules(modules: ModuleDefinition[]): void {
  defaultModuleRegistry.registerManyModules(modules);
}

export function registerBundle(bundle: ModuleBundle): void {
  defaultModuleRegistry.registerBundle(bundle);
}

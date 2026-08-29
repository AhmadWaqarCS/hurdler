import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CodebaseMap,
  FileMapEntry,
  SymbolMapEntry,
  CodebaseScanOptions,
  FileUpdateOptions,
  MapQueryOptions,
  RefactoringContextOptions,
  RefactoringContextResult,
  SymbolLookupResult,
  MapStats,
  FileCategory,
  SymbolCategory,
  MapperConfig,
} from './types.js';
import {
  CodebaseScanOptionsSchema,
  FileUpdateOptionsSchema,
  MapQueryOptionsSchema,
  MapperConfigSchema,
} from './schema.js';
import { analyzeSourceCode, analyzeSourceFile } from './analyzer.js';
import { saveCodebaseMap, loadCodebaseMap, isMapFilePresent } from './storage.js';
import {
  buildRefactoringContext,
  buildDebugContext,
  buildFeatureContext,
  buildSystemMapSummary,
} from './context-builder.js';
import { sanitizeRelativePath, computeContentHash } from './helpers.js';
import { devInfo, devDebug, devWarn } from '../core/dev-mode/index.js';

/**
 * Computes category breakdown statistics for a set of files and symbols.
 */
function computeMapStats(files: Record<string, FileMapEntry>): MapStats {
  const filesByCategory: Record<FileCategory, number> = {
    'api-route': 0,
    'server-action': 0,
    component: 0,
    service: 0,
    'business-logic': 0,
    schema: 0,
    'type-definition': 0,
    'common-util': 0,
    'module-wrapper': 0,
    config: 0,
    test: 0,
    unknown: 0,
  };

  const symbolsByCategory: Record<SymbolCategory, number> = {
    'business-logic-function': 0,
    'common-function': 0,
    'module-function': 0,
    'server-action': 0,
    'api-handler': 0,
    component: 0,
    hook: 0,
    schema: 0,
    'service-method': 0,
    'type-definition': 0,
    'class-definition': 0,
    variable: 0,
  };

  for (const file of Object.values(files)) {
    filesByCategory[file.category] = (filesByCategory[file.category] || 0) + 1;
    for (const sym of file.symbols) {
      symbolsByCategory[sym.category] = (symbolsByCategory[sym.category] || 0) + 1;
    }
  }

  return { filesByCategory, symbolsByCategory };
}

/**
 * Rebuilds the bidirectional dependency graph and symbol inverted index.
 */
function rebuildIndexes(files: Record<string, FileMapEntry>): {
  dependencyGraph: Record<string, { imports: string[]; importedBy: string[] }>;
  symbolIndex: Record<string, string[]>;
} {
  const dependencyGraph: Record<string, { imports: string[]; importedBy: string[] }> = {};
  const symbolIndex: Record<string, string[]> = {};

  // Initialize graph nodes
  for (const relPath of Object.keys(files)) {
    dependencyGraph[relPath] = { imports: [], importedBy: [] };
  }

  // Populate graph edges and symbol index
  for (const [relPath, file] of Object.entries(files)) {
    dependencyGraph[relPath].imports = [...file.internalDependencies];

    for (const dep of file.internalDependencies) {
      if (!dependencyGraph[dep]) {
        dependencyGraph[dep] = { imports: [], importedBy: [] };
      }
      if (!dependencyGraph[dep].importedBy.includes(relPath)) {
        dependencyGraph[dep].importedBy.push(relPath);
      }
    }

    for (const sym of file.symbols) {
      if (!symbolIndex[sym.name]) {
        symbolIndex[sym.name] = [];
      }
      symbolIndex[sym.name].push(sym.id);
    }
  }

  return { dependencyGraph, symbolIndex };
}

/**
 * Dynamic Codebase Mapper and Registry Service.
 * Provides real-time in-memory indexing, AST analysis, querying, dependency resolution,
 * and prompt context generation for LLMs.
 */
export class MapperService {
  private currentMap: CodebaseMap | null = null;
  private config: MapperConfig;

  constructor(config?: Partial<MapperConfig>) {
    this.config = MapperConfigSchema.parse(config ?? {});
  }

  /**
   * Updates runtime configuration for the mapper service.
   *
   * @param config Partial configuration updates
   * @returns this
   *
   * @example
   * ```ts
   * mapperService.configure({ autoSyncOnUpdate: true, maxFiles: 10000 });
   * ```
   */
  configure(config: Partial<MapperConfig>): this {
    this.config = MapperConfigSchema.parse({
      ...this.config,
      ...config,
    });
    devInfo('MAPPER_SERVICE', `Configured mapper service (mapDir: ${this.config.mapDir}, autoSync: ${this.config.autoSyncOnUpdate})`);
    return this;
  }

  /**
   * Retrieves the current configuration of the mapper service.
   *
   * @returns Current MapperConfig
   */
  getConfig(): MapperConfig {
    return { ...this.config };
  }

  /**
   * Returns true if a codebase map is loaded in memory.
   *
   * @returns True if currentMap is not null
   */
  hasMap(): boolean {
    return this.currentMap !== null;
  }

  /**
   * Retrieves the current CodebaseMap or null if uninitialized.
   *
   * @returns CodebaseMap or null
   */
  getMap(): CodebaseMap | null {
    return this.currentMap;
  }

  /**
   * Sets the active in-memory CodebaseMap.
   *
   * @param map CodebaseMap to activate
   */
  setMap(map: CodebaseMap): void {
    this.currentMap = map;
  }

  /**
   * Retrieves a single indexed FileMapEntry.
   *
   * @param filePath Relative or absolute path of the file
   * @returns FileMapEntry or null if not indexed
   */
  getFileMap(filePath: string): FileMapEntry | null {
    if (!this.currentMap) return null;
    const relPath = sanitizeRelativePath(filePath, this.currentMap.projectRoot);
    return this.currentMap.files[relPath] ?? null;
  }

  /**
   * Retrieves all symbols matching a name across the codebase.
   *
   * @param name Name of the function, component, class, or schema
   * @returns Array of matching SymbolMapEntry objects
   */
  getSymbolsByName(name: string): SymbolMapEntry[] {
    if (!this.currentMap) return [];
    const symbolIds = this.currentMap.symbolIndex[name] || [];
    const results: SymbolMapEntry[] = [];

    for (const sId of symbolIds) {
      const [fPath, sName] = sId.split('#');
      const file = this.currentMap.files[fPath];
      if (file) {
        const sym = file.symbols.find((s) => s.id === sId || s.name === sName);
        if (sym) results.push(sym);
      }
    }

    return results;
  }

  /**
   * Retrieves detailed symbol lookup result including declaring file and consuming files.
   *
   * @param name Symbol name to look up
   * @param filePath Optional file path to disambiguate
   * @returns SymbolLookupResult or null if not found
   */
  getSymbolMap(name: string, filePath?: string): SymbolLookupResult | null {
    if (!this.currentMap) return null;
    const symbols = this.getSymbolsByName(name);
    const matched = filePath
      ? symbols.find((s) => s.filePath.includes(filePath))
      : symbols[0];

    if (!matched) return null;
    const file = this.currentMap.files[matched.filePath];
    if (!file) return null;

    const importedByFiles = this.currentMap.dependencyGraph[matched.filePath]?.importedBy ?? [];

    return {
      symbol: matched,
      file,
      importedByFiles,
    };
  }

  /**
   * Performs a comprehensive codebase scan, generates the map, builds indexes,
   * and optionally persists to disk.
   *
   * @param options Codebase scanning options
   * @returns Generated CodebaseMap
   */
  async scanCodebase(options: Partial<CodebaseScanOptions> = {}): Promise<CodebaseMap> {
    const parsed = CodebaseScanOptionsSchema.parse({
      projectRoot: this.config.projectRoot,
      mapDir: this.config.mapDir,
      includeExtensions: this.config.includeExtensions,
      excludePatterns: this.config.excludePatterns,
      maxFiles: this.config.maxFiles,
      ...options,
    });

    const projectRoot = parsed.projectRoot ? path.resolve(parsed.projectRoot) : process.cwd();
    const startTime = Date.now();

    devInfo('MAPPER_SERVICE', `Starting full codebase scan for '${projectRoot}'`);

    const filesMap: Record<string, FileMapEntry> = {};
    const includeExts = new Set(parsed.includeExtensions.map((e) => e.toLowerCase()));
    const excludePatterns = parsed.excludePatterns;

    const walk = async (currentDir: string): Promise<void> => {
      if (Object.keys(filesMap).length >= parsed.maxFiles) return;

      let entries: string[] = [];
      try {
        entries = await fs.readdir(currentDir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (Object.keys(filesMap).length >= parsed.maxFiles) break;
        if (excludePatterns.includes(entry)) continue;

        const fullPath = path.join(currentDir, entry);
        let stat: any;
        try {
          stat = await fs.stat(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          await walk(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (includeExts.has(ext)) {
            try {
              const fileEntry = await analyzeSourceFile(fullPath, projectRoot);
              filesMap[fileEntry.filePath] = fileEntry;
            } catch (err: any) {
              devDebug('MAPPER_SERVICE', `Skipped indexing file '${fullPath}': ${err.message}`);
            }
          }
        }
      }
    };

    await walk(projectRoot);

    const stats = computeMapStats(filesMap);
    const { dependencyGraph, symbolIndex } = rebuildIndexes(filesMap);

    let totalSymbols = 0;
    for (const f of Object.values(filesMap)) {
      totalSymbols += f.symbols.length;
    }

    let projectName = path.basename(projectRoot);
    try {
      const pkgPath = path.join(projectRoot, 'package.json');
      const pkgRaw = await fs.readFile(pkgPath, 'utf8');
      const pkgJson = JSON.parse(pkgRaw);
      if (pkgJson.name) projectName = pkgJson.name;
    } catch {
      // Use directory name as fallback
    }

    const now = new Date().toISOString();
    const map: CodebaseMap = {
      version: '1.0.0',
      projectRoot,
      projectName,
      generatedAt: now,
      lastUpdatedAt: now,
      totalFiles: Object.keys(filesMap).length,
      totalSymbols,
      stats,
      files: filesMap,
      dependencyGraph,
      symbolIndex,
    };

    this.currentMap = map;

    if (parsed.writeToDisk) {
      await saveCodebaseMap(map, parsed.mapDir ?? this.config.mapDir);
    }

    const duration = Date.now() - startTime;
    devInfo(
      'MAPPER_SERVICE',
      `Completed codebase scan in ${duration}ms (${map.totalFiles} files, ${map.totalSymbols} symbols)`
    );

    return map;
  }

  /**
   * Fast incremental update for a single file (added or modified).
   *
   * @param filePath Path of the file
   * @param content Optional in-memory content override
   * @param options Incremental update options
   * @returns Updated FileMapEntry
   */
  async updateFile(
    filePath: string,
    content?: string,
    options: Partial<FileUpdateOptions> = {}
  ): Promise<FileMapEntry> {
    const parsed = FileUpdateOptionsSchema.parse({
      projectRoot: this.config.projectRoot,
      mapDir: this.config.mapDir,
      writeToDisk: this.config.autoSyncOnUpdate,
      ...options,
    });

    const projectRoot = parsed.projectRoot
      ? path.resolve(parsed.projectRoot)
      : this.currentMap?.projectRoot ?? process.cwd();

    const relPath = sanitizeRelativePath(filePath, projectRoot);

    let fileEntry: FileMapEntry;
    if (content !== undefined) {
      fileEntry = analyzeSourceCode(content, relPath, projectRoot);
    } else {
      fileEntry = await analyzeSourceFile(path.resolve(projectRoot, relPath), projectRoot);
    }

    // Initialize in-memory map if none loaded
    if (!this.currentMap) {
      const stats = computeMapStats({ [relPath]: fileEntry });
      const { dependencyGraph, symbolIndex } = rebuildIndexes({ [relPath]: fileEntry });
      this.currentMap = {
        version: '1.0.0',
        projectRoot,
        projectName: path.basename(projectRoot),
        generatedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        totalFiles: 1,
        totalSymbols: fileEntry.symbols.length,
        stats,
        files: { [relPath]: fileEntry },
        dependencyGraph,
        symbolIndex,
      };
    } else {
      // Check if contentHash is identical (skip unnecessary graph rebuilding)
      const existing = this.currentMap.files[relPath];
      if (existing && existing.contentHash === fileEntry.contentHash) {
        return existing;
      }

      this.currentMap.files[relPath] = fileEntry;
      this.currentMap.lastUpdatedAt = new Date().toISOString();
      this.currentMap.totalFiles = Object.keys(this.currentMap.files).length;

      let totalSymbols = 0;
      for (const f of Object.values(this.currentMap.files)) {
        totalSymbols += f.symbols.length;
      }
      this.currentMap.totalSymbols = totalSymbols;
      this.currentMap.stats = computeMapStats(this.currentMap.files);

      const { dependencyGraph, symbolIndex } = rebuildIndexes(this.currentMap.files);
      this.currentMap.dependencyGraph = dependencyGraph;
      this.currentMap.symbolIndex = symbolIndex;
    }

    if (parsed.writeToDisk) {
      try {
        await saveCodebaseMap(this.currentMap, parsed.mapDir ?? this.config.mapDir);
      } catch (err: any) {
        devWarn('MAPPER_SERVICE', `Failed to write map to disk on update: ${err.message}`);
      }
    }

    devDebug('MAPPER_SERVICE', `Updated map for file '${relPath}' (${fileEntry.symbols.length} symbols)`);
    return fileEntry;
  }

  /**
   * Removes a deleted file from the active map and prunes indexes.
   *
   * @param filePath Path of the file to remove
   * @param options Incremental update options
   * @returns True if removed, false if not found
   */
  async removeFile(
    filePath: string,
    options: Partial<FileUpdateOptions> = {}
  ): Promise<boolean> {
    if (!this.currentMap) return false;

    const parsed = FileUpdateOptionsSchema.parse({
      projectRoot: this.config.projectRoot,
      mapDir: this.config.mapDir,
      writeToDisk: this.config.autoSyncOnUpdate,
      ...options,
    });

    const relPath = sanitizeRelativePath(filePath, this.currentMap.projectRoot);

    if (!this.currentMap.files[relPath]) return false;

    delete this.currentMap.files[relPath];
    this.currentMap.lastUpdatedAt = new Date().toISOString();
    this.currentMap.totalFiles = Object.keys(this.currentMap.files).length;

    let totalSymbols = 0;
    for (const f of Object.values(this.currentMap.files)) {
      totalSymbols += f.symbols.length;
    }
    this.currentMap.totalSymbols = totalSymbols;
    this.currentMap.stats = computeMapStats(this.currentMap.files);

    const { dependencyGraph, symbolIndex } = rebuildIndexes(this.currentMap.files);
    this.currentMap.dependencyGraph = dependencyGraph;
    this.currentMap.symbolIndex = symbolIndex;

    if (parsed.writeToDisk) {
      try {
        await saveCodebaseMap(this.currentMap, parsed.mapDir ?? this.config.mapDir);
      } catch (err: any) {
        devWarn('MAPPER_SERVICE', `Failed to write map to disk on remove: ${err.message}`);
      }
    }

    devDebug('MAPPER_SERVICE', `Removed file '${relPath}' from map`);
    return true;
  }

  /**
   * Queries files and symbols using flexible filter criteria.
   *
   * @param options Query filter and pagination options
   * @returns Filtered files and symbols with total counts
   */
  query(options: Partial<MapQueryOptions> = {}): {
    files: FileMapEntry[];
    symbols: SymbolMapEntry[];
    totalMatchingFiles: number;
    totalMatchingSymbols: number;
  } {
    if (!this.currentMap) {
      return { files: [], symbols: [], totalMatchingFiles: 0, totalMatchingSymbols: 0 };
    }

    const parsed = MapQueryOptionsSchema.parse({
      limit: this.config.defaultLimit,
      ...options,
    });
    const q = parsed.query?.toLowerCase();

    let matchedFiles = Object.values(this.currentMap.files);

    if (parsed.category) {
      matchedFiles = matchedFiles.filter((f) => f.category === parsed.category);
    }

    if (parsed.filePathPattern) {
      const pattern = parsed.filePathPattern.toLowerCase();
      matchedFiles = matchedFiles.filter((f) => f.filePath.toLowerCase().includes(pattern));
    }

    let allSymbols: SymbolMapEntry[] = [];
    for (const f of matchedFiles) {
      allSymbols.push(...f.symbols);
    }

    if (parsed.symbolCategory) {
      allSymbols = allSymbols.filter((s) => s.category === parsed.symbolCategory);
    }

    if (parsed.symbolKind) {
      allSymbols = allSymbols.filter((s) => s.kind === parsed.symbolKind);
    }

    if (parsed.exportedOnly) {
      allSymbols = allSymbols.filter((s) => s.isExported);
    }

    if (parsed.tags && parsed.tags.length > 0) {
      const targetTags = parsed.tags.map((t) => t.toLowerCase());
      allSymbols = allSymbols.filter((s) =>
        s.tags ? targetTags.some((tag) => s.tags!.includes(tag)) : false
      );
    }

    if (q) {
      allSymbols = allSymbols.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.signature.toLowerCase().includes(q) ||
          (s.docstring && s.docstring.toLowerCase().includes(q))
      );
      matchedFiles = matchedFiles.filter(
        (f) =>
          f.filePath.toLowerCase().includes(q) ||
          (f.docstring && f.docstring.toLowerCase().includes(q)) ||
          f.symbols.some((s) => s.name.toLowerCase().includes(q))
      );
    }

    const totalMatchingFiles = matchedFiles.length;
    const totalMatchingSymbols = allSymbols.length;

    const pagedFiles = matchedFiles.slice(parsed.offset, parsed.offset + parsed.limit);
    const pagedSymbols = allSymbols.slice(parsed.offset, parsed.offset + parsed.limit);

    return {
      files: pagedFiles,
      symbols: pagedSymbols,
      totalMatchingFiles,
      totalMatchingSymbols,
    };
  }

  /**
   * Generates refactoring context for a target file or symbol.
   *
   * @param target File path or symbol identifier
   * @param options Refactoring context options
   * @returns RefactoringContextResult
   */
  buildRefactoringContext(
    target: string,
    options?: Partial<RefactoringContextOptions>
  ): RefactoringContextResult {
    if (!this.currentMap) {
      throw new Error('MapperService has no active codebase map. Run scanCodebase() first.');
    }
    return buildRefactoringContext(this.currentMap, target, options);
  }

  /**
   * Generates debug context for a file and function.
   *
   * @param filePath Relative path of the file
   * @param functionName Optional function name
   * @returns Formatted debug context markdown
   */
  buildDebugContext(filePath: string, functionName?: string): string {
    if (!this.currentMap) {
      return `No active map loaded.`;
    }
    return buildDebugContext(this.currentMap, filePath, functionName);
  }

  /**
   * Generates feature implementation context based on keywords.
   *
   * @param keywords Search keywords
   * @param categories Optional category filter
   * @returns Formatted feature context markdown
   */
  buildFeatureContext(keywords: string[], categories?: FileCategory[]): string {
    if (!this.currentMap) {
      return `No active map loaded.`;
    }
    return buildFeatureContext(this.currentMap, keywords, categories);
  }

  /**
   * Generates a concise system prompt summary of the architecture.
   *
   * @returns Compact summary string
   */
  buildSystemMapSummary(): string {
    if (!this.currentMap) return '';
    return buildSystemMapSummary(this.currentMap);
  }

  /**
   * Persists active map to disk.
   *
   * @param targetDir Optional target directory override
   */
  async saveMap(targetDir?: string): Promise<void> {
    if (!this.currentMap) {
      throw new Error('No active codebase map to save.');
    }
    await saveCodebaseMap(this.currentMap, targetDir ?? this.config.mapDir);
  }

  /**
   * Loads map from disk into memory.
   *
   * @param targetDir Optional target directory override
   * @param projectRoot Project root directory
   * @returns Loaded CodebaseMap or null
   */
  async loadMap(targetDir?: string, projectRoot = process.cwd()): Promise<CodebaseMap | null> {
    const map = await loadCodebaseMap(targetDir ?? this.config.mapDir, projectRoot);
    if (map) {
      this.currentMap = map;
    }
    return map;
  }

  /**
   * Checks if a map file is present on disk.
   *
   * @param targetDir Optional target directory override
   * @param projectRoot Project root directory
   * @returns True if present
   */
  async isMapPresent(targetDir?: string, projectRoot = process.cwd()): Promise<boolean> {
    return isMapFilePresent(targetDir ?? this.config.mapDir, projectRoot);
  }

  /**
   * Clears the active in-memory map.
   */
  resetMap(): void {
    this.currentMap = null;
    devInfo('MAPPER_SERVICE', 'Cleared in-memory codebase map');
  }

  /**
   * Alias for resetMap().
   */
  clearMap(): void {
    this.resetMap();
  }
}

/**
 * Global default singleton instance of MapperService.
 */
export const defaultMapperService = new MapperService();

// ===========================================================================
// Standalone Functional API Layer (Function-First Architecture)
// ===========================================================================

/**
 * Configures the default mapper service runtime settings.
 *
 * @param config Configuration options
 * @returns Updated MapperConfig
 *
 * @example
 * ```ts
 * configureMapper({ mapDir: '.hurdler/maps', autoSyncOnUpdate: true });
 * ```
 */
export function configureMapper(config: Partial<MapperConfig>): MapperConfig {
  defaultMapperService.configure(config);
  return defaultMapperService.getConfig();
}

/**
 * Retrieves the current default mapper service configuration.
 *
 * @returns Current MapperConfig
 */
export function getMapperConfig(): MapperConfig {
  return defaultMapperService.getConfig();
}

/**
 * Scans the codebase, extracts AST symbols, builds dependency graphs,
 * and persists maps to `.hurdler/maps/`.
 *
 * @param options Scanning options
 * @returns Promise resolving to the generated CodebaseMap
 *
 * @example
 * ```ts
 * const map = await scanCodebase({ projectRoot: process.cwd(), writeToDisk: true });
 * console.log(`Mapped ${map.totalFiles} files with ${map.totalSymbols} symbols`);
 * ```
 */
export async function scanCodebase(
  options?: Partial<CodebaseScanOptions>
): Promise<CodebaseMap> {
  return defaultMapperService.scanCodebase(options);
}

/**
 * Incrementally updates or adds a file in the active codebase map.
 *
 * @param filePath Relative or absolute path of the file
 * @param content Optional in-memory content
 * @param options Incremental update options
 * @returns Promise resolving to the updated FileMapEntry
 *
 * @example
 * ```ts
 * const entry = await updateCodebaseFile('src/utils/math.ts', 'export function add(a: number, b: number) { return a + b; }');
 * ```
 */
export async function updateCodebaseFile(
  filePath: string,
  content?: string,
  options?: Partial<FileUpdateOptions>
): Promise<FileMapEntry> {
  return defaultMapperService.updateFile(filePath, content, options);
}

/**
 * Incrementally removes a file from the active codebase map.
 *
 * @param filePath Path of the file to remove
 * @param options Incremental update options
 * @returns Promise resolving to true if removed
 */
export async function removeCodebaseFile(
  filePath: string,
  options?: Partial<FileUpdateOptions>
): Promise<boolean> {
  return defaultMapperService.removeFile(filePath, options);
}

/**
 * Retrieves the current active in-memory CodebaseMap or null if none loaded.
 *
 * @returns Active CodebaseMap or null
 */
export function getCodebaseMap(): CodebaseMap | null {
  return defaultMapperService.getMap();
}

/**
 * Sets the active in-memory CodebaseMap.
 *
 * @param map CodebaseMap to set
 */
export function setCodebaseMap(map: CodebaseMap): void {
  defaultMapperService.setMap(map);
}

/**
 * Checks if a codebase map is loaded in memory.
 *
 * @returns True if map is loaded
 */
export function hasCodebaseMap(): boolean {
  return defaultMapperService.hasMap();
}

/**
 * Retrieves a single indexed FileMapEntry from the active map.
 *
 * @param filePath Relative or absolute file path
 * @returns FileMapEntry or null
 */
export function getFileMap(filePath: string): FileMapEntry | null {
  return defaultMapperService.getFileMap(filePath);
}

/**
 * Retrieves all symbols matching a given name across the codebase.
 *
 * @param name Symbol name to look up
 * @returns Array of SymbolMapEntry
 */
export function getSymbolsByName(name: string): SymbolMapEntry[] {
  return defaultMapperService.getSymbolsByName(name);
}

/**
 * Retrieves detailed symbol metadata, file context, and callers.
 *
 * @param name Symbol name
 * @param filePath Optional file path disambiguation
 * @returns SymbolLookupResult or null
 */
export function getSymbolMap(name: string, filePath?: string): SymbolLookupResult | null {
  return defaultMapperService.getSymbolMap(name, filePath);
}

/**
 * Queries the active codebase map using rich filter parameters.
 *
 * @param options Query filters and pagination options
 * @returns Filtered files and symbols
 *
 * @example
 * ```ts
 * const results = queryCodebase({ symbolKind: 'function', exportedOnly: true, limit: 10 });
 * ```
 */
export function queryCodebase(options?: Partial<MapQueryOptions>) {
  return defaultMapperService.query(options);
}

/**
 * Builds refactoring context with caller analysis and upstream dependencies for a target file or symbol.
 *
 * @param target File path or symbol name/ID
 * @param options Refactoring options
 * @returns RefactoringContextResult
 */
export function getRefactoringContext(
  target: string,
  options?: Partial<RefactoringContextOptions>
): RefactoringContextResult {
  return defaultMapperService.buildRefactoringContext(target, options);
}

/**
 * Builds targeted debugging context for a file and function.
 *
 * @param filePath File path
 * @param functionName Optional function name
 * @returns Formatted debug context string
 */
export function getDebugContext(filePath: string, functionName?: string): string {
  return defaultMapperService.buildDebugContext(filePath, functionName);
}

/**
 * Builds feature implementation context based on keywords and categories.
 *
 * @param keywords Search keywords
 * @param categories Optional category filters
 * @returns Formatted feature context string
 */
export function getFeatureContext(
  keywords: string[],
  categories?: FileCategory[]
): string {
  return defaultMapperService.buildFeatureContext(keywords, categories);
}

/**
 * Generates a concise system prompt summary of the codebase architecture.
 *
 * @returns Architectural summary string
 */
export function getSystemMapSummary(): string {
  return defaultMapperService.buildSystemMapSummary();
}

/**
 * Persists the active codebase map to disk.
 *
 * @param targetDir Optional target directory override
 */
export async function saveActiveMap(targetDir?: string): Promise<void> {
  return defaultMapperService.saveMap(targetDir);
}

/**
 * Loads a codebase map from disk into memory.
 *
 * @param targetDir Optional target directory override
 * @param projectRoot Project root path
 * @returns Promise resolving to loaded CodebaseMap or null
 */
export async function loadActiveMap(
  targetDir?: string,
  projectRoot = process.cwd()
): Promise<CodebaseMap | null> {
  return defaultMapperService.loadMap(targetDir, projectRoot);
}

/**
 * Checks if a persisted map file exists on disk.
 *
 * @param targetDir Optional target directory override
 * @param projectRoot Project root path
 * @returns Promise resolving to boolean
 */
export async function isMapPresent(
  targetDir?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  return defaultMapperService.isMapPresent(targetDir, projectRoot);
}

/**
 * Clears the active in-memory codebase map.
 */
export function resetMap(): void {
  defaultMapperService.resetMap();
}

/**
 * Alias for resetMap().
 */
export function clearMap(): void {
  defaultMapperService.clearMap();
}


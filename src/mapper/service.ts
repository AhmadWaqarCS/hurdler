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
  MapStats,
  FileCategory,
  SymbolCategory,
} from './types.js';
import {
  CodebaseScanOptionsSchema,
  FileUpdateOptionsSchema,
  MapQueryOptionsSchema,
} from './schema.js';
import { analyzeSourceCode, analyzeSourceFile } from './analyzer.js';
import { saveCodebaseMap, loadCodebaseMap, isMapFilePresent } from './storage.js';
import { buildRefactoringContext, buildDebugContext, buildFeatureContext, buildSystemMapSummary } from './context-builder.js';
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
 */
export class MapperService {
  private currentMap: CodebaseMap | null = null;

  /**
   * Returns true if a codebase map is loaded in memory.
   */
  hasMap(): boolean {
    return this.currentMap !== null;
  }

  /**
   * Retrieves the current CodebaseMap or throws if uninitialized.
   */
  getMap(): CodebaseMap | null {
    return this.currentMap;
  }

  /**
   * Sets the active in-memory CodebaseMap.
   */
  setMap(map: CodebaseMap): void {
    this.currentMap = map;
  }

  /**
   * Retrieves a single indexed FileMapEntry.
   */
  getFileMap(filePath: string): FileMapEntry | null {
    if (!this.currentMap) return null;
    const relPath = sanitizeRelativePath(filePath, this.currentMap.projectRoot);
    return this.currentMap.files[relPath] ?? null;
  }

  /**
   * Retrieves all symbols matching a name across the codebase.
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
   * Performs a comprehensive codebase scan, generates the map, builds indexes,
   * and optionally persists to disk.
   */
  async scanCodebase(options: Partial<CodebaseScanOptions> = {}): Promise<CodebaseMap> {
    const parsed = CodebaseScanOptionsSchema.parse(options);
    const projectRoot = parsed.projectRoot ? path.resolve(parsed.projectRoot) : process.cwd();
    const startTime = Date.now();

    devInfo('MAPPER_SERVICE', `Starting full codebase scan for '${projectRoot}'`);

    const filesMap: Record<string, FileMapEntry> = {};
    const includeExts = new Set(parsed.includeExtensions.map((e) => e.toLowerCase()));
    const excludePatterns = parsed.excludePatterns;

    async function walk(currentDir: string): Promise<void> {
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
    }

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
      await saveCodebaseMap(map, parsed.mapDir);
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
   */
  async updateFile(
    filePath: string,
    content?: string,
    options: Partial<FileUpdateOptions> = {}
  ): Promise<FileMapEntry> {
    const parsed = FileUpdateOptionsSchema.parse(options);
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
        await saveCodebaseMap(this.currentMap, parsed.mapDir);
      } catch (err: any) {
        devWarn('MAPPER_SERVICE', `Failed to write map to disk on update: ${err.message}`);
      }
    }

    devDebug('MAPPER_SERVICE', `Updated map for file '${relPath}' (${fileEntry.symbols.length} symbols)`);
    return fileEntry;
  }

  /**
   * Removes a deleted file from the active map and prunes indexes.
   */
  async removeFile(
    filePath: string,
    options: Partial<FileUpdateOptions> = {}
  ): Promise<boolean> {
    if (!this.currentMap) return false;

    const parsed = FileUpdateOptionsSchema.parse(options);
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
        await saveCodebaseMap(this.currentMap, parsed.mapDir);
      } catch (err: any) {
        devWarn('MAPPER_SERVICE', `Failed to write map to disk on remove: ${err.message}`);
      }
    }

    devDebug('MAPPER_SERVICE', `Removed file '${relPath}' from map`);
    return true;
  }

  /**
   * Queries files and symbols using flexible filter criteria.
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

    const parsed = MapQueryOptionsSchema.parse(options);
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
   */
  buildDebugContext(filePath: string, functionName?: string): string {
    if (!this.currentMap) {
      return `No active map loaded.`;
    }
    return buildDebugContext(this.currentMap, filePath, functionName);
  }

  /**
   * Generates feature implementation context based on keywords.
   */
  buildFeatureContext(keywords: string[], categories?: FileCategory[]): string {
    if (!this.currentMap) {
      return `No active map loaded.`;
    }
    return buildFeatureContext(this.currentMap, keywords, categories);
  }

  /**
   * Generates a concise system prompt summary of the architecture.
   */
  buildSystemMapSummary(): string {
    if (!this.currentMap) return '';
    return buildSystemMapSummary(this.currentMap);
  }

  /**
   * Persists active map to disk.
   */
  async saveMap(targetDir?: string): Promise<void> {
    if (!this.currentMap) {
      throw new Error('No active codebase map to save.');
    }
    await saveCodebaseMap(this.currentMap, targetDir);
  }

  /**
   * Loads map from disk into memory.
   */
  async loadMap(targetDir?: string, projectRoot = process.cwd()): Promise<CodebaseMap | null> {
    const map = await loadCodebaseMap(targetDir, projectRoot);
    if (map) {
      this.currentMap = map;
    }
    return map;
  }

  /**
   * Checks if a map file is present on disk.
   */
  async isMapPresent(targetDir?: string, projectRoot = process.cwd()): Promise<boolean> {
    return isMapFilePresent(targetDir, projectRoot);
  }
}

/**
 * Global default singleton instance of MapperService.
 */
export const defaultMapperService = new MapperService();

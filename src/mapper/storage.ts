import fs from 'node:fs/promises';
import path from 'node:path';
import type { CodebaseMap, FileCategory } from './types.js';
import { CodebaseMapSchema } from './schema.js';
import { MapPersistenceError } from './errors.js';
import { devInfo, devDebug } from '../core/dev-mode/index.js';

const DEFAULT_MAPS_DIR = '.hurdler/maps';

/**
 * Generates a clean, token-efficient Markdown summary catalog of the mapped codebase.
 */
export function generateMapSummaryMarkdown(map: CodebaseMap): string {
  const sections: string[] = [];

  sections.push(`# Codebase Map Summary: ${map.projectName}`);
  sections.push(`*Generated at: ${map.generatedAt} | Last updated: ${map.lastUpdatedAt}*`);
  sections.push(`- **Total Files**: ${map.totalFiles}`);
  sections.push(`- **Total Symbols**: ${map.totalSymbols}`);
  sections.push('');

  // Statistics Breakdown Table
  sections.push('## Categories Overview');
  sections.push('| File Category | Files Count |');
  sections.push('| :--- | :--- |');
  for (const [cat, count] of Object.entries(map.stats.filesByCategory)) {
    if (count > 0) {
      sections.push(`| \`${cat}\` | **${count}** |`);
    }
  }
  sections.push('');

  sections.push('## Symbols Overview');
  sections.push('| Symbol Category | Symbols Count |');
  sections.push('| :--- | :--- |');
  for (const [cat, count] of Object.entries(map.stats.symbolsByCategory)) {
    if (count > 0) {
      sections.push(`| \`${cat}\` | **${count}** |`);
    }
  }
  sections.push('');

  // Group files by category
  const filesByCat: Partial<Record<FileCategory, string[]>> = {};
  for (const [relPath, file] of Object.entries(map.files)) {
    if (!filesByCat[file.category]) {
      filesByCat[file.category] = [];
    }
    filesByCat[file.category]!.push(relPath);
  }

  sections.push('## Indexed Files and Symbols');
  for (const [cat, fileList] of Object.entries(filesByCat)) {
    sections.push(`### Category: \`${cat}\` (${fileList.length} files)`);
    for (const relPath of fileList) {
      const file = map.files[relPath];
      const flags: string[] = [];
      if (file.isServerActionFile) flags.push('[server-action]');
      if (file.isClientComponentFile) flags.push('[client-component]');

      sections.push(`- \`${relPath}\` (${file.totalLines} lines) ${flags.join(' ')}`);

      if (file.symbols.length > 0) {
        for (const s of file.symbols) {
          const exp = s.isExported ? 'export ' : '';
          const doc = s.docstring ? ` — *${s.docstring.split('\n')[0]}*` : '';
          sections.push(`  - \`${exp}${s.signature}\`${doc}`);
        }
      }
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Persists the CodebaseMap and its category slices atomically to disk.
 */
export async function saveCodebaseMap(
  map: CodebaseMap,
  targetDir?: string
): Promise<void> {
  const baseDir = targetDir
    ? path.resolve(targetDir)
    : path.resolve(map.projectRoot, DEFAULT_MAPS_DIR);

  const categoriesDir = path.join(baseDir, 'categories');

  try {
    // Validate schema before persisting
    CodebaseMapSchema.parse(map);

    await fs.mkdir(categoriesDir, { recursive: true });

    // 1. Save main codebase-map.json
    const mainMapPath = path.join(baseDir, 'codebase-map.json');
    await fs.writeFile(mainMapPath, JSON.stringify(map, null, 2), 'utf8');

    // 2. Save categorized slices
    const categorizedFiles: Partial<Record<FileCategory, Record<string, any>>> = {};
    for (const [relPath, file] of Object.entries(map.files)) {
      if (!categorizedFiles[file.category]) {
        categorizedFiles[file.category] = {};
      }
      categorizedFiles[file.category]![relPath] = file;
    }

    for (const [cat, files] of Object.entries(categorizedFiles)) {
      const catPath = path.join(categoriesDir, `${cat}.json`);
      await fs.writeFile(
        catPath,
        JSON.stringify(
          {
            category: cat,
            projectRoot: map.projectRoot,
            updatedAt: map.lastUpdatedAt,
            count: Object.keys(files).length,
            files,
          },
          null,
          2
        ),
        'utf8'
      );
    }

    // 3. Save SUMMARY.md
    const summaryMd = generateMapSummaryMarkdown(map);
    const summaryPath = path.join(baseDir, 'SUMMARY.md');
    await fs.writeFile(summaryPath, summaryMd, 'utf8');

    devInfo(
      'MAPPER_STORAGE',
      `Saved codebase map to '${baseDir}' (${map.totalFiles} files, ${map.totalSymbols} symbols)`
    );
  } catch (err: any) {
    throw new MapPersistenceError(baseDir, 'save', err.message, { cause: err });
  }
}

/**
 * Loads and validates a CodebaseMap from disk if present.
 */
export async function loadCodebaseMap(
  targetDir?: string,
  projectRoot = process.cwd()
): Promise<CodebaseMap | null> {
  const baseDir = targetDir
    ? path.resolve(targetDir)
    : path.resolve(projectRoot, DEFAULT_MAPS_DIR);

  const mainMapPath = path.join(baseDir, 'codebase-map.json');

  try {
    const raw = await fs.readFile(mainMapPath, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = CodebaseMapSchema.parse(parsed) as CodebaseMap;
    devDebug('MAPPER_STORAGE', `Loaded codebase map from '${mainMapPath}'`);
    return validated;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw new MapPersistenceError(mainMapPath, 'load', err.message, { cause: err });
  }
}

/**
 * Checks if a persisted map file exists on disk.
 */
export async function isMapFilePresent(
  targetDir?: string,
  projectRoot = process.cwd()
): Promise<boolean> {
  const baseDir = targetDir
    ? path.resolve(targetDir)
    : path.resolve(projectRoot, DEFAULT_MAPS_DIR);

  const mainMapPath = path.join(baseDir, 'codebase-map.json');
  try {
    await fs.access(mainMapPath);
    return true;
  } catch {
    return false;
  }
}

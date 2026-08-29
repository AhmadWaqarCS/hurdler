import type {
  CodebaseMap,
  FileMapEntry,
  SymbolMapEntry,
  RefactoringContextOptions,
  RefactoringContextResult,
  FileCategory,
} from './types.js';
import { RefactoringContextOptionsSchema } from './schema.js';

/**
 * Builds structured context for refactoring a file or symbol, including dependents (callers)
 * and upstream dependencies to prevent breaking changes.
 */
export function buildRefactoringContext(
  map: CodebaseMap,
  target: string,
  options: Partial<RefactoringContextOptions> = {}
): RefactoringContextResult {
  const parsed = RefactoringContextOptionsSchema.parse({ target, ...options });

  let targetFile: FileMapEntry | undefined;
  let targetSymbol: SymbolMapEntry | undefined;
  let targetRelPath = '';

  // 1. Check if target is a file in the map
  if (map.files[target]) {
    targetFile = map.files[target];
    targetRelPath = target;
  } else {
    // Check if target is in symbol index (by symbolId or symbolName)
    if (target.includes('#')) {
      const [fPath, sName] = target.split('#');
      targetFile = map.files[fPath];
      targetRelPath = fPath;
      if (targetFile) {
        targetSymbol = targetFile.symbols.find((s) => s.name === sName);
      }
    } else {
      const symbolIds = map.symbolIndex[target] || [];
      if (symbolIds.length > 0) {
        const firstId = symbolIds[0];
        const [fPath, sName] = firstId.split('#');
        targetFile = map.files[fPath];
        targetRelPath = fPath;
        if (targetFile) {
          targetSymbol = targetFile.symbols.find((s) => s.name === sName);
        }
      }
    }
  }

  // Find dependents (files that import this target)
  const dependents: RefactoringContextResult['dependents'] = [];
  if (targetRelPath) {
    const depNode = map.dependencyGraph[targetRelPath];
    const importedBy = depNode ? depNode.importedBy : [];

    for (const callerPath of importedBy.slice(0, parsed.maxCallers)) {
      const callerFile = map.files[callerPath];
      if (callerFile) {
        const importedSymbols: string[] = [];
        let line: number | undefined;

        for (const imp of callerFile.imports) {
          if (
            imp.moduleSpecifier.includes(targetRelPath.replace(/\.[^/.]+$/, '')) ||
            imp.moduleSpecifier.endsWith(targetRelPath)
          ) {
            line = imp.line;
            if (imp.defaultImport) importedSymbols.push(imp.defaultImport);
            if (imp.namespaceImport) importedSymbols.push(imp.namespaceImport);
            for (const ni of imp.namedImports) {
              importedSymbols.push(ni.name);
            }
          }
        }

        dependents.push({
          filePath: callerPath,
          importedSymbols,
          line,
        });
      }
    }
  }

  // Find dependencies (files and symbols that target imports)
  const dependencies: RefactoringContextResult['dependencies'] = [];
  if (targetFile) {
    for (const depPath of targetFile.internalDependencies) {
      const depFile = map.files[depPath];
      if (depFile) {
        const exported = depFile.symbols.filter((s) => s.isExported).map((s) => s.name);
        dependencies.push({
          filePath: depPath,
          symbols: exported,
        });
      }
    }
  }

  // 2. Format Context Markdown
  const md: string[] = [];
  const kind = targetSymbol ? 'symbol' : 'file';

  md.push(`## Refactoring Context for ${kind === 'symbol' ? `Symbol \`${targetSymbol?.name}\`` : `File \`${targetRelPath}\`}`}`);
  md.push('');

  if (targetFile) {
    md.push(`- **Location**: \`${targetFile.filePath}\` (L1-L${targetFile.totalLines})`);
    md.push(`- **Category**: \`${targetFile.category}\``);
    if (targetFile.docstring) {
      md.push(`- **File Description**: ${targetFile.docstring}`);
    }
    md.push('');
  }

  if (targetSymbol) {
    md.push('### Target Symbol Details');
    md.push(`- **Name**: \`${targetSymbol.name}\``);
    md.push(`- **Kind**: \`${targetSymbol.kind}\` | **Category**: \`${targetSymbol.category}\``);
    md.push(`- **Signature**: \`${targetSymbol.signature}\` (L${targetSymbol.lineStart}-L${targetSymbol.lineEnd})`);
    if (parsed.includeDocstrings && targetSymbol.docstring) {
      md.push(`- **Docstring**: ${targetSymbol.docstring}`);
    }
    if (targetSymbol.commentSummary) {
      md.push(`- **Comments**: \n> ${targetSymbol.commentSummary.split('\n').join('\n> ')}`);
    }
    md.push('');
  } else if (targetFile) {
    md.push('### Symbols Declared in File');
    for (const s of targetFile.symbols) {
      const exp = s.isExported ? 'export ' : '';
      md.push(`- \`${exp}${s.signature}\` (L${s.lineStart}-L${s.lineEnd})`);
      if (parsed.includeDocstrings && s.docstring) {
        md.push(`  > ${s.docstring.split('\n')[0]}`);
      }
    }
    md.push('');
  }

  // Dependents (Callers that must be kept compatible)
  if (parsed.includeCallers) {
    md.push(`### Consumers & Callers (${dependents.length} affected files)`);
    if (dependents.length === 0) {
      md.push('*No external consumers detected within the project.*');
    } else {
      md.push('> ⚠️ Ensure refactoring maintains backward compatibility with these consumers:');
      for (const dep of dependents) {
        const syms = dep.importedSymbols.length > 0 ? ` (Imports: ${dep.importedSymbols.map((s) => `\`${s}\``).join(', ')})` : '';
        const lineStr = dep.line ? `:L${dep.line}` : '';
        md.push(`- \`${dep.filePath}${lineStr}\`${syms}`);
      }
    }
    md.push('');
  }

  // Upstream Dependencies
  if (parsed.includeDependencies && dependencies.length > 0) {
    md.push(`### Upstream Dependencies (${dependencies.length} imported files)`);
    for (const dep of dependencies) {
      const symList = dep.symbols.length > 0 ? ` — Exports: ${dep.symbols.slice(0, 5).map((s) => `\`${s}\``).join(', ')}` : '';
      md.push(`- \`${dep.filePath}\`${symList}`);
    }
    md.push('');
  }

  return {
    target,
    kind,
    file: targetFile,
    symbol: targetSymbol,
    dependents,
    dependencies,
    contextMarkdown: md.join('\n'),
  };
}

/**
 * Builds context for debugging a specific file and function.
 */
export function buildDebugContext(
  map: CodebaseMap,
  filePath: string,
  functionName?: string
): string {
  const file = map.files[filePath];
  if (!file) {
    return `File '${filePath}' not found in codebase map.`;
  }

  const sections: string[] = [];
  sections.push(`## Debug Context: \`${filePath}\` (${file.category})`);

  if (functionName) {
    const symbol = file.symbols.find((s) => s.name === functionName || s.name.endsWith(`.${functionName}`));
    if (symbol) {
      sections.push(`### Target Symbol: \`${symbol.name}\``);
      sections.push(`- **Signature**: \`${symbol.signature}\` (Lines ${symbol.lineStart}-${symbol.lineEnd})`);
      if (symbol.docstring) sections.push(`- **Doc**: ${symbol.docstring}`);
      if (symbol.commentSummary) sections.push(`- **Comments**: ${symbol.commentSummary}`);
    }
  }

  // File schemas and types
  const schemasAndTypes = file.symbols.filter(
    (s) => s.kind === 'schema' || s.kind === 'interface' || s.kind === 'type'
  );
  if (schemasAndTypes.length > 0) {
    sections.push('### Related Schemas & Types in File');
    for (const s of schemasAndTypes) {
      sections.push(`- \`${s.signature}\``);
    }
  }

  // Upstream dependencies
  if (file.internalDependencies.length > 0) {
    sections.push('### Imported Project Files');
    for (const dep of file.internalDependencies) {
      sections.push(`- \`${dep}\``);
    }
  }

  return sections.join('\n\n');
}

/**
 * Builds context for implementing a feature by gathering relevant existing files and symbols.
 */
export function buildFeatureContext(
  map: CodebaseMap,
  keywords: string[],
  categories?: FileCategory[]
): string {
  const matchingFiles: FileMapEntry[] = [];
  const matchingSymbols: SymbolMapEntry[] = [];
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  for (const file of Object.values(map.files)) {
    if (categories && !categories.includes(file.category)) continue;

    const fileMatches = lowerKeywords.some(
      (k) => file.filePath.toLowerCase().includes(k) || (file.docstring && file.docstring.toLowerCase().includes(k))
    );

    if (fileMatches) {
      matchingFiles.push(file);
    }

    for (const s of file.symbols) {
      const symMatches = lowerKeywords.some(
        (k) =>
          s.name.toLowerCase().includes(k) ||
          (s.docstring && s.docstring.toLowerCase().includes(k)) ||
          (s.tags && s.tags.some((t) => t.toLowerCase().includes(k)))
      );
      if (symMatches) {
        matchingSymbols.push(s);
      }
    }
  }

  const sections: string[] = ['## Existing Codebase Context for Feature'];
  if (matchingFiles.length > 0) {
    sections.push('### Related Files:');
    for (const f of matchingFiles.slice(0, 10)) {
      sections.push(`- \`${f.filePath}\` (\`${f.category}\`, ${f.totalLines} lines)`);
    }
  }

  if (matchingSymbols.length > 0) {
    sections.push('### Relevant Existing Functions & Symbols:');
    for (const s of matchingSymbols.slice(0, 15)) {
      sections.push(`- \`${s.signature}\` in \`${s.filePath}\` (L${s.lineStart}-L${s.lineEnd})`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Generates a concise architectural map summary to be injected into LLM agent system prompts.
 */
export function buildSystemMapSummary(map: CodebaseMap): string {
  const lines: string[] = [];
  lines.push(`Codebase Map: ${map.projectName} (${map.totalFiles} files, ${map.totalSymbols} symbols)`);

  const categoryEntries = Object.entries(map.stats.filesByCategory)
    .filter(([_, count]) => count > 0)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');

  lines.push(`Categories: [${categoryEntries}]`);
  return lines.join('\n');
}

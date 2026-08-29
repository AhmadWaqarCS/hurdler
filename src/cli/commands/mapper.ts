/**
 * Hurdler CLI Subsystem - Mapper & Dynamic Registry Command
 * AST symbol indexing, dependency graphs, architectural context, and blast radius impact analysis.
 */

import type { CliCommandDefinition, CliCommandHandler } from '../types.js';
import { ExitCode } from '../types.js';
import {
  printHeader,
  printSuccess,
  printKeyValues,
  printCode,
} from '../formatters/output.js';
import { formatTable } from '../formatters/table.js';
import {
  scanCodebase,
  getCodebaseMap,
  loadActiveMap,
  clearMap,
  queryCodebase,
  getRefactoringContext,
  getFeatureContext,
  getDebugContext,
} from '../../mapper/service.js';
import { getOptionString, getOptionBoolean, getOptionArray } from '../parser.js';

export const handleMapperScan: CliCommandHandler = async (args, ctx) => {
  const force = getOptionBoolean(args.options, 'force', 'f', false);

  if (!ctx.isJson) {
    printHeader('Scanning Codebase & Indexing Symbols');
  }

  try {
    const map = await scanCodebase({
      projectRoot: ctx.projectRoot,
      writeToDisk: true,
    });

    if (!ctx.isJson) {
      printSuccess(`Scanned and mapped ${map.totalFiles} files with ${map.totalSymbols} symbols.`);
      printKeyValues({
        'Total Files': map.totalFiles,
        'Total Symbols': map.totalSymbols,
        'Project Root': map.projectRoot,
        'Project Name': map.projectName,
        'Last Updated': map.lastUpdatedAt,
      });

      if (map.stats?.filesByCategory) {
        console.log('\n📁 Files by Category:');
        for (const [cat, count] of Object.entries(map.stats.filesByCategory)) {
          console.log(`  - ${cat}: ${count} files`);
        }
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: map,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Mapper scan failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleMapperStatus: CliCommandHandler = async (args, ctx) => {
  let map = getCodebaseMap();
  if (!map) {
    map = await loadActiveMap(undefined, ctx.projectRoot);
  }

  if (!map) {
    if (!ctx.isJson) {
      console.log('No codebase map is loaded. Run `hurdler mapper scan` to index this project.');
    }
    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      message: 'No active codebase map found.',
      data: null,
    };
  }

  if (!ctx.isJson) {
    printHeader('Codebase Map Status');
    printKeyValues({
      'Total Files Indexed': map.totalFiles,
      'Total Symbols Indexed': map.totalSymbols,
      'Project Root': map.projectRoot,
      'Project Name': map.projectName,
      'Last Updated': map.lastUpdatedAt,
    });

    if (map.stats?.symbolsByCategory) {
      console.log('\n⚡ Symbols by Category:');
      for (const [cat, count] of Object.entries(map.stats.symbolsByCategory)) {
        console.log(`  - ${cat}: ${count}`);
      }
    }
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: map,
  };
};

export const handleMapperInspect: CliCommandHandler = async (args, ctx) => {
  let map = getCodebaseMap();
  if (!map) {
    map = await loadActiveMap(undefined, ctx.projectRoot);
  }

  if (!map) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: 'Codebase map not generated yet. Run `hurdler mapper scan` first.',
    };
  }

  const query = args.positionals[0] || getOptionString(args.options, 'query', 'q');
  const results = queryCodebase({ query, limit: 30 });

  const symbolRows = results.symbols.map((s) => ({
    name: s.name,
    kind: s.kind,
    file: s.filePath,
    exported: s.isExported ? 'yes' : 'no',
    line: `${s.lineStart}-${s.lineEnd}`,
  }));

  if (!ctx.isJson) {
    printHeader(`Mapper Inspection Results (${results.totalMatchingSymbols} matching symbols)`);
    console.log(
      formatTable(
        symbolRows,
        [
          { key: 'name', label: 'Symbol Name', minWidth: 26 },
          { key: 'kind', label: 'Kind', minWidth: 12 },
          { key: 'file', label: 'File Path', minWidth: 28 },
          { key: 'exported', label: 'Exported', align: 'center', minWidth: 10 },
          { key: 'line', label: 'Lines', align: 'right', minWidth: 10 },
        ],
        { indent: '  ' }
      )
    );
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: results,
  };
};

export const handleMapperContext: CliCommandHandler = async (args, ctx) => {
  let map = getCodebaseMap();
  if (!map) {
    map = await loadActiveMap(undefined, ctx.projectRoot);
  }

  if (!map) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: 'Codebase map not generated yet. Run `hurdler mapper scan` first.',
    };
  }

  const keywords = args.positionals.length > 0 ? args.positionals : getOptionArray(args.options, 'keywords', 'k');

  if (keywords.length === 0) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing keywords for context synthesis.',
      suggestion: 'Usage: hurdler mapper context <keyword1> <keyword2>...',
    };
  }

  const contextStr = getFeatureContext(keywords);

  if (!ctx.isJson) {
    printHeader(`Feature Implementation Context: ${keywords.join(', ')}`);
    printCode(contextStr, 'markdown');
  }

  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    data: { keywords, context: contextStr },
  };
};

export const handleMapperImpact: CliCommandHandler = async (args, ctx) => {
  let map = getCodebaseMap();
  if (!map) {
    map = await loadActiveMap(undefined, ctx.projectRoot);
  }

  if (!map) {
    return {
      success: false,
      exitCode: ExitCode.NOT_FOUND,
      error: 'Codebase map not generated yet. Run `hurdler mapper scan` first.',
    };
  }

  const target = args.positionals[0];
  if (!target) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_ARGUMENTS,
      error: 'Missing target file or symbol for impact analysis.',
      suggestion: 'Usage: hurdler mapper impact <filePathOrSymbol>',
    };
  }

  try {
    const context = getRefactoringContext(target);

    if (!ctx.isJson) {
      printHeader(`Refactoring & Blast Radius Impact: ${target}`);
      printKeyValues({
        'Target': context.target,
        'Target Kind': context.kind,
        'Dependents (Callers)': context.dependents.length,
        'Dependencies': context.dependencies.length,
      });

      if (context.dependents.length > 0) {
        console.log('\n⚠️ Dependent Files:');
        for (const dep of context.dependents) {
          console.log(`  - ${dep.filePath} (Imports: ${dep.importedSymbols.join(', ')})`);
        }
      }
    }

    return {
      success: true,
      exitCode: ExitCode.SUCCESS,
      data: context,
    };
  } catch (err) {
    return {
      success: false,
      exitCode: ExitCode.ERROR,
      error: `Impact analysis failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export const handleMapperClear: CliCommandHandler = async (args, ctx) => {
  clearMap();
  if (!ctx.isJson) {
    printSuccess('Active in-memory codebase map cleared.');
  }
  return {
    success: true,
    exitCode: ExitCode.SUCCESS,
    message: 'Codebase map cleared.',
  };
};

export const mapperCommandDefinition: CliCommandDefinition = {
  name: 'mapper',
  summary: 'Scan project AST symbols, inspect architecture, and analyze refactoring blast radius',
  description: 'Dynamic symbol indexer and dependency graph synthesizer for Next.js and TypeScript codebases.',
  usage: 'hurdler mapper <scan|status|inspect|context|impact|clear> [args] [options]',
  handler: handleMapperStatus,
  subcommands: {
    scan: {
      name: 'scan',
      summary: 'Scan full codebase and generate AST dependency maps',
      usage: 'hurdler mapper scan [--force]',
      options: [{ name: 'force', alias: 'f', description: 'Force complete re-scan', type: 'boolean' }],
      handler: handleMapperScan,
    },
    status: {
      name: 'status',
      summary: 'Display current codebase map index metrics and stats',
      usage: 'hurdler mapper status',
      handler: handleMapperStatus,
    },
    inspect: {
      name: 'inspect',
      summary: 'Search and inspect indexed symbols, types, and files',
      usage: 'hurdler mapper inspect [query]',
      arguments: [{ name: 'query', description: 'Symbol or file query string', required: false }],
      handler: handleMapperInspect,
    },
    context: {
      name: 'context',
      summary: 'Synthesize LLM context for a specific feature or keywords',
      usage: 'hurdler mapper context <keywords...>',
      handler: handleMapperContext,
    },
    impact: {
      name: 'impact',
      summary: 'Compute blast radius and affected files for a file/symbol',
      usage: 'hurdler mapper impact <filePathOrSymbol>',
      arguments: [{ name: 'target', description: 'Target file path or symbol', required: true }],
      handler: handleMapperImpact,
    },
    clear: {
      name: 'clear',
      summary: 'Clear in-memory codebase map',
      usage: 'hurdler mapper clear',
      handler: handleMapperClear,
    },
  },
  examples: [
    'hurdler mapper scan',
    'hurdler mapper status',
    'hurdler mapper inspect auth',
    'hurdler mapper context user authentication session',
    'hurdler mapper impact src/git/service.ts',
  ],
};

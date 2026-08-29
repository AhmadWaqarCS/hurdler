import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  FileSymbolInspection,
  FileOutline,
  OutlineOptions,
  CodebaseOutline,
  CodebaseOutlineOptions,
  FunctionInfo,
  ClassInfo,
  VariableInfo,
} from '../types.js';
import { OutlineOptionsSchema, CodebaseOutlineOptionsSchema } from '../../schema.js';
import { inspectSourceCode, inspectSourceFile } from './inspector.js';
import { sanitizeCodeFilePath, fileExists } from '../../helpers.js';

/**
 * Formats a FileSymbolInspection into a compact, token-efficient Markdown outline.
 */
export function formatInspectionAsMarkdown(
  inspection: FileSymbolInspection,
  options: OutlineOptions = {}
): string {
  const parsed = OutlineOptionsSchema.parse(options);
  const sections: string[] = [];
  const fileName = inspection.filePath ?? 'file.ts';

  sections.push(`### Outline: \`${fileName}\` (${inspection.totalLines} lines)`);

  // Imports
  if (parsed.includeImports && inspection.imports.length > 0) {
    sections.push('#### Imports');
    for (const imp of inspection.imports) {
      const items = imp.namedImports.map((ni: any) => ni.alias ? `${ni.name} as ${ni.alias}` : ni.name).join(', ');
      const def = imp.defaultImport ? `${imp.defaultImport}${items ? ', ' : ''}` : '';
      sections.push(`- \`import ${def}${items ? `{ ${items} }` : ''} from '${imp.moduleSpecifier}'\` (L${imp.line})`);
    }
  }

  // React / Next Components
  if (inspection.components.length > 0) {
    sections.push('#### React Components');
    for (const comp of inspection.components) {
      const expPrefix = comp.isDefaultExport ? 'export default ' : comp.isExported ? 'export ' : '';
      const propsStr = comp.propsType ? `<${comp.propsType}>` : '';
      const hooksStr = comp.hooksUsed.length > 0 ? ` [Hooks: ${comp.hooksUsed.join(', ')}]` : '';
      sections.push(`- \`${expPrefix}Component ${comp.name}${propsStr}\` (L${comp.lineStart}-L${comp.lineEnd})${hooksStr}`);
      if (parsed.includeDocstrings && comp.docstring) {
        sections.push(`  > ${comp.docstring}`);
      }
    }
  }

  // Functions
  const filteredFunctions = inspection.functions.filter((fn: FunctionInfo) =>
    parsed.includeExports ? fn.isExported || !parsed.includeExports : true
  );

  if (filteredFunctions.length > 0) {
    sections.push('#### Functions');
    for (const fn of filteredFunctions) {
      sections.push(`- \`${fn.signature}\` (L${fn.lineStart}-L${fn.lineEnd})`);
      if (parsed.includeDocstrings && fn.docstring) {
        sections.push(`  > ${fn.docstring}`);
      }
    }
  }

  // Classes
  const filteredClasses = inspection.classes.filter((cls: ClassInfo) =>
    parsed.includeExports ? cls.isExported || !parsed.includeExports : true
  );

  if (filteredClasses.length > 0) {
    sections.push('#### Classes');
    for (const cls of filteredClasses) {
      const expPrefix = cls.isExported ? 'export ' : '';
      const absPrefix = cls.isAbstract ? 'abstract ' : '';
      const extStr = cls.extendsClass ? ` extends ${cls.extendsClass}` : '';
      const impStr = cls.implementsInterfaces.length > 0 ? ` implements ${cls.implementsInterfaces.join(', ')}` : '';
      sections.push(`- \`${expPrefix}${absPrefix}class ${cls.name}${extStr}${impStr}\` (L${cls.lineStart}-L${cls.lineEnd})`);

      if (parsed.includeDocstrings && cls.docstring) {
        sections.push(`  > ${cls.docstring}`);
      }

      if (parsed.detailLevel !== 'compact') {
        // Methods
        for (const method of cls.methods) {
          if (!parsed.includePrivate && method.visibility === 'private') continue;
          sections.push(`  - \`${method.signature}\` (L${method.lineStart}-L${method.lineEnd})`);
        }
      }
    }
  }

  // Interfaces
  if (inspection.interfaces.length > 0) {
    sections.push('#### Interfaces');
    for (const iface of inspection.interfaces) {
      const expPrefix = iface.isExported ? 'export ' : '';
      const extStr = iface.extendsInterfaces.length > 0 ? ` extends ${iface.extendsInterfaces.join(', ')}` : '';
      const propsCount = `${iface.properties.length} props, ${iface.methods.length} methods`;
      sections.push(`- \`${expPrefix}interface ${iface.name}${extStr}\` (${propsCount}, L${iface.lineStart}-L${iface.lineEnd})`);

      if (parsed.detailLevel === 'detailed') {
        for (const prop of iface.properties) {
          sections.push(`  - \`${prop.name}${prop.optional ? '?' : ''}: ${prop.type}\``);
        }
      }
    }
  }

  // Type Aliases
  if (inspection.types.length > 0) {
    sections.push('#### Types');
    for (const type of inspection.types) {
      const expPrefix = type.isExported ? 'export ' : '';
      const tpStr = type.typeParameters.length > 0 ? `<${type.typeParameters.join(', ')}>` : '';
      sections.push(`- \`${expPrefix}type ${type.name}${tpStr} = ${type.typeDefinition}\` (L${type.lineStart}-L${type.lineEnd})`);
    }
  }

  // Enums
  if (inspection.enums.length > 0) {
    sections.push('#### Enums');
    for (const en of inspection.enums) {
      const members = en.members.map((m: any) => m.name).join(', ');
      sections.push(`- \`enum ${en.name} { ${members} }\` (L${en.lineStart}-L${en.lineEnd})`);
    }
  }

  // Top-Level Variables
  const filteredVars = inspection.variables.filter((v: VariableInfo) =>
    parsed.includeExports ? v.isExported : true
  );

  if (filteredVars.length > 0) {
    sections.push('#### Exported Constants & Variables');
    for (const v of filteredVars) {
      sections.push(`- \`${v.declarationPreview}\` (L${v.lineStart}-L${v.lineEnd})`);
    }
  }

  return sections.join('\n');
}

/**
 * Generates an AST outline for a single file or in-memory code string.
 */
export function generateFileOutline(
  codeOrFilePath: string,
  options: OutlineOptions = {}
): FileOutline {
  let inspection: FileSymbolInspection;
  let targetPath = 'snippet.ts';

  if (codeOrFilePath.includes('\n') || codeOrFilePath.length > 500 || !fileExists(codeOrFilePath)) {
    // In-memory code
    inspection = inspectSourceCode(codeOrFilePath, 'snippet.ts');
  } else {
    // File path on disk
    targetPath = codeOrFilePath;
    inspection = inspectSourceFile(codeOrFilePath);
  }

  const markdown = formatInspectionAsMarkdown(inspection, options);
  const summary = `${inspection.functions.length} function(s), ${inspection.classes.length} class(es), ${inspection.interfaces.length} interface(s)`;

  return {
    filePath: targetPath,
    summary,
    symbolsCount: {
      functions: inspection.functions.length,
      classes: inspection.classes.length,
      interfaces: inspection.interfaces.length,
      types: inspection.types.length,
      components: inspection.components.length,
    },
    markdown,
  };
}

/**
 * Recursively scans directory and builds an indexed catalog of files and exported symbols.
 */
export async function generateCodebaseOutline(
  dirPath: string,
  options: CodebaseOutlineOptions = {}
): Promise<CodebaseOutline> {
  const parsed = CodebaseOutlineOptionsSchema.parse(options);
  const rootPath = sanitizeCodeFilePath(dirPath);
  const fileOutlines: FileOutline[] = [];

  async function walkDir(currentDir: string): Promise<void> {
    if (fileOutlines.length >= parsed.maxFiles) return;

    let entries: string[] = [];
    try {
      entries = await fs.readdir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (fileOutlines.length >= parsed.maxFiles) break;
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.next') continue;

      const fullPath = path.join(currentDir, entry);
      let stat: any;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        await walkDir(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        if (parsed.includeExtensions.includes(ext)) {
          try {
            const relPath = path.relative(rootPath, fullPath);
            const outline = generateFileOutline(fullPath, {
              detailLevel: parsed.detailLevel,
              includeExports: true,
              includeDocstrings: false,
            });
            outline.filePath = relPath;
            fileOutlines.push(outline);
          } catch {
            // Skip unparseable files gracefully
          }
        }
      }
    }
  }

  await walkDir(rootPath);

  const summaryMarkdown = [
    `## Codebase Outline: \`${path.basename(rootPath)}\` (${fileOutlines.length} files scanned)`,
    '',
    ...fileOutlines.map((fo) => fo.markdown),
  ].join('\n\n');

  return {
    totalFiles: fileOutlines.length,
    files: fileOutlines,
    summaryMarkdown,
  };
}

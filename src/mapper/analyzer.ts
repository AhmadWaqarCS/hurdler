import fs from 'node:fs/promises';
import path from 'node:path';
import { Node, type SourceFile, type FunctionDeclaration } from 'ts-morph';
import type { FileMapEntry, SymbolMapEntry, SymbolKind } from './types.js';
import { createVirtualSourceFile } from '../code/ast/ts-morph/project.js';
import { detectLanguageFromPath } from '../code/helpers.js';
import {
  computeContentHash,
  sanitizeRelativePath,
  resolveImportPath,
  extractLeadingComments,
  extractTagsFromDocstring,
} from './helpers.js';
import { classifyFile, classifySymbol } from './classifier.js';
import { devDebug } from '../core/dev-mode/index.js';

/**
 * Extracts JSDoc description from a ts-morph AST node.
 */
function extractDocstring(node: any): string | undefined {
  if (!node.getJsDocs) return undefined;
  const jsDocs = node.getJsDocs();
  if (jsDocs.length === 0) return undefined;
  return jsDocs
    .map((doc: any) => doc.getDescription().trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Extracts parameter details from a ts-morph function/method node.
 */
function extractParameters(fnNode: FunctionDeclaration | any): Array<{
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}> {
  if (!fnNode.getParameters) return [];
  return fnNode.getParameters().map((param: any) => ({
    name: param.getName(),
    type: param.getType().getText(param),
    optional: param.isOptional(),
    defaultValue: param.getInitializer()?.getText(),
  }));
}

/**
 * Analyzes in-memory source code or file contents into a complete FileMapEntry.
 */
export function analyzeSourceCode(
  code: string,
  filePath: string,
  projectRoot = process.cwd(),
  lastModifiedMs = Date.now()
): FileMapEntry {
  const relPath = sanitizeRelativePath(filePath, projectRoot);
  const language = detectLanguageFromPath(relPath);
  const sizeBytes = Buffer.byteLength(code, 'utf8');
  const lines = code.split('\n');
  const totalLines = lines.length;
  const contentHash = computeContentHash(code);

  const trimmed = code.trim();
  const isServerActionFile =
    trimmed.startsWith("'use server'") || trimmed.startsWith('"use server"');
  const isClientComponentFile =
    trimmed.startsWith("'use client'") || trimmed.startsWith('"use client"');

  const symbols: SymbolMapEntry[] = [];
  const imports: FileMapEntry['imports'] = [];
  const exports: FileMapEntry['exports'] = [];
  const internalDependenciesSet = new Set<string>();
  const externalDependenciesSet = new Set<string>();

  // Extract top-level file docstring if present
  let fileDocstring: string | undefined;
  if (trimmed.startsWith('/**')) {
    const docEnd = trimmed.indexOf('*/');
    if (docEnd !== -1) {
      fileDocstring = trimmed
        .slice(0, docEnd + 2)
        .replace(/^\/\*+\s*|\s*\*+\/$/g, '')
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join('\n');
    }
  }

  // If non-code (e.g. JSON), generate basic file map
  if (language === 'json' || !['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(language)) {
    let category = classifyFile(relPath, code, []);
    try {
      if (language === 'json') {
        const parsed = JSON.parse(code);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const key of Object.keys(parsed)) {
            symbols.push({
              id: `${relPath}#${key}`,
              name: key,
              kind: 'variable',
              category: 'variable',
              filePath: relPath,
              lineStart: 1,
              lineEnd: totalLines,
              signature: `key ${key}`,
              isExported: true,
              isDefaultExport: false,
              isAsync: false,
              parameters: [],
              dependencies: [],
            });
          }
        }
      }
    } catch {
      // Non-fatal JSON parse error
    }

    return {
      filePath: relPath,
      category,
      language,
      sizeBytes,
      totalLines,
      contentHash,
      lastModifiedMs,
      isServerActionFile: false,
      isClientComponentFile: false,
      docstring: fileDocstring,
      imports: [],
      exports: [],
      symbols,
      internalDependencies: [],
      externalDependencies: [],
    };
  }

  // Parse code using ts-morph
  let sourceFile: SourceFile;
  try {
    sourceFile = createVirtualSourceFile(code, relPath);
  } catch (err: any) {
    devDebug('MAPPER_ANALYZER', `Failed to parse AST for ${relPath}: ${err.message}`);
    const category = classifyFile(relPath, code, []);
    return {
      filePath: relPath,
      category,
      language,
      sizeBytes,
      totalLines,
      contentHash,
      lastModifiedMs,
      isServerActionFile,
      isClientComponentFile,
      docstring: fileDocstring,
      imports: [],
      exports: [],
      symbols: [],
      internalDependencies: [],
      externalDependencies: [],
    };
  }

  // 1. Extract Imports
  for (const imp of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const defaultImport = imp.getDefaultImport()?.getText();
    const namespaceImport = imp.getNamespaceImport()?.getText();
    const isTypeOnly = imp.isTypeOnly();
    const line = imp.getStartLineNumber();

    const namedImports = imp.getNamedImports().map((ni) => ({
      name: ni.getName(),
      alias: ni.getAliasNode()?.getText(),
      isTypeOnly: ni.isTypeOnly(),
    }));

    imports.push({
      moduleSpecifier,
      defaultImport,
      namedImports,
      namespaceImport,
      isTypeOnly,
      line,
    });

    const resolved = resolveImportPath(moduleSpecifier, relPath, projectRoot);
    if (resolved) {
      internalDependenciesSet.add(resolved);
    } else {
      externalDependenciesSet.add(moduleSpecifier);
    }
  }

  // 2. Extract Exports
  for (const exp of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = exp.getModuleSpecifierValue();
    const isTypeOnly = exp.isTypeOnly();
    const line = exp.getStartLineNumber();

    for (const ne of exp.getNamedExports()) {
      exports.push({
        name: ne.getName(),
        isDefault: false,
        isTypeOnly,
        moduleSpecifier,
        line,
      });
    }
  }

  // Helper preliminary file category for symbol classification
  const preliminaryCategory = classifyFile(relPath, code, []);

  // 3. Extract Functions
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName() ?? 'anonymous';
    const params = extractParameters(fn);
    const returnType = fn.getReturnType().getText(fn);
    const isAsync = fn.isAsync();
    const isExported = fn.isExported();
    const isDefaultExport = fn.isDefaultExport();
    const docstring = extractDocstring(fn);
    const lineStart = fn.getStartLineNumber();
    const lineEnd = fn.getEndLineNumber();
    const commentSummary = extractLeadingComments(code, lineStart);
    const bodyText = fn.getBodyText() ?? '';

    const paramStrings = params.map(
      (p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`
    );
    const signature = `${isExported ? 'export ' : ''}${isDefaultExport ? 'default ' : ''}${isAsync ? 'async ' : ''}function ${name}(${paramStrings.join(', ')}): ${returnType}`;

    const kind: SymbolKind =
      name[0] === name[0]?.toUpperCase() && (relPath.endsWith('.tsx') || relPath.endsWith('.jsx'))
        ? 'component'
        : 'function';

    const category = classifySymbol(name, kind, preliminaryCategory, relPath, {
      isExported,
      signature,
      bodyText,
    });

    const tags = extractTagsFromDocstring(docstring);
    if (isServerActionFile || bodyText.includes("'use server'")) tags.push('server-action');
    if (category === 'hook') tags.push('hook');

    symbols.push({
      id: `${relPath}#${name}`,
      name,
      kind,
      category,
      filePath: relPath,
      lineStart,
      lineEnd,
      signature,
      docstring,
      commentSummary,
      isExported,
      isDefaultExport,
      isAsync,
      parameters: params,
      returnType,
      dependencies: [],
      tags: Array.from(new Set(tags)),
    });
  }

  // 4. Extract Exported Arrow Functions and Variables
  for (const varStmt of sourceFile.getVariableStatements()) {
    const isExported = varStmt.isExported();
    const docstring = extractDocstring(varStmt);
    const lineStart = varStmt.getStartLineNumber();
    const lineEnd = varStmt.getEndLineNumber();
    const commentSummary = extractLeadingComments(code, lineStart);

    for (const decl of varStmt.getDeclarations()) {
      const name = decl.getName();
      const initializer = decl.getInitializer();
      const type = decl.getType().getText(decl);

      if (
        initializer &&
        (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
      ) {
        const params = extractParameters(initializer);
        const returnType = initializer.getReturnType().getText(decl);
        const isAsync = initializer.isAsync ? initializer.isAsync() : false;
        const bodyText = initializer.getBody().getText();

        const paramStrings = params.map(
          (p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`
        );
        const signature = `${isExported ? 'export ' : ''}const ${name} = ${isAsync ? 'async ' : ''}(${paramStrings.join(', ')}): ${returnType}`;

        const kind: SymbolKind =
          name[0] === name[0]?.toUpperCase() && (relPath.endsWith('.tsx') || relPath.endsWith('.jsx'))
            ? 'component'
            : 'function';

        const category = classifySymbol(name, kind, preliminaryCategory, relPath, {
          isExported,
          signature,
          bodyText,
        });

        const tags = extractTagsFromDocstring(docstring);
        if (isServerActionFile || bodyText.includes("'use server'")) tags.push('server-action');
        if (category === 'hook') tags.push('hook');

        symbols.push({
          id: `${relPath}#${name}`,
          name,
          kind,
          category,
          filePath: relPath,
          lineStart,
          lineEnd,
          signature,
          docstring,
          commentSummary,
          isExported,
          isDefaultExport: false,
          isAsync,
          parameters: params,
          returnType,
          dependencies: [],
          tags: Array.from(new Set(tags)),
        });
      } else {
        // Regular Variable / Schema
        const isSchema =
          name.endsWith('Schema') ||
          type.includes('ZodType') ||
          type.includes('z.Zod') ||
          (initializer && initializer.getText().startsWith('z.'));

        const kind: SymbolKind = isSchema ? 'schema' : 'variable';
        const signature = `${isExported ? 'export ' : ''}const ${name}: ${type}`;
        const category = classifySymbol(name, kind, preliminaryCategory, relPath, {
          isExported,
          signature,
        });

        const tags = extractTagsFromDocstring(docstring);
        if (isSchema) tags.push('zod', 'validation');

        symbols.push({
          id: `${relPath}#${name}`,
          name,
          kind,
          category,
          filePath: relPath,
          lineStart,
          lineEnd,
          signature,
          docstring,
          commentSummary,
          isExported,
          isDefaultExport: false,
          isAsync: false,
          parameters: [],
          returnType: type,
          dependencies: [],
          tags: Array.from(new Set(tags)),
        });
      }
    }
  }

  // 5. Extract Classes and Methods
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName() ?? 'AnonymousClass';
    const isExported = cls.isExported();
    const isDefaultExport = cls.isDefaultExport();
    const docstring = extractDocstring(cls);
    const lineStart = cls.getStartLineNumber();
    const lineEnd = cls.getEndLineNumber();
    const commentSummary = extractLeadingComments(code, lineStart);
    const extendsClass = cls.getExtends()?.getText();
    const implementsInterfaces = cls.getImplements().map((imp) => imp.getText());

    const extStr = extendsClass ? ` extends ${extendsClass}` : '';
    const impStr = implementsInterfaces.length > 0 ? ` implements ${implementsInterfaces.join(', ')}` : '';
    const signature = `${isExported ? 'export ' : ''}class ${name}${extStr}${impStr}`;

    const category = classifySymbol(name, 'class', preliminaryCategory, relPath, {
      isExported,
      signature,
    });

    symbols.push({
      id: `${relPath}#${name}`,
      name,
      kind: 'class',
      category,
      filePath: relPath,
      lineStart,
      lineEnd,
      signature,
      docstring,
      commentSummary,
      isExported,
      isDefaultExport,
      isAsync: false,
      parameters: [],
      dependencies: [],
      tags: extractTagsFromDocstring(docstring),
    });

    // Extract Class Methods as individual symbols
    for (const method of cls.getMethods()) {
      const mName = method.getName();
      const mParams = extractParameters(method);
      const mReturnType = method.getReturnType().getText(method);
      const mIsAsync = method.isAsync();
      const mScope = (method.getScope() || 'public') as string;
      const mDoc = extractDocstring(method);
      const mStart = method.getStartLineNumber();
      const mEnd = method.getEndLineNumber();

      const paramStrings = mParams.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`);
      const mSignature = `${mScope} ${mIsAsync ? 'async ' : ''}${mName}(${paramStrings.join(', ')}): ${mReturnType}`;

      const mCategory = classifySymbol(mName, 'method', preliminaryCategory, relPath, {
        isExported,
        signature: mSignature,
      });

      symbols.push({
        id: `${relPath}#${name}.${mName}`,
        name: `${name}.${mName}`,
        kind: 'method',
        category: mCategory,
        filePath: relPath,
        lineStart: mStart,
        lineEnd: mEnd,
        signature: mSignature,
        docstring: mDoc,
        commentSummary: extractLeadingComments(code, mStart),
        isExported,
        isDefaultExport: false,
        isAsync: mIsAsync,
        parameters: mParams,
        returnType: mReturnType,
        dependencies: [],
        tags: extractTagsFromDocstring(mDoc),
      });
    }
  }

  // 6. Extract Interfaces
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    const isExported = iface.isExported();
    const docstring = extractDocstring(iface);
    const lineStart = iface.getStartLineNumber();
    const lineEnd = iface.getEndLineNumber();
    const extendsInterfaces = iface.getExtends().map((e) => e.getText());
    const extStr = extendsInterfaces.length > 0 ? ` extends ${extendsInterfaces.join(', ')}` : '';
    const signature = `${isExported ? 'export ' : ''}interface ${name}${extStr}`;

    symbols.push({
      id: `${relPath}#${name}`,
      name,
      kind: 'interface',
      category: 'type-definition',
      filePath: relPath,
      lineStart,
      lineEnd,
      signature,
      docstring,
      commentSummary: extractLeadingComments(code, lineStart),
      isExported,
      isDefaultExport: false,
      isAsync: false,
      parameters: [],
      dependencies: [],
      tags: extractTagsFromDocstring(docstring),
    });
  }

  // 7. Extract Type Aliases
  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();
    const isExported = typeAlias.isExported();
    const docstring = extractDocstring(typeAlias);
    const lineStart = typeAlias.getStartLineNumber();
    const lineEnd = typeAlias.getEndLineNumber();
    const typeDef = typeAlias.getType().getText(typeAlias);
    const signature = `${isExported ? 'export ' : ''}type ${name} = ${typeDef}`;

    symbols.push({
      id: `${relPath}#${name}`,
      name,
      kind: 'type',
      category: 'type-definition',
      filePath: relPath,
      lineStart,
      lineEnd,
      signature,
      docstring,
      commentSummary: extractLeadingComments(code, lineStart),
      isExported,
      isDefaultExport: false,
      isAsync: false,
      parameters: [],
      dependencies: [],
      tags: extractTagsFromDocstring(docstring),
    });
  }

  // 8. Extract Enums
  for (const enumDecl of sourceFile.getEnums()) {
    const name = enumDecl.getName();
    const isExported = enumDecl.isExported();
    const docstring = extractDocstring(enumDecl);
    const lineStart = enumDecl.getStartLineNumber();
    const lineEnd = enumDecl.getEndLineNumber();
    const members = enumDecl.getMembers().map((m) => m.getName()).join(', ');
    const signature = `${isExported ? 'export ' : ''}enum ${name} { ${members} }`;

    symbols.push({
      id: `${relPath}#${name}`,
      name,
      kind: 'enum',
      category: 'type-definition',
      filePath: relPath,
      lineStart,
      lineEnd,
      signature,
      docstring,
      commentSummary: extractLeadingComments(code, lineStart),
      isExported,
      isDefaultExport: false,
      isAsync: false,
      parameters: [],
      dependencies: [],
      tags: extractTagsFromDocstring(docstring),
    });
  }

  // Final file category determination with all extracted symbols
  const finalCategory = classifyFile(relPath, code, symbols);

  return {
    filePath: relPath,
    category: finalCategory,
    language,
    sizeBytes,
    totalLines,
    contentHash,
    lastModifiedMs,
    isServerActionFile,
    isClientComponentFile,
    docstring: fileDocstring,
    imports,
    exports,
    symbols,
    internalDependencies: Array.from(internalDependenciesSet),
    externalDependencies: Array.from(externalDependenciesSet),
  };
}

/**
 * Analyzes a file on disk into a complete FileMapEntry.
 */
export async function analyzeSourceFile(
  filePath: string,
  projectRoot = process.cwd()
): Promise<FileMapEntry> {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
  const stat = await fs.stat(absPath);
  const content = await fs.readFile(absPath, 'utf8');
  return analyzeSourceCode(content, absPath, projectRoot, stat.mtimeMs);
}

import type {
  SourceFile,
  FunctionDeclaration,
} from 'ts-morph';
import { Node } from 'ts-morph';
import type {
  FileSymbolInspection,
  FunctionInfo,
  ClassInfo,
  InterfaceInfo,
  TypeAliasInfo,
  EnumInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
  ComponentInfo,
  ParameterInfo,
  MethodInfo,
  PropertyInfo,
} from '../types.js';
import { createVirtualSourceFile, loadDiskSourceFile } from './project.js';
import { detectLanguageFromPath } from '../../helpers.js';
import { devInfo } from '../../../core/dev-mode/index.js';

/**
 * Extracts parameter details from a ts-morph node with parameters.
 */
function extractParameters(fnNode: FunctionDeclaration | any): ParameterInfo[] {
  if (!fnNode.getParameters) return [];
  return fnNode.getParameters().map((param: any) => ({
    name: param.getName(),
    type: param.getType().getText(param),
    optional: param.isOptional(),
    defaultValue: param.getInitializer()?.getText(),
  }));
}

/**
 * Extracts JSDoc text from a node if present.
 */
function extractDocstring(node: any): string | undefined {
  if (!node.getJsDocs) return undefined;
  const jsDocs = node.getJsDocs();
  if (jsDocs.length === 0) return undefined;
  return jsDocs.map((doc: any) => doc.getDescription().trim()).filter(Boolean).join('\n');
}

/**
 * Extracts functions from a SourceFile.
 */
export function extractFunctions(sourceFile: SourceFile): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName() ?? 'anonymous';
    const params = extractParameters(fn);
    const returnType = fn.getReturnType().getText(fn);
    const isAsync = fn.isAsync();
    const isGenerator = fn.isGenerator();
    const isExported = fn.isExported();
    const isDefaultExport = fn.isDefaultExport();
    const docstring = extractDocstring(fn);
    const lineStart = fn.getStartLineNumber();
    const lineEnd = fn.getEndLineNumber();

    const paramStrings = params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`);
    const signature = `${isExported ? 'export ' : ''}${isAsync ? 'async ' : ''}function ${name}(${paramStrings.join(', ')}): ${returnType}`;

    functions.push({
      name,
      parameters: params,
      returnType,
      isAsync,
      isGenerator,
      isExported,
      isDefaultExport,
      docstring,
      lineStart,
      lineEnd,
      signature,
    });
  }

  // Also check for arrow functions assigned to exported const variables
  for (const varStmt of sourceFile.getVariableStatements()) {
    const isExported = varStmt.isExported();
    for (const decl of varStmt.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (
        initializer &&
        (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
      ) {
        const name = decl.getName();
        const params = extractParameters(initializer);
        const returnType = initializer.getReturnType().getText(decl);
        const isAsync = initializer.isAsync ? initializer.isAsync() : false;
        const docstring = extractDocstring(varStmt);
        const lineStart = varStmt.getStartLineNumber();
        const lineEnd = varStmt.getEndLineNumber();

        const paramStrings = params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`);
        const signature = `${isExported ? 'export ' : ''}const ${name} = ${isAsync ? 'async ' : ''}(${paramStrings.join(', ')}): ${returnType}`;

        functions.push({
          name,
          parameters: params,
          returnType,
          isAsync,
          isGenerator: false,
          isExported,
          isDefaultExport: false,
          docstring,
          lineStart,
          lineEnd,
          signature,
        });
      }
    }
  }

  return functions;
}

/**
 * Extracts classes from a SourceFile.
 */
export function extractClasses(sourceFile: SourceFile): ClassInfo[] {
  const classes: ClassInfo[] = [];

  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName() ?? 'AnonymousClass';
    const isExported = cls.isExported();
    const isDefaultExport = cls.isDefaultExport();
    const isAbstract = cls.isAbstract();
    const extendsClass = cls.getExtends()?.getText();
    const implementsInterfaces = cls.getImplements().map((imp) => imp.getText());
    const docstring = extractDocstring(cls);
    const lineStart = cls.getStartLineNumber();
    const lineEnd = cls.getEndLineNumber();

    // Constructors
    const constructors = cls.getConstructors().map((ctor) => ({
      parameters: extractParameters(ctor),
      visibility: (ctor.getScope() || 'public') as 'public' | 'protected' | 'private',
      docstring: extractDocstring(ctor),
    }));

    // Properties
    const properties: PropertyInfo[] = cls.getProperties().map((prop) => ({
      name: prop.getName(),
      type: prop.getType().getText(prop),
      isStatic: prop.isStatic(),
      isReadonly: prop.isReadonly(),
      visibility: (prop.getScope() || 'public') as 'public' | 'protected' | 'private',
      optional: prop.hasQuestionToken(),
      initializer: prop.getInitializer()?.getText(),
      docstring: extractDocstring(prop),
    }));

    // Methods
    const methods: MethodInfo[] = cls.getMethods().map((m) => {
      const mName = m.getName();
      const mParams = extractParameters(m);
      const mReturnType = m.getReturnType().getText(m);
      const mIsAsync = m.isAsync();
      const mIsStatic = m.isStatic();
      const mScope = (m.getScope() || 'public') as 'public' | 'protected' | 'private';
      const mIsAbstract = m.isAbstract();
      const mDoc = extractDocstring(m);
      const mStart = m.getStartLineNumber();
      const mEnd = m.getEndLineNumber();

      const paramStrings = mParams.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`);
      const mSignature = `${mScope} ${mIsStatic ? 'static ' : ''}${mIsAsync ? 'async ' : ''}${mName}(${paramStrings.join(', ')}): ${mReturnType}`;

      return {
        name: mName,
        parameters: mParams,
        returnType: mReturnType,
        isAsync: mIsAsync,
        isStatic: mIsStatic,
        visibility: mScope,
        isAbstract: mIsAbstract,
        docstring: mDoc,
        lineStart: mStart,
        lineEnd: mEnd,
        signature: mSignature,
      };
    });

    classes.push({
      name,
      isExported,
      isDefaultExport,
      isAbstract,
      extendsClass,
      implementsInterfaces,
      constructors,
      properties,
      methods,
      docstring,
      lineStart,
      lineEnd,
    });
  }

  return classes;
}

/**
 * Extracts interfaces from a SourceFile.
 */
export function extractInterfaces(sourceFile: SourceFile): InterfaceInfo[] {
  const interfaces: InterfaceInfo[] = [];

  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    const isExported = iface.isExported();
    const typeParameters = iface.getTypeParameters().map((tp) => tp.getText());
    const extendsInterfaces = iface.getExtends().map((ext) => ext.getText());
    const docstring = extractDocstring(iface);
    const lineStart = iface.getStartLineNumber();
    const lineEnd = iface.getEndLineNumber();

    const properties: PropertyInfo[] = iface.getProperties().map((prop) => ({
      name: prop.getName(),
      type: prop.getType().getText(prop),
      isReadonly: prop.isReadonly(),
      optional: prop.hasQuestionToken(),
      docstring: extractDocstring(prop),
    }));

    const methods = iface.getMethods().map((m) => ({
      name: m.getName(),
      parameters: extractParameters(m),
      returnType: m.getReturnType().getText(m),
      docstring: extractDocstring(m),
    }));

    interfaces.push({
      name,
      isExported,
      typeParameters,
      extendsInterfaces,
      properties,
      methods,
      docstring,
      lineStart,
      lineEnd,
    });
  }

  return interfaces;
}

/**
 * Extracts type aliases from a SourceFile.
 */
export function extractTypes(sourceFile: SourceFile): TypeAliasInfo[] {
  const types: TypeAliasInfo[] = [];

  for (const typeAlias of sourceFile.getTypeAliases()) {
    types.push({
      name: typeAlias.getName(),
      isExported: typeAlias.isExported(),
      typeParameters: typeAlias.getTypeParameters().map((tp) => tp.getText()),
      typeDefinition: typeAlias.getType().getText(typeAlias),
      docstring: extractDocstring(typeAlias),
      lineStart: typeAlias.getStartLineNumber(),
      lineEnd: typeAlias.getEndLineNumber(),
    });
  }

  return types;
}

/**
 * Extracts enums from a SourceFile.
 */
export function extractEnums(sourceFile: SourceFile): EnumInfo[] {
  const enums: EnumInfo[] = [];

  for (const enumDecl of sourceFile.getEnums()) {
    enums.push({
      name: enumDecl.getName(),
      isExported: enumDecl.isExported(),
      members: enumDecl.getMembers().map((m) => ({
        name: m.getName(),
        value: m.getValue(),
      })),
      docstring: extractDocstring(enumDecl),
      lineStart: enumDecl.getStartLineNumber(),
      lineEnd: enumDecl.getEndLineNumber(),
    });
  }

  return enums;
}

/**
 * Extracts top-level AST variables and constants.
 */
export function extractAstVariables(sourceFile: SourceFile): VariableInfo[] {
  const variables: VariableInfo[] = [];

  for (const varStmt of sourceFile.getVariableStatements()) {
    const isExported = varStmt.isExported();
    const rawKind = varStmt.getDeclarationKind() as string;
    const declarationKind = (rawKind === 'const' || rawKind === 'let' || rawKind === 'var' ? rawKind : 'const') as 'const' | 'let' | 'var';
    const docstring = extractDocstring(varStmt);
    const lineStart = varStmt.getStartLineNumber();
    const lineEnd = varStmt.getEndLineNumber();

    for (const decl of varStmt.getDeclarations()) {
      // If it's a function or arrow function, it's already extracted in extractFunctions
      const initializer = decl.getInitializer();
      if (
        initializer &&
        (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
      ) {
        continue;
      }

      const name = decl.getName();
      const type = decl.getType().getText(decl);
      const declarationPreview = `${declarationKind} ${name}: ${type}`;

      variables.push({
        name,
        kind: declarationKind,
        type,
        isExported,
        declarationPreview,
        docstring,
        lineStart,
        lineEnd,
      });
    }
  }

  return variables;
}

/**
 * Extracts imports from a SourceFile.
 */
export function extractImports(sourceFile: SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const imp of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const defaultImport = imp.getDefaultImport()?.getText();
    const namespaceImport = imp.getNamespaceImport()?.getText();
    const isTypeOnly = imp.isTypeOnly();
    const line = imp.getStartLineNumber();

    const namedImports = imp.getNamedImports().map((ni: any) => ({
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
  }

  return imports;
}

/**
 * Extracts exports from a SourceFile.
 */
export function extractExports(sourceFile: SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

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

  return exports;
}

/**
 * Detects React / Next.js functional components in the SourceFile.
 */
export function extractComponents(sourceFile: SourceFile): ComponentInfo[] {
  const components: ComponentInfo[] = [];

  const checkAndAddComponent = (
    name: string,
    isExported: boolean,
    isDefault: boolean,
    node: any,
    doc?: string
  ) => {
    // React components start with uppercase letter
    if (!name || name[0] !== name[0]?.toUpperCase() || name[0] === '_') return;

    // Check if body returns JSX element or uses hooks
    const text = node.getText();
    const hasJsx = text.includes('<') && (text.includes('/>') || text.includes('</'));
    const hookMatches = text.match(/\b(use[A-Z][a-zA-Z0-9]*)\b/g) || [];
    const uniqueHooks: string[] = Array.from(new Set(hookMatches));

    if (hasJsx || uniqueHooks.length > 0) {
      const params = node.getParameters ? node.getParameters() : [];
      const propsType = params[0]?.getType()?.getText(node);

      components.push({
        name,
        isExported,
        isDefaultExport: isDefault,
        propsType: propsType !== 'any' ? propsType : undefined,
        hooksUsed: uniqueHooks,
        docstring: doc,
        lineStart: node.getStartLineNumber(),
        lineEnd: node.getEndLineNumber(),
      });
    }
  };

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name) {
      checkAndAddComponent(name, fn.isExported(), fn.isDefaultExport(), fn, extractDocstring(fn));
    }
  }

  for (const varStmt of sourceFile.getVariableStatements()) {
    const isExported = varStmt.isExported();
    for (const decl of varStmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        checkAndAddComponent(decl.getName(), isExported, false, init, extractDocstring(varStmt));
      }
    }
  }

  return components;
}

/**
 * Full structural AST inspection of a TypeScript/JavaScript source file.
 */
export function inspectSourceCode(code: string, filePath = 'snippet.ts'): FileSymbolInspection {
  const sourceFile = createVirtualSourceFile(code, filePath);
  const totalLines = sourceFile.getEndLineNumber();
  const language = detectLanguageFromPath(filePath);

  const inspection: FileSymbolInspection = {
    filePath,
    language,
    totalLines,
    imports: extractImports(sourceFile),
    exports: extractExports(sourceFile),
    functions: extractFunctions(sourceFile),
    classes: extractClasses(sourceFile),
    interfaces: extractInterfaces(sourceFile),
    types: extractTypes(sourceFile),
    enums: extractEnums(sourceFile),
    variables: extractAstVariables(sourceFile),
    components: extractComponents(sourceFile),
  };

  return inspection;
}

/**
 * Full structural AST inspection of a source file located on disk.
 */
export function inspectSourceFile(filePath: string, projectRoot?: string): FileSymbolInspection {
  const sourceFile = loadDiskSourceFile(filePath, projectRoot);
  const totalLines = sourceFile.getEndLineNumber();
  const language = detectLanguageFromPath(filePath);

  const inspection: FileSymbolInspection = {
    filePath,
    language,
    totalLines,
    imports: extractImports(sourceFile),
    exports: extractExports(sourceFile),
    functions: extractFunctions(sourceFile),
    classes: extractClasses(sourceFile),
    interfaces: extractInterfaces(sourceFile),
    types: extractTypes(sourceFile),
    enums: extractEnums(sourceFile),
    variables: extractAstVariables(sourceFile),
    components: extractComponents(sourceFile),
  };

  devInfo('AST_INSPECT_FILE', `Inspected "${filePath}" with ${inspection.functions.length} functions, ${inspection.classes.length} classes, ${inspection.interfaces.length} interfaces`);
  return inspection;
}

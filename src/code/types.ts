/**
 * Supported programming and markup languages in Hurdler code subsystem.
 */
export type CodeLanguage =
  | 'typescript'
  | 'typescriptreact'
  | 'javascript'
  | 'javascriptreact'
  | 'json'
  | 'css'
  | 'scss'
  | 'html'
  | 'markdown'
  | 'yaml'
  | 'python'
  | 'unknown';

// ==========================================
// ESLint Types
// ==========================================

export type LintSeverity = 'off' | 'warn' | 'error';

export interface LintMessage {
  ruleId: string | null;
  severity: 1 | 2; // 1 = warning, 2 = error
  severityText: 'warning' | 'error';
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fatal?: boolean;
  fix?: {
    range: [number, number];
    text: string;
  };
  suggestions?: Array<{
    desc: string;
    fix: {
      range: [number, number];
      text: string;
    };
  }>;
}

export interface LintResult {
  filePath?: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  messages: LintMessage[];
  output?: string;
  source?: string;
}

export interface LintTextOptions {
  filePath?: string;
  language?: CodeLanguage;
  fix?: boolean;
  ruleOverrides?: Record<string, unknown>;
  projectRoot?: string;
}

export interface LintFileOptions {
  fix?: boolean;
  projectRoot?: string;
  ruleOverrides?: Record<string, unknown>;
}

export interface LintFilesOptions {
  fix?: boolean;
  projectRoot?: string;
  concurrency?: number;
  ignorePatterns?: string[];
  ruleOverrides?: Record<string, unknown>;
}

export interface LintFixResult {
  filePath?: string;
  fixed: boolean;
  output: string;
  remainingErrors: LintMessage[];
  errorCount: number;
  warningCount: number;
}

// ==========================================
// Prettier Types
// ==========================================

export interface PrettifyOptions {
  parser?: string;
  filePath?: string;
  tabWidth?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  quoteProps?: 'as-needed' | 'consistent' | 'preserve';
  jsxSingleQuote?: boolean;
  trailingComma?: 'all' | 'es5' | 'none';
  bracketSpacing?: boolean;
  bracketSameLine?: boolean;
  arrowParens?: 'always' | 'avoid';
  printWidth?: number;
  endOfLine?: 'auto' | 'lf' | 'crlf' | 'cr';
  singleAttributePerLine?: boolean;
}

export interface PrettifyFileOptions {
  overwrite?: boolean;
  projectRoot?: string;
  options?: PrettifyOptions;
}

export interface PrettifyFilesOptions {
  overwrite?: boolean;
  projectRoot?: string;
  concurrency?: number;
  options?: PrettifyOptions;
}

export interface PrettifyFileResult {
  filePath: string;
  formatted: boolean;
  content: string;
  error?: string;
}

export interface PrettifyFilesResult {
  totalFiles: number;
  formattedFiles: string[];
  unchangedFiles: string[];
  failedFiles: Array<{ filePath: string; error: string }>;
  success: boolean;
}

// ==========================================
// AST & Symbol Extraction Types
// ==========================================

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  isGenerator: boolean;
  isExported: boolean;
  isDefaultExport: boolean;
  docstring?: string;
  lineStart: number;
  lineEnd: number;
  signature: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  isStatic?: boolean;
  isReadonly?: boolean;
  visibility?: 'public' | 'protected' | 'private';
  optional?: boolean;
  initializer?: string;
  docstring?: string;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  isStatic: boolean;
  visibility: 'public' | 'protected' | 'private';
  isAbstract?: boolean;
  docstring?: string;
  lineStart: number;
  lineEnd: number;
  signature: string;
}

export interface ClassInfo {
  name: string;
  isExported: boolean;
  isDefaultExport: boolean;
  isAbstract: boolean;
  extendsClass?: string;
  implementsInterfaces: string[];
  constructors: Array<{
    parameters: ParameterInfo[];
    visibility: 'public' | 'protected' | 'private';
    docstring?: string;
  }>;
  properties: PropertyInfo[];
  methods: MethodInfo[];
  docstring?: string;
  lineStart: number;
  lineEnd: number;
}

export interface InterfaceInfo {
  name: string;
  isExported: boolean;
  typeParameters: string[];
  extendsInterfaces: string[];
  properties: PropertyInfo[];
  methods: Array<{
    name: string;
    parameters: ParameterInfo[];
    returnType: string;
    docstring?: string;
  }>;
  docstring?: string;
  lineStart: number;
  lineEnd: number;
}

export interface TypeAliasInfo {
  name: string;
  isExported: boolean;
  typeParameters: string[];
  typeDefinition: string;
  docstring?: string;
  lineStart: number;
  lineEnd: number;
}

export interface EnumInfo {
  name: string;
  isExported: boolean;
  members: Array<{
    name: string;
    value?: string | number;
  }>;
  docstring?: string;
  lineStart: number;
  lineEnd: number;
}

export interface VariableInfo {
  name: string;
  kind: 'const' | 'let' | 'var';
  type: string;
  isExported: boolean;
  declarationPreview: string;
  docstring?: string;
  lineStart: number;
  lineEnd: number;
}

export interface ImportInfo {
  moduleSpecifier: string;
  defaultImport?: string;
  namedImports: Array<{
    name: string;
    alias?: string;
    isTypeOnly: boolean;
  }>;
  namespaceImport?: string;
  isTypeOnly: boolean;
  line: number;
}

export interface ExportInfo {
  name?: string;
  isDefault: boolean;
  isTypeOnly: boolean;
  moduleSpecifier?: string;
  declarationType?: string;
  line: number;
}

export interface ComponentInfo {
  name: string;
  isExported: boolean;
  isDefaultExport: boolean;
  propsType?: string;
  hooksUsed: string[];
  docstring?: string;
  lineStart: number;
  lineEnd: number;
}

export interface FileSymbolInspection {
  filePath?: string;
  language: CodeLanguage;
  totalLines: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeAliasInfo[];
  enums: EnumInfo[];
  variables: VariableInfo[];
  components: ComponentInfo[];
}

export interface OutlineOptions {
  detailLevel?: 'compact' | 'standard' | 'detailed';
  format?: 'markdown' | 'json';
  includeImports?: boolean;
  includeExports?: boolean;
  includePrivate?: boolean;
  includeDocstrings?: boolean;
}

export interface FileOutline {
  filePath: string;
  summary: string;
  symbolsCount: {
    functions: number;
    classes: number;
    interfaces: number;
    types: number;
    components: number;
  };
  markdown: string;
}

export interface CodebaseOutlineOptions {
  includeExtensions?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
  detailLevel?: 'compact' | 'standard' | 'detailed';
}

export interface CodebaseOutline {
  totalFiles: number;
  files: FileOutline[];
  summaryMarkdown: string;
}

export interface ASTDiffChange {
  kind: 'added' | 'removed' | 'modified';
  symbolType: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'component';
  name: string;
  oldSignature?: string;
  newSignature?: string;
  details?: string;
}

export interface ASTDiffSummary {
  filePath?: string;
  hasChanges: boolean;
  changes: ASTDiffChange[];
  explanationMarkdown: string;
}

// ==========================================
// Pipeline & Integrated Service Types
// ==========================================

export interface ValidateAndPrettifyOptions {
  fixLint?: boolean;
  projectRoot?: string;
  ruleOverrides?: Record<string, unknown>;
  prettierOptions?: PrettifyOptions;
}

export interface ValidateAndPrettifyResult {
  filePath?: string;
  isValid: boolean;
  formatted: boolean;
  output: string;
  errorCount: number;
  warningCount: number;
  messages: LintMessage[];
  llmDiagnosticSummary?: string;
}

export interface CodeContextOptions {
  filePath?: string;
  includeOutline?: boolean;
  includeSymbols?: boolean;
  includeDiffFrom?: string;
}

export interface CodeContextResult {
  filePath?: string;
  outlineMarkdown: string;
  inspection: FileSymbolInspection;
  astDiff?: ASTDiffSummary;
}

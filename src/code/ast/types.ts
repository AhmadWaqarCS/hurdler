export type {
  CodeLanguage,
  ParameterInfo,
  FunctionInfo,
  PropertyInfo,
  MethodInfo,
  ClassInfo,
  InterfaceInfo,
  TypeAliasInfo,
  EnumInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
  ComponentInfo,
  FileSymbolInspection,
  FileOutline,
  OutlineOptions,
  CodebaseOutline,
  CodebaseOutlineOptions,
  ASTDiffChange,
  ASTDiffSummary,
} from '../types.js';

export interface TreeSitterNodeInfo {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  childrenCount: number;
}

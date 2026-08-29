import Parser from 'tree-sitter';
import TypeScriptGrammar from 'tree-sitter-typescript';
import JavaScriptGrammar from 'tree-sitter-javascript';
import JSONGrammar from 'tree-sitter-json';
import { ASTError } from '../../errors.js';
import { devInfo } from '../../../core/dev-mode/index.js';

export type TreeSitterLanguage = 'typescript' | 'tsx' | 'javascript' | 'json';

const parserCache = new Map<string, Parser>();

/**
 * Returns a configured Tree-sitter parser for the specified language.
 */
export function getTreeSitterParser(language: TreeSitterLanguage | string): Parser {
  const normalized = language.toLowerCase();

  if (parserCache.has(normalized)) {
    return parserCache.get(normalized)!;
  }

  const parser = new Parser();

  try {
    switch (normalized) {
      case 'typescript':
      case 'ts':
        parser.setLanguage((TypeScriptGrammar as any).typescript);
        break;
      case 'tsx':
      case 'typescriptreact':
        parser.setLanguage((TypeScriptGrammar as any).tsx);
        break;
      case 'javascript':
      case 'js':
      case 'jsx':
      case 'javascriptreact':
        parser.setLanguage(JavaScriptGrammar as any);
        break;
      case 'json':
      case 'jsonc':
        parser.setLanguage(JSONGrammar as any);
        break;
      default:
        // Default to TypeScript
        parser.setLanguage((TypeScriptGrammar as any).typescript);
        break;
    }

    parserCache.set(normalized, parser);
    devInfo('TREE_SITTER_INIT', `Initialized Tree-sitter parser for "${normalized}"`);
    return parser;
  } catch (err: any) {
    throw new ASTError(`Failed to initialize Tree-sitter for language "${language}": ${err.message}`, {
      cause: err,
    });
  }
}

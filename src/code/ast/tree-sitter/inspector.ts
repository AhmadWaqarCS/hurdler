import type Parser from 'tree-sitter';
import { getTreeSitterParser, type TreeSitterLanguage } from './parser.js';
import type { TreeSitterNodeInfo } from '../types.js';
import { ASTError } from '../../errors.js';

/**
 * Parses code into a Tree-sitter AST.
 */
export function parseWithTreeSitter(code: string, language: TreeSitterLanguage | string = 'typescript'): Parser.Tree {
  try {
    const parser = getTreeSitterParser(language);
    return parser.parse(code);
  } catch (err: any) {
    throw new ASTError(`Tree-sitter parse error: ${err.message}`, { cause: err });
  }
}

/**
 * Generates an S-expression representation of the AST.
 */
export function generateSExpression(code: string, language: TreeSitterLanguage | string = 'typescript'): string {
  const tree = parseWithTreeSitter(code, language);
  return tree.rootNode.toString();
}

/**
 * Recursively traverses a syntax node and its children.
 */
export function traverseSyntaxTree(
  node: Parser.SyntaxNode,
  callback: (node: Parser.SyntaxNode) => boolean | void
): void {
  const shouldContinue = callback(node);
  if (shouldContinue === false) return;

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      traverseSyntaxTree(child, callback);
    }
  }
}

/**
 * Finds all syntax nodes matching specific node types.
 */
export function findNodesByType(
  rootNode: Parser.SyntaxNode,
  types: string[]
): Parser.SyntaxNode[] {
  const matching: Parser.SyntaxNode[] = [];
  const typeSet = new Set(types);

  traverseSyntaxTree(rootNode, (node) => {
    if (typeSet.has(node.type)) {
      matching.push(node);
    }
  });

  return matching;
}

/**
 * Returns structured metadata about a syntax node.
 */
export function getSyntaxNodeInfo(node: Parser.SyntaxNode): TreeSitterNodeInfo {
  return {
    type: node.type,
    text: node.text,
    startPosition: {
      row: node.startPosition.row + 1, // 1-indexed for user readability
      column: node.startPosition.column + 1,
    },
    endPosition: {
      row: node.endPosition.row + 1,
      column: node.endPosition.column + 1,
    },
    childrenCount: node.childCount,
  };
}

import Parser from 'tree-sitter';
import { getTreeSitterParser, type TreeSitterLanguage } from './parser.js';
import { parseWithTreeSitter } from './inspector.js';
import { ASTError } from '../../errors.js';

export interface TreeSitterMatch {
  patternIndex: number;
  captures: Array<{
    name: string;
    node: Parser.SyntaxNode;
    text: string;
  }>;
}

/**
 * Runs a Tree-sitter S-expression query against source code.
 */
export function executeTreeSitterQuery(
  code: string,
  queryString: string,
  language: TreeSitterLanguage | string = 'typescript'
): TreeSitterMatch[] {
  try {
    const parser = getTreeSitterParser(language);
    const langObj = (parser as any).getLanguage();
    const query = new (Parser as any).Query(langObj, queryString);
    const tree = parseWithTreeSitter(code, language);

    const matches = query.matches(tree.rootNode);

    return matches.map((m: any) => ({
      patternIndex: m.pattern,
      captures: m.captures.map((c: any) => ({
        name: c.name,
        node: c.node,
        text: c.node.text,
      })),
    }));
  } catch (err: any) {
    throw new ASTError(`Tree-sitter query execution failed: ${err.message}`, { cause: err });
  }
}

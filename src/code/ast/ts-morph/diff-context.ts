import type {
  ASTDiffSummary,
  ASTDiffChange,
  FunctionInfo,
  ClassInfo,
  InterfaceInfo,
  MethodInfo,
} from '../types.js';
import { ASTDiffOptionsSchema } from '../../schema.js';
import { inspectSourceCode } from './inspector.js';

/**
 * Compares two TypeScript/JavaScript source code versions at the AST symbol level.
 */
export function compareSourceAst(
  originalCode: string,
  modifiedCode: string,
  filePath = 'file.ts'
): ASTDiffSummary {
  ASTDiffOptionsSchema.parse({ originalCode, modifiedCode, filePath });

  const origInspection = inspectSourceCode(originalCode, filePath);
  const modInspection = inspectSourceCode(modifiedCode, filePath);

  const changes: ASTDiffChange[] = [];

  // Compare functions
  const origFns = new Map<string, FunctionInfo>(origInspection.functions.map((f: FunctionInfo) => [f.name, f]));
  const modFns = new Map<string, FunctionInfo>(modInspection.functions.map((f: FunctionInfo) => [f.name, f]));

  for (const [name, modFn] of modFns) {
    const origFn = origFns.get(name);
    if (!origFn) {
      changes.push({
        kind: 'added',
        symbolType: 'function',
        name,
        newSignature: modFn.signature,
        details: `Added new function: ${modFn.signature}`,
      });
    } else if (origFn.signature !== modFn.signature) {
      changes.push({
        kind: 'modified',
        symbolType: 'function',
        name,
        oldSignature: origFn.signature,
        newSignature: modFn.signature,
        details: `Signature changed from "${origFn.signature}" to "${modFn.signature}"`,
      });
    }
  }

  for (const [name, origFn] of origFns) {
    if (!modFns.has(name)) {
      changes.push({
        kind: 'removed',
        symbolType: 'function',
        name,
        oldSignature: origFn.signature,
        details: `Removed function: ${origFn.signature}`,
      });
    }
  }

  // Compare classes
  const origClasses = new Map<string, ClassInfo>(origInspection.classes.map((c: ClassInfo) => [c.name, c]));
  const modClasses = new Map<string, ClassInfo>(modInspection.classes.map((c: ClassInfo) => [c.name, c]));

  for (const [name, modCls] of modClasses) {
    const origCls = origClasses.get(name);
    if (!origCls) {
      changes.push({
        kind: 'added',
        symbolType: 'class',
        name,
        details: `Added new class: ${name} with ${modCls.methods.length} methods`,
      });
    } else {
      // Check methods in class
      const origMethods = new Map<string, MethodInfo>(origCls.methods.map((m: MethodInfo) => [m.name, m]));
      const modMethods = new Map<string, MethodInfo>(modCls.methods.map((m: MethodInfo) => [m.name, m]));

      for (const [mName, modM] of modMethods) {
        const origM = origMethods.get(mName);
        if (!origM) {
          changes.push({
            kind: 'added',
            symbolType: 'function',
            name: `${name}.${mName}`,
            newSignature: modM.signature,
            details: `Added method to class ${name}: ${modM.signature}`,
          });
        } else if (origM.signature !== modM.signature) {
          changes.push({
            kind: 'modified',
            symbolType: 'function',
            name: `${name}.${mName}`,
            oldSignature: origM.signature,
            newSignature: modM.signature,
            details: `Method signature changed: ${origM.signature} -> ${modM.signature}`,
          });
        }
      }

      for (const [mName, origM] of origMethods) {
        if (!modMethods.has(mName)) {
          changes.push({
            kind: 'removed',
            symbolType: 'function',
            name: `${name}.${mName}`,
            oldSignature: origM.signature,
            details: `Removed method from class ${name}: ${origM.signature}`,
          });
        }
      }
    }
  }

  for (const [name] of origClasses) {
    if (!modClasses.has(name)) {
      changes.push({
        kind: 'removed',
        symbolType: 'class',
        name,
        details: `Removed class: ${name}`,
      });
    }
  }

  // Compare interfaces
  const origInterfaces = new Map<string, InterfaceInfo>(origInspection.interfaces.map((i: InterfaceInfo) => [i.name, i]));
  const modInterfaces = new Map<string, InterfaceInfo>(modInspection.interfaces.map((i: InterfaceInfo) => [i.name, i]));

  for (const [name] of modInterfaces) {
    if (!origInterfaces.has(name)) {
      changes.push({
        kind: 'added',
        symbolType: 'interface',
        name,
        details: `Added interface ${name}`,
      });
    }
  }

  for (const [name] of origInterfaces) {
    if (!modInterfaces.has(name)) {
      changes.push({
        kind: 'removed',
        symbolType: 'interface',
        name,
        details: `Removed interface ${name}`,
      });
    }
  }

  const hasChanges = changes.length > 0;

  // Build markdown explanation
  const mdLines: string[] = [];
  if (!hasChanges) {
    mdLines.push('No AST symbol differences detected.');
  } else {
    mdLines.push(`### AST Symbol Changes in \`${filePath}\``);
    for (const ch of changes) {
      const icon = ch.kind === 'added' ? '🟢 [ADDED]' : ch.kind === 'modified' ? '🟡 [MODIFIED]' : '🔴 [REMOVED]';
      mdLines.push(`- ${icon} **${ch.symbolType}** \`${ch.name}\`: ${ch.details}`);
    }
  }

  return {
    filePath,
    hasChanges,
    changes,
    explanationMarkdown: mdLines.join('\n'),
  };
}

/**
 * Formats an ASTDiffSummary into a concise, high-signal Markdown block for LLM prompts.
 *
 * @param summary - ASTDiffSummary object from compareSourceAst.
 * @returns Markdown string formatted for LLM understanding.
 */
export function formatAstDiffForLLM(summary: ASTDiffSummary): string {
  if (!summary.hasChanges) {
    return '✓ No AST symbol modifications detected.';
  }

  const sections: string[] = [];
  sections.push(`### 🧬 AST Symbol Modifications in \`${summary.filePath ?? 'file'}\``);
  sections.push('The following functions, classes, interfaces, or types were altered:');

  for (const ch of summary.changes) {
    const icon = ch.kind === 'added' ? '🟢 [NEW]' : ch.kind === 'modified' ? '🟡 [CHANGED]' : '🔴 [DELETED]';
    sections.push(`\n${icon} **${ch.symbolType.toUpperCase()}** \`${ch.name}\``);
    if (ch.oldSignature) {
      sections.push(`  - *Before*: \`${ch.oldSignature}\``);
    }
    if (ch.newSignature) {
      sections.push(`  - *After*: \`${ch.newSignature}\``);
    }
    if (ch.details) {
      sections.push(`  - *Note*: ${ch.details}`);
    }
  }

  return sections.join('\n');
}


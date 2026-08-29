import path from 'node:path';
import type { FileCategory, SymbolCategory, SymbolMapEntry, SymbolKind } from './types.js';

const HTTP_METHOD_NAMES = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']);

/**
 * Classifies a file into a semantic category based on its file path, directives, and symbol structures.
 */
export function classifyFile(
  filePath: string,
  content: string,
  symbols: SymbolMapEntry[] = []
): FileCategory {
  const normalized = filePath.split(path.sep).join('/').toLowerCase();
  const basename = path.basename(normalized);

  // 1. Test Files
  if (
    basename.includes('.test.') ||
    basename.includes('.spec.') ||
    normalized.startsWith('test/') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/tests/')
  ) {
    return 'test';
  }

  // 2. Config Files
  if (
    basename.includes('.config.') ||
    basename.endsWith('.json') ||
    basename.startsWith('.env') ||
    basename === 'package.json' ||
    basename === 'tsconfig.json'
  ) {
    return 'config';
  }

  // 3. Server Action Directive ('use server')
  const trimmed = content.trim();
  const hasUseServer = trimmed.startsWith("'use server'") || trimmed.startsWith('"use server"');
  if (hasUseServer) {
    return 'server-action';
  }

  // 4. Next.js API Routes / App Router route handlers
  if (
    normalized.includes('app/') && (basename === 'route.ts' || basename === 'route.js') ||
    normalized.includes('pages/api/') ||
    symbols.some((s) => HTTP_METHOD_NAMES.has(s.name) && s.isExported)
  ) {
    return 'api-route';
  }

  // 5. React Components / Client Components / Pages / Layouts
  const hasUseClient = trimmed.startsWith("'use client'") || trimmed.startsWith('"use client"');
  const isNextPageOrLayout =
    normalized.includes('app/') &&
    (basename.startsWith('page.') ||
      basename.startsWith('layout.') ||
      basename.startsWith('loading.') ||
      basename.startsWith('error.') ||
      basename.startsWith('not-found.') ||
      basename.startsWith('template.'));

  const isComponentDir =
    normalized.includes('/components/') ||
    normalized.includes('/ui/') ||
    normalized.includes('/views/');

  const hasComponents = symbols.some((s) => s.kind === 'component' || s.category === 'component');

  if (hasUseClient || isNextPageOrLayout || isComponentDir || (hasComponents && normalized.endsWith('.tsx'))) {
    return 'component';
  }

  // 6. Schemas & Validations (Zod, etc.)
  if (
    basename.includes('.schema.') ||
    basename.includes('.validation.') ||
    normalized.includes('/schemas/') ||
    normalized.includes('/validations/') ||
    symbols.some((s) => s.category === 'schema' || s.name.endsWith('Schema'))
  ) {
    return 'schema';
  }

  // 7. Services
  if (
    basename.includes('.service.') ||
    normalized.includes('/services/') ||
    normalized.includes('/server/services/') ||
    symbols.some((s) => s.name.endsWith('Service') && s.kind === 'class')
  ) {
    return 'service';
  }

  // 8. Type Definitions & Interfaces
  if (
    basename.includes('.types.') ||
    basename.endsWith('.d.ts') ||
    normalized.includes('/types/') ||
    (symbols.length > 0 && symbols.every((s) => s.kind === 'interface' || s.kind === 'type' || s.kind === 'enum'))
  ) {
    return 'type-definition';
  }

  // 9. Common Utilities & Helpers
  if (
    basename.includes('.helper.') ||
    basename.includes('.util.') ||
    basename === 'helpers.ts' ||
    basename === 'utils.ts' ||
    normalized.includes('/common/') ||
    normalized.includes('/utils/') ||
    normalized.includes('/helpers/') ||
    normalized.includes('/lib/')
  ) {
    return 'common-util';
  }

  // 10. Module Wrappers & External Integrations
  if (
    normalized.includes('/integrations/') ||
    normalized.includes('/adapters/') ||
    normalized.includes('/clients/')
  ) {
    return 'module-wrapper';
  }

  // 11. Business Logic
  if (
    normalized.includes('/domain/') ||
    normalized.includes('/logic/') ||
    normalized.includes('/use-cases/') ||
    normalized.includes('/actions/') ||
    normalized.includes('/workflows/') ||
    normalized.includes('/core/')
  ) {
    return 'business-logic';
  }

  return 'unknown';
}

/**
 * Classifies an individual symbol into a semantic category.
 */
export function classifySymbol(
  name: string,
  kind: SymbolKind,
  fileCategory: FileCategory,
  filePath: string,
  options: {
    isExported?: boolean;
    signature?: string;
    bodyText?: string;
  } = {}
): SymbolCategory {
  // 1. React Hook
  if (/^use[A-Z]/.test(name)) {
    return 'hook';
  }

  // 2. React UI Component
  if (
    kind === 'component' ||
    (fileCategory === 'component' && /^[A-Z]/.test(name) && kind === 'function')
  ) {
    return 'component';
  }

  // 3. Server Action
  if (
    fileCategory === 'server-action' ||
    (options.bodyText && options.bodyText.includes("'use server'")) ||
    (options.bodyText && options.bodyText.includes('"use server"'))
  ) {
    return 'server-action';
  }

  // 4. API Route Handler (GET, POST, PUT, DELETE, PATCH, etc.)
  if (fileCategory === 'api-route' && HTTP_METHOD_NAMES.has(name) && options.isExported) {
    return 'api-handler';
  }

  // 5. Schema (Zod / Validation)
  if (
    name.endsWith('Schema') ||
    kind === 'schema' ||
    fileCategory === 'schema' ||
    (options.signature && options.signature.includes('ZodType'))
  ) {
    return 'schema';
  }

  // 6. Service Method
  if (kind === 'method' && fileCategory === 'service') {
    return 'service-method';
  }

  // 7. Type Definition
  if (kind === 'interface' || kind === 'type' || kind === 'enum') {
    return 'type-definition';
  }

  // 8. Class Definition
  if (kind === 'class') {
    return 'class-definition';
  }

  // 9. Function by File Category Context
  if (kind === 'function' || kind === 'method') {
    if (fileCategory === 'business-logic' || fileCategory === 'service') {
      return 'business-logic-function';
    }
    if (fileCategory === 'common-util') {
      return 'common-function';
    }
    if (fileCategory === 'module-wrapper') {
      return 'module-function';
    }
  }

  // 10. Variable
  if (kind === 'variable') {
    return 'variable';
  }

  // Default to common-function for remaining functions, variable otherwise
  return kind === 'function' ? 'common-function' : 'variable';
}

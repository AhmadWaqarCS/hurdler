import prettier from 'prettier';
import type { PrettifyOptions } from './types.js';

export const DEFAULT_PRETTIER_OPTIONS: PrettifyOptions = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',
  printWidth: 100,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
};

/**
 * Resolves Prettier options, merging built-in defaults with project config files (.prettierrc, etc.)
 */
export async function resolvePrettierOptions(
  filePath?: string,
  customOptions?: PrettifyOptions
): Promise<PrettifyOptions> {
  let fileConfig: PrettifyOptions | null = null;

  if (filePath) {
    try {
      fileConfig = (await prettier.resolveConfig(filePath)) as PrettifyOptions | null;
    } catch {
      fileConfig = null;
    }
  }

  return {
    ...DEFAULT_PRETTIER_OPTIONS,
    ...(fileConfig ?? {}),
    ...(customOptions ?? {}),
  };
}

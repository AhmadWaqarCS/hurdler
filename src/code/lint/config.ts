import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import type { ESLintConfigOptions } from './types.js';

/**
 * Creates a zero-config FlatConfig array for ESLint in Hurdler.
 * Configured for modern JavaScript, TypeScript, JSX, TSX, React, and Next.js projects.
 */
export function createDefaultLintConfig(options: ESLintConfigOptions = {}): any[] {
  const ruleOverrides = options.ruleOverrides ?? {};

  return [
    // Global ignore patterns
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.bundle.js',
      ],
    },
    // Base JS configuration
    {
      files: ['**/*.{js,mjs,cjs,jsx}'],
      rules: {
        ...js.configs.recommended.rules,
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-console': 'off',
        'no-constant-condition': ['warn', { checkLoops: false }],
        'no-undef': 'error',
        ...ruleOverrides,
      },
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
    // TypeScript & TSX configuration
    {
      files: ['**/*.{ts,mts,cts,tsx}'],
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      rules: {
        ...js.configs.recommended.rules,
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'off',
        'no-undef': 'off', // TypeScript compiler handles undefined variables
        'no-console': 'off',
        ...ruleOverrides,
      },
    },
  ];
}

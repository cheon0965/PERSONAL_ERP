import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended
});

const nextWebConfig = compat.extends('next/core-web-vitals').map((config) => ({
  ...config,
  files: ['apps/web/**/*.{js,jsx,ts,tsx}']
}));

const apiLayerBoundaryRestrictions = {
  patterns: [
    {
      group: [
        '@nestjs/*',
        '@prisma/client',
        'argon2',
        'cookie-parser',
        'express',
        'rxjs'
      ],
      message:
        'application/domain layer files must stay framework-free and depend on ports or pure logic instead.'
    },
    {
      group: ['**/common/prisma/*', '**/common/auth/jwt-config'],
      message:
        'application/domain layer files must not import infrastructure helpers directly.'
    }
  ]
};

const modulePublicApiRestrictions = {
  patterns: [
    {
      group: [
        '**/transactions/**',
        '!**/transactions/public',
        '**/recurring-rules/**',
        '!**/recurring-rules/public',
        '**/dashboard/**',
        '!**/dashboard/public',
        '**/forecast/**',
        '!**/forecast/public'
      ],
      message:
        'Cross-module imports for transactions/recurring-rules/dashboard/forecast must go through each module public.ts entrypoint.'
    }
  ]
};

const applicationAndDomainBoundaryRestrictions = {
  patterns: [
    ...modulePublicApiRestrictions.patterns,
    ...apiLayerBoundaryRestrictions.patterns
  ]
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.test-dist/**',
      '**/coverage/**',
      '**/*.d.ts'
    ]
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },
  {
    ...js.configs.recommended,
    files: ['**/*.cjs'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-restricted-imports': ['error', modulePublicApiRestrictions]
    }
  },
  {
    files: ['apps/api/src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        applicationAndDomainBoundaryRestrictions
      ]
    }
  },
  {
    files: ['apps/api/src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        applicationAndDomainBoundaryRestrictions
      ]
    }
  },
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  ...nextWebConfig
];

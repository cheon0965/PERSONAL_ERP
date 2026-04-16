import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nextWebConfig = {
  files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
  plugins: {
    '@next/next': nextPlugin
  },
  settings: {
    next: {
      rootDir: 'apps/web'
    }
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    '@next/next/no-html-link-for-pages': 'off'
  }
};

const modulePublicApiNames = [
  'collected-transactions',
  'recurring-rules',
  'dashboard',
  'forecast'
];

const apiModuleNames = fs
  .readdirSync(path.join(__dirname, 'apps/api/src/modules'), {
    withFileTypes: true
  })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const crossModuleRelativeImportPrefixes = [
  '../',
  '../../',
  '../../../',
  '../../../../',
  '../../../../../'
];

const createCrossModuleRelativePatterns = (moduleNames, suffixes) =>
  crossModuleRelativeImportPrefixes.flatMap((prefix) =>
    moduleNames.flatMap((moduleName) =>
      suffixes.map((suffix) => `${prefix}${moduleName}/${suffix}`)
    )
  );

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
      group: modulePublicApiNames.flatMap((moduleName) => [
        `**/${moduleName}/**`,
        `!**/${moduleName}/public`
      ]),
      message:
        'Cross-module imports for modules with a public.ts entrypoint must go through that public API.'
    }
  ]
};

const crossModuleInternalFileRestrictions = {
  patterns: [
    {
      group: createCrossModuleRelativePatterns(apiModuleNames, [
        '**/*.controller',
        '**/*.repository',
        '**/*.adapter',
        'infrastructure/**'
      ]),
      message:
        'Cross-module imports must not reach another module internal controller/repository/adapter/infrastructure files directly.'
    }
  ]
};

const applicationAndDomainBoundaryRestrictions = {
  patterns: [
    ...modulePublicApiRestrictions.patterns,
    ...crossModuleInternalFileRestrictions.patterns,
    ...apiLayerBoundaryRestrictions.patterns
  ]
};

const apiModuleBoundaryRestrictions = {
  patterns: [
    ...modulePublicApiRestrictions.patterns,
    ...crossModuleInternalFileRestrictions.patterns
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
      'no-restricted-imports': ['error', apiModuleBoundaryRestrictions]
    }
  },
  // auth/admin use-cases use NestJS + Prisma directly (thin Hexagonal pattern)
  // without full port/adapter separation — exempt from framework-free restriction.
  {
    files: [
      'apps/api/src/modules/auth/application/**/*.ts',
      'apps/api/src/modules/admin/application/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': ['error', modulePublicApiRestrictions]
    }
  },
  {
    files: ['apps/api/src/**/application/**/*.ts'],
    ignores: [
      'apps/api/src/modules/auth/application/**/*.ts',
      'apps/api/src/modules/admin/application/**/*.ts'
    ],
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
  nextWebConfig
];

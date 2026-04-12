import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const nextRules = {
  ...nextPlugin.configs.recommended.rules,
  ...nextPlugin.configs['core-web-vitals'].rules,
  '@next/next/no-html-link-for-pages': 'off'
};

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.test-dist/**',
      'coverage/**',
      'test-results/**',
      'next-env.d.ts'
    ]
  },
  {
    files: ['eslint.config.mjs'],
    plugins: {
      '@next/next': nextPlugin
    },
    settings: {
      next: {
        rootDir: '.'
      }
    }
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
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
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    settings: {
      next: {
        rootDir: '.'
      }
    },
    rules: nextRules
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
  }
];

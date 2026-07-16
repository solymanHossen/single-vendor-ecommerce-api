// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      // 'module' aligns with tsconfig "module": "nodenext" and enables
      // import/export syntax awareness in the parser.
      sourceType: 'module',
      parserOptions: {
        projectService: {
          // e2e specs live under test/ with their own tsconfig.json (they're
          // deliberately excluded from the root tsconfig's `include`, which
          // scopes to `src/**/*` for the actual build). Without this, the
          // project service can't find a project owning them and fails to
          // parse the files at all.
          allowDefaultProject: ['test/*.e2e-spec.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ── TypeScript safety — all enforced as errors ───────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-inferrable-types': 'off',

      // ── General best practice ────────────────────────────────────────────────
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      'no-duplicate-imports': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],

      // ── Prettier ─────────────────────────────────────────────────────────────
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Test files — relax unsafe rules; any-casts are acceptable in mocks/spies.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Seed scripts run outside the NestJS DI context — console output is the
    // only available logging mechanism, so we permit all console methods here.
    files: ['prisma/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);

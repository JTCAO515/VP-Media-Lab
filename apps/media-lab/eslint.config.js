import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'electron.vite.config.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
);

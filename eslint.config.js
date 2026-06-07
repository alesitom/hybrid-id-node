import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // Config files live outside the typed `src`/`test`/`bin` project.
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);

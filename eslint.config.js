import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler is not enabled. RHF's watch API is intentionally used.
      'react-hooks/incompatible-library': 'off',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  { files: ['**/*.config.js'], languageOptions: { globals: globals.node } },
)

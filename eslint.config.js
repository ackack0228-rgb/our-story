import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'server/data', 'supabase/.temp'] },
  {
    files: ['server/**/*.js', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Flags any setState call inside a useEffect body, including the ordinary "sync local
      // state from an async data source on load" pattern used deliberately in a few hooks here
      // (e.g. RoomProvider's phase transitions, MoodTracker's today-value hydration) — too
      // aggressive for this codebase's style, not a real bug.
      'react-hooks/set-state-in-effect': 'off',
    },
  }
)

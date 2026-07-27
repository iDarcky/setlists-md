import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Injected by Vite at build time — see `define` in vite.config.js.
        __APP_VERSION__: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Uppercase-prefixed names are component/icon identifiers — this config
      // has no JSX-usage detection, so an `Icon` used only as <Icon /> reads as
      // unused. Ignore them for both vars and (destructured) args, matching the
      // long-standing varsIgnorePattern convention.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],

      // Keep the feature-folder layout from decaying. The old src/components/
      // was a flat dump of 63 files beside half-populated subfolders precisely
      // because the convention lived in a doc and nothing enforced it.
      //
      //   - reaching UP out of your own folder ('../') must go through '@/',
      //     so moving a file never rewrites unrelated imports;
      //   - '@/components/...' is gone for good — code belongs to a feature
      //     (src/features/<x>), the design system (src/ui), or the shell
      //     (src/app).
      //
      // Same-folder siblings ('./x') stay relative and are unaffected.
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../*'],
            message:
              "Reach out of your own folder with the '@/' alias, not '../'. " +
              "Same-folder siblings ('./x') are fine. See CLAUDE.md § Project Structure.",
          },
          {
            group: ['@/components/*', '@/components'],
            message:
              'src/components/ no longer exists. Use @/features/<feature>/, @/ui/ or @/app/. ' +
              'See docs/COMPONENTS.md for which component owns what.',
          },
        ],
      }],
    },
  },
  {
    // The webpush interop test deliberately imports the edge function's real
    // implementation, which lives outside src/ and so has no '@/' path.
    files: ['src/__tests__/webpush-crypto.test.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
])

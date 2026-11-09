import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Design tokens only (spec 0007, AC-21): colors live in src/index.css, never in components.
// The theme turns Tailwind's palette off, so a palette class (bg-blue-500) is an unknown class.
const RAW_COLOR = '/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/'
const noRawColors = [
  'error',
  { selector: `Literal[value=${RAW_COLOR}]`, message: 'Raw color value. Use a design token (bg-primary, var(--primary)).' },
  { selector: `TemplateElement[value.raw=${RAW_COLOR}]`, message: 'Raw color value. Use a design token (bg-primary, var(--primary)).' },
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': { entryPoint: 'src/index.css' },
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        { restrict: [{ pattern: '^.*-\\[.+\\]$', message: 'Arbitrary value. Use a Tailwind scale step or a token.' }] },
      ],
      'no-restricted-syntax': noRawColors,
    },
  },
  {
    // shadcn files export their variant helpers next to the component.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])

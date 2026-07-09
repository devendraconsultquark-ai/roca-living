import { defineConfig } from 'eslint/config'
import { TOKEN_LOCK_RULES, designSystemPlugin } from './eslint.config.js'

/**
 * Minimal, purpose-built config used by the pre-commit design-system ratchet
 * (see /.githooks/pre-commit). It enforces ONLY the token lock (error) and the
 * component nudges (warn) — deliberately decoupled from general lint hygiene
 * (unused vars, hook rules, etc.) so pre-existing repo debt can never block a
 * commit. The one thing it guarantees: no new off-token colour or font-size can
 * be committed into a changed client file. Rule definitions are imported from
 * eslint.config.js so there is a single source of truth.
 */
export default defineConfig([
  {
    files: ['**/*.{js,jsx}'],
    plugins: { ds: designSystemPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': ['error', ...TOKEN_LOCK_RULES],
    },
  },
  {
    files: ['**/pages/**/*.{js,jsx}'],
    rules: {
      'ds/prefer-components': 'warn',
    },
  },
])

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * ── Design-system guardrails ──────────────────────────────────────────────
 *
 * TIER A (ERROR, all files): lock the token vocabulary. No arbitrary hex
 * colours and no arbitrary font-sizes in className strings — every colour and
 * text size MUST come from the @theme tokens in src/index.css. This is the
 * permanent consistency guarantee: it holds even when someone hand-rolls markup
 * instead of using a component, and it works against humans and AI alike.
 * (The codebase is already token-clean, so this blocks *new* drift, not old code.)
 *
 * TIER B (WARN, pages only): nudge page authors toward the shared primitives
 * (<Button>/<Tabs>/<Chip>/<Toggle>/<Input>) instead of re-implementing them.
 * Warn — not error — because a few raw controls are legitimately bespoke, and
 * public/marketing pages have their own design context. It surfaces the choice
 * without blocking the commit. Implemented as a separate rule id (ds/*) so it
 * never collides with / downgrades the Tier-A `no-restricted-syntax` severity.
 */
export const TOKEN_LOCK_RULES = [
  {
    selector: "Literal[value=/-\\[#[0-9a-fA-F]/]",
    message:
      'Design-system: use a token colour class (e.g. bg-brand-primary, text-status-info, bg-ink) instead of an arbitrary hex value. Add a token in src/index.css @theme if one is missing.',
  },
  {
    selector: "TemplateElement[value.raw=/-\\[#[0-9a-fA-F]/]",
    message:
      'Design-system: use a token colour class instead of an arbitrary hex value. Add a token in src/index.css @theme if one is missing.',
  },
  {
    selector: "Literal[value=/\\btext-\\[[0-9.]/]",
    message:
      'Design-system: use a type-scale class (text-2xs / text-xs / text-sm / text-base / text-*-portal) instead of an arbitrary text size.',
  },
  {
    selector: "TemplateElement[value.raw=/\\btext-\\[[0-9.]/]",
    message:
      'Design-system: use a type-scale class instead of an arbitrary text size.',
  },
]

// Inline plugin: warn when a page hand-rolls a raw control that a shared
// primitive already covers. No external dependency required.
const RAW_ELEMENT_HINTS = {
  button:
    'a shared component — <Button> (CTA/action), <Tabs> (sub-tab bar), <Chip> (filter pill) or <Toggle> (switch)',
  input: 'the shared <Input> component (keeps padding / radius / type consistent)',
}

export const designSystemPlugin = {
  rules: {
    'prefer-components': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Prefer shared UI primitives over raw elements in page components.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            const name = node.name && node.name.name
            const hint = RAW_ELEMENT_HINTS[name]
            if (hint) {
              context.report({
                node,
                message: `Design-system: prefer ${hint} instead of a raw <${name}>. Raw elements are allowed for genuinely bespoke controls — if this is one, ignore this hint.`,
              })
            }
          },
        }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { ds: designSystemPlugin },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // TIER A — hard block on token drift (colours + font sizes), everywhere.
      'no-restricted-syntax': ['error', ...TOKEN_LOCK_RULES],
    },
  },
  {
    // TIER B — page-level component nudges (warn). Scoped with **/pages/** so it
    // matches whether ESLint runs from client/ or the repo root (lint-staged).
    // The UI primitive library (components/UI) is excluded by scope — it is
    // allowed to build on raw elements. This object adds a *different* rule id,
    // so Tier A stays ERROR on pages (no severity collision).
    files: ['**/pages/**/*.{js,jsx}'],
    rules: {
      'ds/prefer-components': 'warn',
    },
  },
])

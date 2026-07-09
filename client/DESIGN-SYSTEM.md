# Client (Landlord) portal — design system & guardrails

The portal UI is token-driven. Consistency is **enforced**, not just documented, so
neither a new developer nor an AI can quietly drift off the system.

## 1. Tokens are the only source of colour & size

All colours and text sizes come from the `@theme` tokens in [`src/index.css`](src/index.css):

- **Colour**: `bg-brand-primary`, `text-status-info`, `border-card-border`, `bg-ink`, … —
  never a raw hex (`bg-[#1a1a1a]`). If a colour is missing, **add a token** in `index.css`.
- **Type scale**: `text-2xs` (12) · `text-xs` (13) · `text-sm` (14) · `text-base` (16),
  or the explicit `text-*-portal` aliases — never an arbitrary `text-[15px]`.
- **Radius**: one scale — `rounded-card` (6px) for cards/inputs/pills; `rounded-md/lg`
  also resolve to 6px. Larger surfaces use `rounded-xl/2xl/3xl`.

Arbitrary **spacing/sizing** (`w-[240px]`, `-mb-[5px]`) is fine — only colour and font-size
are locked.

## 2. Use the shared primitives instead of re-implementing controls

| Need | Component | Not this |
|------|-----------|----------|
| Action / CTA button | `<Button variant=… />` | raw `<button>` |
| Sub-tab bar (underline) | `<Tabs tabs active onChange />` | hand-rolled tab `<button>` row |
| Filter / choice pill | `<Chip active onClick>` | pill `<button>` |
| On/off switch | `<Toggle checked onChange />` | per-page `ToggleSwitch` |
| Text field | `<Input … />` | raw `<input>` |

All live in [`src/components/UI/`](src/components/UI/). Building a new control that isn't
here? Add it to `components/UI` (it may use raw elements — the primitive library is the one
place that's allowed to), then use it from pages.

## 3. How it's enforced

- **ESLint — token lock (`error`, all files):** [`eslint.config.js`](eslint.config.js) fails
  the lint on any arbitrary hex colour or `text-[..]` size. Shows live in your editor.
- **ESLint — component nudge (`warn`, pages only):** flags raw `<button>`/`<input>` in
  `src/pages/**` and points at the primitive above. Warning, not error — a few controls are
  legitimately bespoke, and public/marketing pages have their own context.
- **Pre-commit ratchet:** [`/.githooks/pre-commit`](../.githooks/pre-commit) runs the token
  lock on **changed** client files only, via [`eslint.designsystem.config.js`](eslint.designsystem.config.js)
  (design-system rules only, so unrelated lint debt never blocks you).

Activate the hook once per clone:

```sh
git config core.hooksPath .githooks
```

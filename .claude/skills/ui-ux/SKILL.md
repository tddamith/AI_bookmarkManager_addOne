---
name: ui-ux
description: UI/UX guidelines for the AI Bookmark Manager browser add-on (popup, options page, side panel). Use when designing, building or reviewing any extension screen or component.
---

# AI Bookmark Manager – UI/UX Skill

Apply these rules to every screen in `extension/` (popup, options, future side panel/new-tab).

## Principles
1. **Fast to save, fast to find.** Saving a page ≤ 1 click; search is focused/visible on open.
2. **Quiet AI.** AI suggestions (tags, folders, summaries) are shown as editable suggestions, never auto-applied without undo.
3. **Compact but calm.** Popup width 360px (max 600px), height ≤ 600px; one primary action per view.
4. **Follow the Stash style.** Source of truth: the Product & Design Spec (https://claude.ai/artifact/KbdGEAbDn5aMz2N6rS3pEi) and design canvas (https://claude.ai/artifact/TBtpNV4dhQLMPF2i5wZiof). One flat background per screen, black text, 1px black lines, black pill buttons; popup is 380×600.

## Design tokens
Use only tokens from `extension/styles/tokens.css`: acid lime `#D4FA1E` (Save, Sign up, AI suggestions), sky `#A6C3DD` (Tidy, Insights), tan `#C9B597` (For you), gray `#CFCFCC` (Plans), off-white `#F4F4F1` (Home, Library, Log in), ink `#111111`. Font: Inter Tight, large light headlines (32–40px, weight 400, tight tracking), small labels written as "Email —". Icons: solid black shapes with a thin cut line.

## Components
- **Buttons:** see the Buttons section below.
- **Search:** pill field with action button (see Forms), labeled, filters as you type (debounce ~150ms).
- **List items:** title (1 line, ellipsis) + muted domain; hover/focus state; full row clickable.
- **Tags:** pill chips, removable via keyboard; AI-suggested tags have a dashed border until accepted.
- **Empty / loading / error states** are required for every list: friendly one-line text + next action.

## Buttons (every button must follow this)
Source: "Buttons — types, sizes & states" and "Buttons — all states" boards in the design canvas. Styles: `extension/styles/buttons.css`. Fully rounded pills, black by default, **one primary per screen**. Inter Tight 500, sentence case, verb first ("Save", "Fix 92 items", "Pay with PayPal"). Real `<button>` / `<a href>` only.
| Type | Class | Use |
|------|-------|-----|
| 01 Primary | `.btn .solid` | Main action: Save, Log in, Fix |
| 02 Accent | `.btn .accent` (lime, black outline) | Money and upgrade moments only |
| 03 Secondary | `.btn .outline` | Second choice beside a primary |
| 04 Text link | `.link-btn` / `<a>` + ↗ | Quiet moves: Skip, Not now, See all |
| 05 Icon | `.btn .icon-round` | 44px round; **always `aria-label`** |
| 06 Split | `.split` | Action + a side option (Fix 92 items + preview) |
| 07 Segmented | `aria-pressed` pair in a bordered group | Two to three choices (Monthly / Yearly) |
| 08 Chip / tab | `.chip-btn[aria-pressed]` | Filters and the tab bar |
- **Sizes:** Large `.lg` 52px/16px (full-width CTAs) · Medium 44px/14px (default) · Small `.sm` 32px/12px (inline rows; keep a 44px tap area).
- **States (board "Buttons — all states"):** every one of the 8 types has all five: **Default · Hover · Focus · Loading · Disabled**. Pressed is only a brief `scale(.97)`, not a documented state. Implemented in `buttons.css`; never restyle a state by hand.
| State | How | Look |
|-------|-----|------|
| Hover | `:hover` (not when disabled/busy) | Primary & icon: `#333`. Accent: `#C2E80C`. Secondary & chip: white fill. Text link: underline, 4px offset. Segmented: unselected segment `#E3E3DE`. |
| Focus | `:focus-visible` | 2px black ring 3px out (`0 0 0 3px bg, 0 0 0 5px ink`); on lime/sky/gray/tan screens the inner gap takes the screen colour so the ring still shows. Segmented: 2px/2px ring on the segment. Text link: 2px ring, 8px radius, 4×8 padding. |
| Loading | `aria-busy="true"` (use `withBusy(btn, fn)` from `forms.js`) | Label hidden, **width kept**, three dots: lime/white on primary & icon, black on accent & secondary. Text link and chip show a spinner **with the label kept**. Segmented: dots in the selected segment. Split: only the main button loads; the side option dims to 40%. Clicks and Enter are ignored while busy. |
| Disabled | real `disabled` attribute | Primary & icon (filled): `#D9D9D5` fill, `#8A8A8A` text. Accent / secondary / outline icon / chip: dashed `#A3A3A3` outline, grey text (accent adds `#ECECE8` fill). Text link: `#A3A3A3`. Segmented: dashed container, selected segment `#D9D9D5`. No hover, `cursor: not-allowed`. |
- **Rules:** while one button in a group is busy, disable its siblings (e.g. Pay with PayPal loading → card button disabled). Reduced-motion users get a slower spinner. Don't show Loading for < ~300 ms actions unless the result is delayed.
- **On colour:** on lime, sky and tan keep primary black + outline secondary; on a black surface use lime primary + white outline (`body.ink`).
- **Copy:** never "Click here" / "Submit"; name the result. Destructive actions say what is lost and offer Undo.

## Side panel (how Stash opens)
Stash lives in the browser **side panel** (`chrome.sidePanel`), like Claude in Chrome. One click on the toolbar icon opens it (`setPanelBehavior({ openPanelOnActionClick: true })`); `Ctrl/Cmd+Shift+Y` also opens it. The browser provides the header, close (X) and pin; click the icon or X to close. It stays open across tab switches.
- **Layout:** full rules in `docs/layout.md` (header, body spacing, footer, per-screen anatomy). Log in / Sign up follow the side-panel boards: header with Stash mark + Close, 28px body padding, 16px rhythm, footer pinned to the bottom.
- **Width:** fluid, designed for 360–500px (min 320, content max 520 centered). Never hard-code 380px; use `min-height: 100vh` for full-height screens and keep CTAs at the bottom with `margin-top: auto`.
- **Access badge:** show "Has access to <host>" (pill with lime dot) when the current tab is http(s); hide it on browser pages. Update on tab switch/navigation.
- **Position/size** are controlled by the browser (dock side in Chrome settings → Appearance). Don't build custom drag/minimize.
- Firefox has no `sidePanel`; use `sidebar_action` there if Firefox support is needed.

## Forms (every form must follow this)
Source: "Text fields" and "Text fields — all states" boards in the design canvas. Styles: `extension/styles/forms.css`; behaviour: `extension/popup/forms.js`. Never hand-style an input.
- **Shapes:** underline `.field` (log in, sign up, labelled data) and pill `.pill-field` (short values, search, folders). Variants: search with round action button (`.has-action`), leading icon (`.has-icon`), password with show/hide (`data-toggle-password`), text area, tags (`.chip`; black = yours, lime `.ai` = AI suggested), select.
- **Size/type:** field ≥ 44px tall, input text 16px (pill 15px), labels 12px written as `Email —`. Every input has a visible `<label for>`, or a `.sr` label for pill fields.
- **States (boards "Text fields" and "Text fields — all states"):** every type (underline, pill, search + action, leading icon, password, text area, tags, select) has Default · Hover · Focus · Loading · Disabled, plus Filled and Error.
| State | Rule |
|-------|------|
| Default | Underline: 1px black line. Pill / text area / select: 1.5px black border (text area radius 14px). Placeholder `#6B6B6B`, label `#3A3A3A`. |
| Hover | Underline: line thickens to 1.5px, label turns black. Pill-style: fills white. |
| Focus | Underline: 2px line + lime underglow (`0 4px 0 -2px lime`), label black and 500. Pill-style: 2px black border + 4px lime glow (white glow on lime screens). |
| Filled | Same as default, with the value in black. Never show placeholder styling on a value. |
| Error | `#C92A2A` 2px line/border, label red, icon + fix-it message below (`.err`). |
| Loading | Spinner at the end of the field; AI work (summary, tag suggestions, folder lookup) shows three **lime** dots instead (lime chip with dots in tag fields; dots inside a text area). Placeholder text becomes the status ("Finding folder"). Field stays readable; block duplicate submits. |
| Disabled | Dashed `#A3A3A3` line/border, `#ECECE8` fill (pill-style), grey text; label `#8A8A8A`; chips go `#D9D9D5`; the search action button turns `#D9D9D5`. No hover or focus. Use the real `disabled` attribute. |
- **Validation:** call `validate([{input, ok, message}])`; it shows the inline `.err` (linked by `aria-describedby`, `aria-invalid`), focuses the first bad field and clears the error as the user types. Messages say how to fix it ("Enter a full email"), never just "Invalid". Form-level and info messages go in `.status` (`role="status"`).
- **Always:** correct `type` and `autocomplete`, `novalidate` + our own messages, submit button disabled while working, Terms-style checkboxes use `accent-color` ink with a `<label for>`.

## Accessibility (WCAG 2.1 AA)
- Contrast ≥ 4.5:1 text, 3:1 UI; verify in both themes.
- Everything keyboard reachable, visible `:focus-visible` ring, logical tab order, `Esc` closes dialogs.
- Touch/click targets ≥ 44px (small buttons get a 44px tap area); icon-only buttons need `aria-label`.
- Use `aria-live="polite"` for result lists and save confirmations; never rely on color alone.

## Interaction & copy
- Confirmations are inline toasts (≤ 3s) with Undo, not modal alerts.
- Copy: sentence case, verb-first buttons ("Save page", "Create folder"), plain error messages with a fix ("Couldn't reach AI service. Retry").
- Privacy cues: say clearly when page content is sent to an AI provider; make it opt-in.

## Implementation rules
- Plain HTML/CSS/JS (MV3, no inline scripts — CSP). Use `const api = globalThis.browser ?? globalThis.chrome` for cross-browser.
- Build DOM with `textContent`/`createElement`, never `innerHTML` with bookmark data.
- Keep popup render < 100ms for 1,000 bookmarks (virtualize/limit lists).

## Bookmark links
Every place a bookmark/page link is shown (Library, Home pinned, For you, Insights, the current-page card) shows the **site icon** (`favicon()` in `favicon.js`, `.fav` tile) at the left of the title. Fallback is a letter chip, not a folder icon. See `docs/layout.md` §7.

## Review checklist
- [ ] Tokens only
- [ ] Keyboard-only flow works
- [ ] Empty/loading/error states present
- [ ] One primary button per screen; buttons use `buttons.css` types/sizes/states
- [ ] Bookmark links show the site icon
- [ ] Forms use `forms.css` + `validate()`
- [ ] AI actions are opt-in, editable, undoable
- [ ] Works in Chrome and Firefox

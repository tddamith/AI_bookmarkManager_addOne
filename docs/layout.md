# Stash — Side Panel Layout

Layout rules for every screen in the browser side panel. Source: design canvas boards **Side panel · Home / For you / Log in / Sign up** ([canvas](https://claude.ai/artifact/TBtpNV4dhQLMPF2i5wZiof)). Visual tokens, buttons and fields: `.claude/skills/ui-ux/SKILL.md`. Code: `extension/popup/panel.css`, `panel.js`.

## 1. The shell
The panel is docked by the browser on the right of the page (the user can resize it). Stash fills it top to bottom; the page stays visible on the left.

```
┌ browser toolbar ─────────── [Stash icon] ┐
│                         │ ┌ STASH      ✕ ┤  ← panel header (14px 18px, 1px black line below)
│   web page              │ ├──────────────┤
│                         │ │ panel body   │  ← padding 28px, flex column, gap 16px
│                         │ │   …          │
│                         │ │ ──────────── │  ← footer: margin-top:auto, 1px line, padding-top 16px
│                         │ │ footer text  │
└─────────────────────────┴─┴──────────────┘
```
- **Width:** fluid. Design width **400px**; must work 320–500px. Body content max-width 520px, centered if the panel is wider. Never hard-code a width.
- **Height:** `min-height: 100vh`. The panel is a column: header (fixed) → body (`flex: 1`) → optional footer pinned to the bottom with `margin-top: auto`. Body scrolls inside the panel; the header stays.
- **Background:** one flat colour per screen — off-white `#F4F4F1` (Log in, Home, Library), lime `#D4FA1E` (Sign up, Save), sky `#A6C3DD` (Tidy, Insights), tan `#C9B597` (For you), gray `#CFCFCC` (Plans). Set as `body.<colour>`; the header and footer lines stay 1px black.
- **Edge:** 1px black line between the page and the panel (the browser draws it).

## 2. Panel header
Height ≈ 54px (padding 14px 18px), `border-bottom: 1px solid #111`.
- **Left:** Stash mark (26px black circle, lime bookmark) + `STASH` (12px, 600, tracking .06em).
- **Right (logged out):** Close (32px round, X icon, `aria-label="Close side panel"`, 44px hit area).
- **Right (logged in):** `Popup` outline pill (32px) · Account avatar (32px tan circle, initial) · Close.
- Close calls `chrome.sidePanel.close()` (falls back to `window.close()`).

## 3. Body spacing
| Item | Value |
|------|-------|
| Body padding | 28px 28px 24px (logged-in screens: 14px 18px) |
| Vertical rhythm | `gap: 16px` between blocks |
| Headline | 40px / 1.02, weight 400, tracking −0.035em, 6px extra top margin |
| Lead text | 15px / 1.5, `#3A3A3A` |
| Fields | underline `.field`, 16px gap |
| Primary button | Large (52px), full width, last in the form |
| Footer | 1px top line, 16px padding, 14px text, small print 12px |

## 4. Screens
### Log in (off-white)
1. Header · 2. Diagonal accent lines (top-right, 140×64) · 3. Bookmark mark (56×68) · 4. **Welcome back** · 5. Lead: "Log in to see your bookmarks next to every page." · 6. **Continue with Google** (secondary) · 7. `or` divider · 8. Email, Password (+ Forgot?, show/hide) · 9. ☑ Keep me logged in on this browser · 10. **Log in** (primary) · 11. Footer: "New to Stash? Create an account" + "Your bookmarks sync across Chrome, Edge and Brave."

"Keep me logged in" checked → session in `storage.local`; unchecked → `storage.session` (ends when the browser closes).

### Sign up (lime)
1. Header · 2. **Ready to tidy your bookmarks?** (max-width 340px) · 3. Three check bullets: AI files every save for you · One-tap tidy-up · Free forever, no card needed · 4. **Sign up with Google** · 5. `or` · 6. Name, Email, Password · 7. ☐ Terms and Privacy Policy · 8. **Create account** → Plans · 9. Footer: "Have an account? Log in".

### Home (off-white)
Header (Popup · avatar · close) → search pill "Ask your bookmarks…" with round search button → **4-tab segmented bar at the top**: Home · Library · Tidy · For you (36px tabs in a 1.5px pill, active = black) → body (padding 16px 18px 18px, gap 16px): lime **On this page** card (title, folder, tags, *Save page* + *Read later*) → stats strip (saved / this week / read later) → **AI suggestions** list (Merge, Move; See all) → sky **Most visited this week** bar chart (Insights link).

> Status: implemented (`home.html`). "On this page" saves into the folder you already use for that site (else a *Stash* folder); *Read later* uses a *Read later* folder. The chart shows share of saves per folder until visit tracking (Insights) exists.

### Plans, Checkout, You're Pro (gray / white / sky)
Checked against the boards *Side panel · Plans / Pay with PayPal / You're Pro*. Same shell as Log in and Sign up (header → `.panel-body` padding 24px 28px, gap 16px).
- **Plans (gray):** header **Back** (→ Home) + white-circle mark + Close. **Choose a plan** (36px) → Monthly / *Yearly · save [X]%* segmented control → **Free** card (off-white): "Free —  $0", "Unlimited bookmarks · [N] AI suggestions a month · 1 device", dashed **Current plan** badge (free accounts) → **Pro** card (lime): "Pro — [PRICE] / year", four ruled perks (34px rows), and the **Upgrade to Pro** Large primary *inside* the card (becomes a dashed, disabled **Current plan** for Pro accounts) → centered footer "Cancel any time. Secure payment with PayPal." No *Not now* link: Back replaces it, and new accounts reach onboarding because Home redirects them to Welcome.
- **Checkout (white):** header **Back** (→ Plans) + dark mark + Close. "Stash Pro — Yearly plan" (12px) → **Checkout** (40px) → ruled rows: plan + price (44px), Tax (14px, grey), **Total today** (58px, 28px amount) → "Renews on [DATE]. Cancel any time." → promo pill with a paper-plane round button → pinned: **Pay with PayPal** (accent, 52px), **Debit or credit card** (secondary, 48px), "Payment handled securely by PayPal".
- **You're Pro (sky):** white-circle mark + Close (no Back). 110px check ring → **You're Pro now** (44px) → "Payment received. Unlimited AI, tidy-up and sync are on." → ruled rows (40px): *Plan — Pro · Yearly*, *Paid with — PayPal*, *Receipt — Sent to your email* → pinned **Run your first tidy-up** (→ Tidy) and text link **Back to Stash** (→ Home).

### Save page (lime) — `save.html`
Opened by **Save page** on Home's *On this page* card (Read later still saves in one tap).
Header with **Back** (round outline) + Stash mark (white circle on lime) + Close. Body (padding 24px 28px, gap 16px): "Saving this page —" label → page title (30px) → **Folder** pill with folder icon (white glow on focus; "Suggested" tag when taken from your saves) → **Tags** chips (black = on, white `+ #tag` = suggestion, tap to toggle) → **Note** text area → **Remind me** 3-way segmented (Never / Tomorrow / Next week) → status → **Save** (Large primary, grows) + **Cancel** (outline) pinned to the bottom. Tags, note and reminder are stored in `storage.local.stashMeta` (browser bookmarks can't hold them); tag and folder suggestions are local keyword/site guesses until AI is connected. Reminders are stored but don't notify yet.

### Library (off-white) — `library.html`
Updated to the revised *Side panel · Library* board (grouped by folder). Header (avatar + close) → search pill → top tabs (Library active) → body (padding 16px 18px, gap 16px): **Your library** (30px) with "N saved · Sort ⌄" on the right (Sort = Recent / Oldest / Name) → folder filter chips (All + the 6 biggest top-level folders, scrollable, 32px) → **grouped list**, biggest folder first. Each group has a 40px header row (1px black line above, 15% line below): 28px round folder icon (lime, black, tan, white, sky or gray), folder name (15px, 500), count, chevron that collapses/expands the group (`aria-expanded`). Under it, rows (54px, 12px radius): a 34px white **favicon tile** (1px `#D9D9D5` border) holding an 18px rounded **letter chip** from the site's first letter (colour by site); page title; the **address** with the domain in black and the path in grey (truncated); on the right a small ↗ icon and the age (11px). The full URL is the link and its tooltip. Each group shows its 3 newest rows with **Show all N** to expand. Search flattens to matching rows inside their groups and shows the result count. Tip at the bottom: drag a link into the panel to save it (drops into the Stash folder). Empty states for no saves, an empty folder and no matches.

### Tidy (sky) — `tidy.html`
Header (avatar + close) → search pill → top tabs (Tidy active) → body: sparkle mark (52px) → **Never miss a messy folder** (32px) → ruled category list, each row a name + count ("23 duplicates"), one-line explanation, a 20px checkbox, and the first two affected items (all of them, up to 12, in **Preview**): **duplicates** (keep the newest copy), **dead links** (moved to an *Archive* folder), **unsorted** (moved to the folder you already use for that site; saves with no match stay put and are counted) → pinned actions: **Fix N items** (Large primary, N = checked items) + **Preview** (toggles detail lists) → "You can undo any time." / **Undo last tidy-up** (restores removed and moved bookmarks).
Dead-link checking visits each saved page, so it needs the optional "all sites" permission, requested when the user presses **Check links** (progress bar while scanning; 404/410 or unreachable = dead). The result is cached until the next check.

### AI insights (sky) — `insights.html`
Reached from Home ("Insights" on the chart card). Header with **Back** + avatar + close → search pill → top tabs (Home stays active) → body: "Insights —" with a **Week / Month** segmented control (compact, 28px) → headline **You live in `Dev` this week** (30px, top category highlighted lime) + "N visits to saved pages —" → **Most visited categories** bars (top 5 top-level folders, top one lime) → **Most opened pages** (top 2, with ×count) → white **AI suggests** box: *Pin* a page opened on 3+ days (shows under "Pinned —" on Home) and *Create* a folder grouping 4+ saves of one site spread across folders (with Undo) → footer "Counts opens of pages you've saved, on this device only. Tracking since …".
Data: the background worker records a visit each time a saved page finishes loading (URL + time only, kept 90 days in `storage.local.visits`; no history permission). Until visits exist the screen shows an empty state. Suggestions are rule-based until AI is connected.

### Onboarding · 1 Welcome (lime) — `welcome.html`
Shown once to new accounts (after Sign up → Plans, via *Not now* or the paid confirmation; Home redirects while `session.isNew`). Header: white-circle Stash mark, **Skip**, Close. Body (padding 24px 28px): four-line **step indicator** (current step 2px solid, upcoming 1px at 35%; `aria-label="Step 1 of 4"`) → **Hi {first name}, ready to set up Stash?** (40px, 24px top margin) → lead "It takes about 30 seconds. Stash will stay beside every page you open." → two ruled choice rows pinned to the bottom: **Bring my bookmarks** (filled black icon; "Import from this browser. AI sorts them.") and **Start fresh** (outline icon; "Begin with an empty library.") → note "Your original browser bookmarks are never changed." Skip and Start fresh go to Home; Bring my bookmarks goes to the importing step (screen 2, not built yet — a placeholder for now).
Flow: 1 Welcome → 2 Importing → 3 All sorted → 4 Pin tip → 5 First save (Home). *Start fresh* skips to 5.

### Onboarding · 2 Importing (off-white) — `import.html`
Header: dark Stash mark + Close (no Skip). **Step indicator** at step 2 (line 1 solid 1px, line 2 thick). Label "Working on it — Keep browsing, we'll keep going" → **Sorting your bookmarks…** (40px) → progress row ("842 of 1,248" / "67%") over an 8px outlined bar with a lime fill → four ruled checklist rows: *Imported all bookmarks*, *Removed duplicates*, *Putting them into folders*, *Adding tags* (done = black check circle, active = lime ring + dot, 500 weight, pending = outline circle, grey) → status line → note + **Continue** (shown when done; **Try again** on error).
Behaviour: Stash never edits the user's bookmarks. It copies them into an organized **Stash** folder (original folder names kept; loose saves go to a site folder when 3+ share a site, else *Inbox*), skips duplicate URLs (they are left out of the copy, not deleted), and stores two keyword tags per bookmark. Writes are throttled to stay under the browser's bookmark-write limit; progress is saved so reopening the panel resumes. Summary (total, duplicates left out, folders) is saved in `storage.local.importState.summary` for the next screen (3 All sorted).

### Onboarding · 3 All sorted (sky) — `ready.html`
Header: white-circle Stash mark + Close. **Step indicator** at step 3 (two done lines, third thick, fourth faint). **All sorted** (40px) → inline stats: *N folders · N saves · N duplicates left out* (22px numbers) → ruled list of the imported folders (top 6, biggest first; 30px round icon in black, lime, white, tan, off-white, gray; name; count) with **See all N** to expand → pinned actions: **Looks good** (Large primary → next step) and **Change** (outline).
**Change** turns each folder name into a pill field so it can be renamed (validated: not empty, no duplicates; errors inline); the buttons become **Save changes** / **Cancel**. Renaming updates the folder inside the Stash folder only. If nothing was imported: "Nothing to review" and **Continue**.

### Onboarding · 4 Pin tip (tan) — `tip.html`
Header: white-circle Stash mark + Close. **Step indicator** at step 4 (three done lines, last thick). **Keep Stash beside every page** (40px) → 120px outlined mock (page lines on the left, black panel with the lime mark on the right) → three ruled numbered rows (`01 Click the Stash icon to open the panel`, `02 Pin it so it's always one click away`, `03 Want a different shortcut? Change it` — the link opens the browser's shortcut settings) → shortcut row "Open panel — Works on any page" with the **real** shortcut as key chips (read from the browser; "Not set yet" if cleared; refreshes when the panel regains focus) → **I'm ready** (Large primary, pinned) → First save.
Differences from the board: the shortcut is **Ctrl/Cmd+Shift+Y**, not Alt+S (Alt+S is still an open item in the spec), and row 03 offers changing the shortcut instead of "Switch to Popup", since the product is side-panel only.

### Onboarding · 5 First save (off-white) — Home in "getting started" mode
Not a separate page: it is **Home** (`home.html`) with a guide layered on, shown after onboarding (*Start fresh* or *I'm ready* on Pin tip sets `storage.local.gs`). Header, search and tabs as Home. On top, a white **Getting started —** card: "N of 3", three-segment line (done = 2px solid, rest 1px at 35%), and the next step — *1 Stash is set up, 2 Save your first page, 3 Run a tidy-up* — with a **Hide** link (**Done** when finished). The **On this page** card gets a 2px black focus ring (`0 0 0 3px bg, 0 0 0 5px ink`), and below it a black coach bubble with a caret: **Try it: tap Save page** / "Stash already suggested a folder." Footer "Your library is empty for now — every save shows up in Library." only when there are no saves.
Progress is real: step 2 completes when any bookmark is added after onboarding started; step 3 when a tidy-up is applied. When step 2 is done the ring and bubble disappear. Differences from the board: the Popup button is gone (side-panel only) and the bubble no longer claims AI chose the folder.

### For you (tan) — `foryou.html`
Header → search → top tabs (For you active) → body: "`host` — Picked for this page" + **More like this** (30px) → white info card with the Stash mark ("Saved 3 weeks ago in Dev › Docs." or a *Save it* prompt if not saved) → **Already in your library —** up to 3 ruled rows (title, folder path, ↗, open in new tab) → **Sites you use on this topic —** up to 3 pill rows with a round **+** button that saves the site's home page into the same folder (with Undo) → footer "Updates as you change tabs. Uses page title and URL only."
Matching is local: shared keywords in title, URL and folder names (+ same site). Differences from the board: no "opened N times" (visits aren't tracked) and no web-sourced "best sites" until AI/search is connected, so the sites list comes from your own saves. Empty states for browser pages and for topics with no related saves.

## 5. Responsive rules
- ≥ 400px: as designed. 320–399px: padding drops to 20px, headline 34px, stats strip stays 3 columns.
- Wider than 520px: body content stays 520px max and is centered; background colour still fills.
- Short windows: body scrolls; header is sticky; footer sits below content (no overlap).
- Reduced motion, focus rings and tap targets follow the UI/UX skill (≥ 44px hit areas).

## 6. Implementation checklist
- [ ] `<body class="panel [colour]">`, `<header id="head">` + `renderPanelHead()`
- [ ] Content inside `<main class="panel-body">`; footer as `<footer class="panel-foot">`
- [ ] Buttons from `buttons.css` (Large primary last), fields from `forms.css` + `validate()`
- [ ] No fixed widths or heights; test at 320, 400 and 500px

## 7. Bookmark links always show the site icon
Anywhere a saved page is listed or linked, show that site's **icon** (favicon) at the left — never a generic folder or a bare letter. Use `favicon(url)` from `extension/popup/favicon.js`: it renders a `.fav` tile (34px; `small` = 26px) with the browser's cached favicon (needs the `favicon` permission). If a site has no icon, it falls back to a rounded letter chip. Used in: Library rows, For you (related saves and site suggestions), Insights (most opened pages), Home (pinned pages and the *On this page* card). Never reuse the `.chip` class (tag chips) for icons.


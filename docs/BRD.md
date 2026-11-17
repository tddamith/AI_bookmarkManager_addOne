# Business Requirements Document (BRD)
**Product:** Stash — AI Bookmark Manager (browser extension; "Stash" is a working name)
**Version:** 0.2 (Draft) · **Date:** 2026-11-17 · **Owner:** Damith
**Sources:** [Product & Design Spec](https://claude.ai/artifact/KbdGEAbDn5aMz2N6rS3pEi) · [Design canvas](https://claude.ai/artifact/TBtpNV4dhQLMPF2i5wZiof) · UI rules: `.claude/skills/ui-ux/SKILL.md`

---

## 1. Executive Summary
Stash is a browser extension where everything happens in one small popup: save a page in one click, and AI files, tidies and suggests. Users find saves by typing in plain words, clean up with one tap, and get related saves and the best sites on a topic. A free plan drives adoption; a Pro plan (paid via PayPal) unlocks unlimited AI.

## 2. Business Objectives
| # | Objective | Success measure |
|---|-----------|-----------------|
| O1 | Make saving effortless | Save in one click / `Alt + S` |
| O2 | Reduce manual organizing | AI suggestion accept rate **[TARGET %]** |
| O3 | Monetize | Free → Pro conversion **[TARGET %]** |
| O4 | Earn trust | Every tidy-up undoable; page content never read without opt-in |

## 3. Product Pillars
| Pillar | What the user does | What AI does |
|--------|--------------------|--------------|
| Save | One click on any page | Picks the folder and tags |
| Find | Types in plain words | Matches across titles, tags and notes |
| Tidy | Taps one button | Finds duplicates, dead links and unsorted saves |
| For you | Browses as usual | Shows related saves and the best sites on the topic |

## 4. Scope
**In scope (MVP)**
- Browser extension popup, 380 × 600 px, five-tab bar: Home, Save, Library, Tidy, For you; AI insights opens from a chart button on Home
- Account: log in, sign up (email or Google)
- Plans & pricing (Free / Pro), checkout via PayPal, confirmation
- New-user onboarding: import browser bookmarks or start fresh, guided first save
- Chrome, Edge, Brave (Manifest V3); Firefox compatibility where feasible

**Out of scope (MVP)**: mobile apps, team sharing, Safari, importing from third-party services.

## 5. Stakeholders & Users
Product owner (vision, priorities) · End users who save many links (researchers, developers, students) · Developers (MV3 codebase) · Legal/Privacy (data handling, payment terms).

## 6. Business Requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| BR-01 | Save the current page in one click, shortcut `Alt + S`, or context menu; AI picks folder and tags | Must |
| BR-02 | Plain-language search over titles, tags and notes; recent bookmarks listed with folder icons | Must |
| BR-03 | Tidy: counts of duplicates, dead links and unsorted saves (each selectable); "Fix all", preview changes, undo any time | Must |
| BR-04 | For you: saved pages related to the current site, and best sites on the topic; open a saved page or save a suggestion | Should |
| BR-05 | Home dashboard for returning users: greeting, stats (saved, this week, read later), 3 AI suggestions (Merge, Move, Open), 2 recent saves | Must |
| BR-06 | AI insights: Week / Month switch, top-category headline, bar chart of 5 most visited categories, 2 most opened pages, 2 AI suggestions | Should |
| BR-07 | AI suggests, the user approves; every tidy-up can be undone | Must |
| BR-08 | Works offline | Must |
| BR-09 | Privacy: uses page title and URL by default; reading page content is opt-in | Must |
| BR-10 | Log in: Continue with Google, email, password, Forgot link, link to sign up | Must |
| BR-11 | Sign up: Google sign-up, name, email, password, Terms checkbox; free, no card needed; leads straight to plans | Must |
| BR-12 | Plans: Monthly / Yearly switch; Free and Pro cards; "Not now" skips | Must |
| BR-13 | Checkout: order summary (price, tax, total, renewal date), promo code, Pay with PayPal, debit or credit card | Must |
| BR-14 | Confirmation "You're Pro": plan, payment method, receipt by email; button to run first tidy-up | Must |
| BR-15 | Onboarding: import browser bookmarks (progress and checklist: imported, duplicates removed, folders, tags) or start fresh; "All sorted" lists new folders (Looks good / Change); pin tip with `Alt + S`; guided first save with a "Getting started 1 of 3" checklist | Must |
| BR-16 | Original browser bookmarks are never changed by import or tidy-up | Must |

## 7. Plans & Pricing
| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 | Unlimited bookmarks, **[N]** AI suggestions a month |
| Pro | **[PRICE]** a month or a year (yearly saves **[X]%**) | Unlimited AI suggestions, one-tap tidy-up, For you picks on every site, sync on all devices |

Payment: PayPal's official checkout button (also handles card payment). The design's PayPal button is a stand-in.

## 8. Screens (design canvas, 17 screens)
- **Popup (6):** Home, AI insights, Save, Library, Tidy, For you
- **Account & payment (5):** Log in, Sign up, Plans, Checkout, You're Pro
- **Onboarding (5):** Welcome, Importing & AI sorting, Your library is ready, Pin & shortcut, First save (guided)
- **Components:** Text fields (underline, pill, search with action, leading icon, password, text area, tags, select; states default / focus / filled / error / disabled)

## 9. Visual Style (summary — full rules in the UI/UX skill)
One flat background per screen, black text, 1px black lines, black pill buttons. Inter Tight; large light headlines. Colours: Acid lime `#D4FA1E` (Save, Sign up, AI suggestions), Sky blue `#A6C3DD` (Tidy, Insights, You're Pro), Warm tan `#C9B597` (For you), Soft gray `#CFCFCC` (Plans), Off-white `#F4F4F1` (Home, Library, Log in), Black `#111111`. Accessible forms and focus states (WCAG 2.1 AA).

## 10. Non-Functional Requirements
- **Performance:** popup opens fast; search feels instant (results < 200 ms on thousands of saves).
- **Privacy & security:** local-first; passwords never stored in the extension; minimal permissions; strict MV3 CSP; no remote code; payments handled only by PayPal.
- **Accessibility:** WCAG 2.1 AA; keyboard operable; visible focus.
- **Compatibility:** latest two versions of Chrome, Edge, Brave; Firefox best effort.
- **Reliability:** graceful degradation offline and when AI is unavailable.

## 11. Current Build Status
| Area | Status |
|------|--------|
| Extension scaffold (MV3), popup shell, save and search native bookmarks | Done |
| Log in, Sign up, Plans, Checkout, You're Pro screens | Done (UI only; auth and payment are stubs) |
| Shared form components and validation | Done |
| Home, Save, Tidy, For you, AI insights, onboarding | Not started |
| Real auth, PayPal, AI backend, sync | Not started |

## 12. Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Page content sent to AI raises privacy concerns | High | Title + URL by default; opt-in for content; clear disclosure |
| Payment/stub shipped by mistake | High | Replace stub with PayPal checkout and server-side verification before launch |
| `Alt + S` conflicts with browser shortcuts | Medium | Verify in Chrome, Edge and Brave; allow rebinding |
| AI cost on Free tier | Medium | Monthly cap **[N]**, caching |
| Store rejection over permissions | Medium | Minimal permissions, clear justification |

## 13. Open Items
- [ ] Set Pro price (monthly, yearly) and yearly discount (**[PRICE]**, **[X]%**)
- [ ] Set Free plan monthly AI suggestion limit (**[N]**)
- [ ] Confirm tax, total and renewal-date logic (**[TAX]**, **[TOTAL]**, **[DATE]**)
- [ ] Set success-metric targets (**[TARGET %]**)
- [ ] Check `Alt + S` is free in Chrome, Edge and Brave
- [ ] Replace stand-in PayPal button with PayPal's official checkout
- [ ] Confirm the product name ("Stash" is a working name)
- [ ] Replace example counts, folders and pages with live library data

## 14. Milestones (indicative)
| Phase | Deliverable |
|-------|-------------|
| M0 | Setup, MV3 scaffold, account and plan screens (done) |
| M1 | Save, Library search, Home dashboard with real data |
| M2 | AI tagging, Tidy, For you (opt-in privacy) |
| M3 | Onboarding and import, real auth and PayPal |
| M4 | Beta, store submission |

## 15. Approval
| Name | Role | Date | Signature |
|------|------|------|-----------|
| | Product owner | | |

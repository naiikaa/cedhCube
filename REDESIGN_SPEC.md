# cEDHcube Redesign Spec

## Goal
Full visual redesign of the app: state-of-the-art, clean, "artsy" but professional. Remove ALL emoji icons. Introduce authentic Magic: The Gathering symbolism (mana pips, card-frame motifs, artwork) tastefully — like a premium MTG companion app (think: Moxfield/Archidekt/EDHREC production quality), not a fan-made toy.

## Scope
Everything in one pass: header/global chrome, tabs, Decks tab (import/create forms + deck list), Collection tab (filters + card grid), Deck modal, Card detail modal, theme system (must still support all 7 existing themes via CSS vars).

## 1. Dependencies to add (frontend/)
```bash
cd ~/magic-collection/frontend
npm install mana-font lucide-react
npm install @fontsource/cinzel   # self-hosted serif display font, avoids external font requests
```
- `mana-font`: import its CSS once in `main.tsx` or `index.css` (`import 'mana-font/css/mana.css';`). Provides `<i class="ms ms-w">`, `ms-u`, `ms-b`, `ms-r`, `ms-g`, `ms-c`, plus `ms-cost` wrapper class, `ms-2x` size modifiers, and shape variants (`ms-cost` for pip circle background). Use these for ALL W/U/B/R/G/C color identity pips, replacing the emoji map in `ColorIdentity.tsx` and all inline color-pip renders in `App.tsx`.
- `lucide-react`: replace every emoji-as-icon usage with a matching lucide icon component, sized/colored via `currentColor` + CSS vars so it respects theming.
- `@fontsource/cinzel`: import in `main.tsx`. Use `font-family: 'Cinzel', serif` for headings/titles/wordmark only (h1/h2/h3, deck names in list, card names in modals). Body text, buttons, inputs, labels stay on the existing system sans-serif stack.

## 2. Emoji inventory to remove (exhaustive — grep confirmed only these 2 files: App.tsx, ColorIdentity.tsx)
| Emoji | Location | Replacement |
|---|---|---|
| 🃏 Decks tab | tab label | lucide `Layers` or `Rows3` icon + text |
| 📦 Collection tab | tab label | lucide `LibraryBig` or `Package` icon + text |
| ✏️ rename button | deck modal header | lucide `Pencil` icon |
| 🗑️ delete button | deck modal header | lucide `Trash2` icon |
| ✕ close buttons (×3 places) | modals | lucide `X` icon |
| ↻ refresh images | deck list header | lucide `RefreshCw` icon (spin animation while in flight) |
| ★ commander star (×multiple) | deck list, modal, commander picker | lucide `Crown` icon (fits "Commander" semantics well) OR keep a stylized star — use lucide `Star` filled with `--commander` color. Prefer `Crown`. |
| ☀️💧💀🔥🌲⚪ color pips | ColorIdentity.tsx, App.tsx (×3 inline copies) | mana-font `ms ms-{w,u,b,r,g,c}` inside `.ms-cost` circle |
| ✅ / ❌ add-card results | deck modal add-cards results list | lucide `CircleCheck` (green) / `CircleX` (red) |

Also centralize the 3 duplicated inline color-pip renderer blocks in App.tsx into a single shared `<ColorIdentity>` (or a new `<ManaPip>`) component — don't leave copy-pasted logic.

## 3. Header redesign
Replace the current flex header (title + theme select) with a richer bar:
- Left: wordmark "cEDHcube" in Cinzel, with a small mana-font glyph cluster (e.g. faint `ms-w ms-u ms-b ms-r ms-g` row, low opacity, decorative) beside/behind it — subtle, not gaudy.
- Center or left-adjacent: live stats — total decks, total unique cards, total card count across collection (small label/value pairs, e.g. "12 Decks · 340 Cards"). Pull from existing `decks`/`allCollection` state (compute counts client-side, no new endpoint needed unless convenient).
- Right: a global search input (lucide `Search` icon) that — at minimum — jumps to Collection tab and pre-fills `searchQuery`; a theme switcher (keep the 7 themes, restyle the control — consider a small palette/swatch icon button opening a dropdown instead of a bare `<select>`, but a nicely styled native `<select>` is acceptable if time-constrained).
- Visual treatment: subtle bottom border with a gradient in `--accent`, faint repeating mana-symbol watermark pattern in the background at ~4-6% opacity (CSS `background-image` using the mana font glyphs as an SVG data-uri pattern, or a `::before` layer), NOT a card-frame background image (no external asset licensing concerns) — keep it CSS-generated.
- Header must remain sticky/fixed at top is optional; keep simple unless trivial.

## 4. Card-frame-inspired visual language (use throughout, tastefully)
- Deck list rows / collection cards: replace plain `border-radius` boxes with a subtle "card frame" feel — thin dual-tone border (outer hairline in `--border`, inner 1px highlight) reminiscent of MTG card frames, rounded corners kept modest (MTG cards have a distinctive corner radius — echo it, don't literally recreate a card).
- Commander/card art should be used more prominently: it's fine to keep collection grid cards using the existing image-forward layout. For the deck list rows, keep the small commander thumbnail but improve its frame treatment (e.g. a thin gold/accent ring for commander art, echoing the card's foil/legendary frame line).
- Mana curve, color identity, foil badge — keep functionally as-is, restyle only.
- Avoid gimmicks like literal parchment textures or excessive drop shadows — keep it modern/clean per the "state of the art, clean" requirement. MTG symbolism should read as tasteful accents (mana pips, subtle watermarks, serif headings, crown for commander) not costume/skeuomorphism.

## 5. Non-negotiables / do NOT break
- All 7 existing themes (`default, gruvbox, dracula, nord, onedark, monokai, asimov`) must still work — new CSS should reference the existing `--*` custom properties, not hardcoded colors, so theme switching still recolors everything including new icon/mana elements (lucide icons via `color: var(--accent)` etc.; mana-font glyphs can keep their canonical WUBRG colors — that's correct/expected, MTG mana symbols are NOT theme-tinted in any real MTG product).
- All existing functionality unchanged: deck CRUD, Moxfield import, card add/remove/quantity/foil toggle, commander picker, collection filters (type/deck/search), card detail modal (localized names, oracle text, rulings).
- Keep it a single-file `App.tsx` main-logic pattern (per project convention) but it's fine to extract new small presentational components (e.g. `Icon` wrappers, `StatBadge`, `ManaPip`) into `components/`.
- TypeScript must compile clean (`npm run build` in frontend/ should succeed).
- No new backend changes needed for this pass — this is frontend-only.

## Acceptance checklist
- [ ] Zero emoji characters remain in `frontend/src/**/*.tsx` (grep should return nothing for common emoji ranges)
- [ ] mana-font glyphs render for all W/U/B/R/G/C pips (ColorIdentity + all inline duplicates removed/unified)
- [ ] lucide-react icons replace all former emoji UI icons
- [ ] Cinzel applied to headings/wordmark/card & deck names only
- [ ] New header has wordmark, stats, search, theme switcher, subtle mana watermark
- [ ] `npm run build` succeeds with no TS errors
- [ ] All 7 themes still visually coherent (spot check `default` and 2 others)
- [ ] No regressions in deck creation, Moxfield import, card add/remove, commander picker, filters, card detail modal

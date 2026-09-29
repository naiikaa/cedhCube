# DESIGN.md — cEDHcube visual identity (v2, BOLDER)

Status: replace (agreed with owner, 2026). The incumbent world (10 editor-theme
recolors, Cinzel-everywhere, additive glow, card-frame-on-everything) and the v1
revamp (a polite Linear/Sentry clone) BOTH read as anonymous. The owner's call:
"it doesn't look that much new and exciting." This revision keeps the craft
discipline of v1 but pushes for a **distinct, ownable identity** — a cEDH
collection tracker should feel like a premium collector's instrument, not a
bland admin panel and not a repainted editor theme.

## Identity (the point of view)
**"The collector's terminal."** A deep, near-black instrument of precision that
treats real MTG card art as the source of colour and warmth, wraps it in a
tight, engineered chrome, and lets data (prices, meta counts, mana curves) read
in crisp tabular mono. Dark, dense, expensive-feeling. Think: a high-end
horology or photography studio's UI — the tool is authoritative, the cards are
the stars, and nothing is decorative-for-its-own-sake.

Concrete anchors the redesign must OWN (not borrow):
1. **Card art is the hero, not a thumbnail.** Deck rows lead with a large
   commander portrait; the collection grid showcases art prominently; the meta
   comparison is art-forward. Dark chrome frames the art — it never overpowers it.
2. **A signature "colour well" system.** Every surface that touches a specific
   deck picks up that deck's colour (from `--deck-color`) as a restrained accent:
   a left rail, a glow only on the active selection, a commander ring. Colour is
   *semantic* (which deck / which card), never random.
3. **One unmistakable chrome detail** used consistently across the app so it
   reads as a designed system, not assembled components — e.g. a distinctive
   treatment for the header/wordmark, the deck-row commander frame, or the
   value-chart axis. Choose ONE and apply it everywhere.
4. **Premium data sense:** prices and collection value in amber/gold mono figures
   (the "money" token, already in the system), meta counts as precise tabular
   badges, mana pips always canonical WUBRG.

## Design tokens (override v1 where bolder)

### Surface & depth
- Near-black layered fills with **real depth**, not flat cards: `--bg` #0a0a10 →
  `--bg-surface` #12121a → elevated #181824; borders 1px `#23232e`.
- A dedicated **collection-art backdrop**: the collection grid tiles sit on a
  surface that lets the card art breathe (tight frame, thin art seat, subtle
  drop shadow *under* the art — the one place a real shadow earns its keep).
- Remove the generic "MTG inner hairline" from `.frame` (keep it ONLY on actual
  collection cards + commander art). No additive glow as a surface wash; glow is
  reserved for the selected tab and active deck selection only.

### Typography
- `--font-sans` = Inter (installed). Body, buttons, fields, labels.
- `--font-display` = Cinzel, but ONLY as the *signature accent*: wordmark, deck
  names, commander names, modal titles. NOT generic headings.
- **Headings** (h2/h3): compact uppercase sans, letterspaced, small — a label,
  not a shout. Give them a hairline rule to structure density.
- `--font-mono` = JetBrains Mono (installed) + `font-variant-numeric: tabular-nums`
  on ALL figures: prices, quantities, meta counts, stat values, deck card counts,
  chart axis labels. Numbers should look machined.
- **Money as jazz:** collection value, deck value, unit prices in the amber gold
  `--money` colour with mono figures — the one recurring warm accent that says
  "value."

### Colour
- Keep the 10 themes; they swap **palette only**, never structure (v1 decision).
- Each theme keeps ONE reserved `--accent`. Secondary/success/danger/money are
  semantic and muted. Cybercore = palette + font swap, not a structural outlier.
- Deck colours (`--deck-color`) are the *dynamic* colour source — semantic accent,
  applied via the colour-well system (#2 above), never as a loud 3px full-row bar.

### Shape, motion, signature
- Radii small and uniform (8–10px shells, 6px controls). One easing token shared
  by tabs/modals/toasts (~170ms). The one chrome signature (#3 above) is applied
  consistently — if we pick the "commander portrait frame", for example, it
  appears on deck rows, deck modal, and commander picker with the same ring.
- Empty states get real craft: a composed icon + a short line + a primary action
  (Add Deck / create collection), so the app never looks broken while empty.

### Density / layout
- `.page` max-width 1280px (from 1000px). Data surfaces (collection grid, meta
  stock, value chart) use the full canvas. `.card-grid` denser (min col ~140px).
- Deck tab: "Add Deck" modal (mode tabs: Paste list / Import Moxfield) replaces
  the two inline frames. Deck list + a crafted empty state lead the tab.

## The chrome signature (pick ONE and make it system-wide)
Lead with a concrete, repeatable detail. Recommended candidate: **"the framed
commander"** — commander art always sits in a distinctive ring/inset (thin ring
in the deck's colour, a subtle seat shadow, a tiny identity pip). It should be
recognisable in a deck row, the deck modal, and the meta comparison. If that
fights the layout, alternatives: a distinct wordmark rule, or the money-axis
chart treatment. DECIDE one and apply it to every surface that shows a commander
or a deck — consistency across 3+ surfaces is what makes it a system.

## Signature craft checklist
- **Deck rows:** large commander portrait (framed ring), deck name in Cinzel,
  deck colour as a *calm* rail, mana curve + value in tabular mono/amber.
- **Collection cards:** art as hero on a tight seat with a subtle under-shadow;
  body with name, type, mana, price (amber mono), deck dots.
- **Meta view + stock rows:** tabular meta-count badges, clear "off-meta" state,
  dense rows, art-forward compare.
- **Value charts:** amber `--money` axis + per-deck lines from `--deck-color`,
  mono axis labels.
- **Header:** wordmark in Cinzel + the chrome signature; stat strip in mono
  figures; keep the theme menu (10 themes).

## Implementation constraints (non-negotiable)
- Backend (`app.py`, `database.py`, `edhtop16.py`) is UNTOUCHED. UI only.
- Keep existing component structure; reuse handlers/state (createDeck, importMox,
  deckName/deckCards/moxUrl/moxColor/deckColor). The Add-Deck modal was already
  built in v1 — keep it, restyle to this system.
- No new npm packages beyond what is already installed (inter, jetbrains-mono,
  cinzel all present). No `npm install` of new deps.
- Read the EXISTING current state of index.css/App.tsx first — v1 already landed
  a token rewrite and the Add-Deck modal; build on it, do not reset to git HEAD,
  but push every surface toward THIS bolder v2 identity.

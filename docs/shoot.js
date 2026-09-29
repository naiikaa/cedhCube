const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const OUT = '/home/npopkov/magic-collection/docs/screenshots';

(async () => {
  const browser = await chromium.launch();
  const mkPage = async (theme = 'paper', w = 1600, h = 1000) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript(t => localStorage.setItem('cedhcube-theme', t), theme);
    return page;
  };
  const shoot = async (page, name) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 85 });
    console.log('shot', name);
  };

  // 01 — Decks tab (paper)
  let p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await shoot(p, '01-decks-tab');
  await p.close();

  // 02 — Collection tab
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.tab[aria-selected="false"]:has-text("Collection")');
  await shoot(p, '02-collection-tab');
  await p.close();

  // 03 — Collection type filter (Creature active)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.tab:has-text("Collection")');
  await p.waitForTimeout(1800);
  await p.click('.chip:has-text("Creature")');
  await shoot(p, '03-collection-type-filter');
  await p.close();

  // 04 — Global search (header search → Collection pre-filtered)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.fill('input[aria-label="Search collection"]', 'Ragavan');
  await p.press('input[aria-label="Search collection"]', 'Enter');
  await shoot(p, '04-global-search');
  await p.close();

  // 05 — Theme switcher open (3 themes)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.theme-btn');
  await p.waitForTimeout(800);
  await shoot(p, '05-theme-switcher');
  await p.close();

  // 06 — Ink theme applied (dark) — replaces old Cybercore shot
  p = await mkPage('ink');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await shoot(p, '06-theme-ink');
  await p.close();

  // 07 — Deck modal (click first deck row) + reload to clear backdrop
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await p.click('.deck-row:first-of-type');
  await p.waitForTimeout(1800);
  await shoot(p, '07-deck-modal');
  await p.close();

  // 08 — Commander picker (deck modal → Change)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await p.click('.deck-row:first-of-type');
  await p.waitForTimeout(1800);
  await p.click('.deck-modal-cmd:has-text("Change")');
  await p.waitForTimeout(900);
  await shoot(p, '08-commander-picker');
  await p.close();

  // 09 — Card detail modal (Collection → first card)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.tab:has-text("Collection")');
  await p.waitForTimeout(2000);
  await p.click('.coll-card:first-of-type');
  await p.waitForTimeout(2500);
  await shoot(p, '09-card-detail-modal');
  await p.close();

  // 10 — Meta tab (RogSil deck selected); poll until entries render (edhtop16
  // can transiently return empty — retry, don't screenshot the empty state)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.tab:has-text("Meta")');
  await p.waitForTimeout(2500);
  await p.selectOption('#meta-deck-select', '14'); // [cEDH] RogSil
  for (let i = 0; i < 10; i++) {
    const n = await p.locator('.meta-entry').count();
    if (n > 0) break;
    await p.waitForTimeout(1500);
  }
  await shoot(p, '10-meta-tab');
  await p.close();

  // 11 — Mulligans tab (deal a hand first so the round renders)
  p = await mkPage('paper');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.tab:has-text("Mulligans")');
  await p.waitForTimeout(2500);
  await p.click('.mulligan-actions .chip:has-text("Deal hand")');
  await p.waitForTimeout(3000);
  await shoot(p, '11-mulligans-tab');
  await p.close();

  await browser.close();
  console.log('ALL DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });

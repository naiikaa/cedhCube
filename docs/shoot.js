const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const OUT = '/home/npopkov/magic-collection/docs/screenshots';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('saved', name);
  };

  // 1. Decks tab (default landing view)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // let commander thumbnails load from Scryfall
  await shot('01-decks-tab');

  // 2. Collection tab
  await page.click('button:has-text("Collection")');
  await page.waitForTimeout(2500);
  await shot('02-collection-tab');

  // 3. Collection type filter
  await page.click('button:has-text("Creature")');
  await page.waitForTimeout(700);
  await shot('03-collection-type-filter');
  await page.click('.filter-btn:has-text("All"), button:has-text("All")');
  await page.waitForTimeout(400);

  // 4. Global search
  await page.click('button:has-text("Decks")');
  await page.waitForTimeout(500);
  const searchInput = page.locator('input[placeholder="Search collection…"]');
  await searchInput.fill('Sol Ring');
  await searchInput.press('Enter');
  await page.waitForTimeout(1200);
  await shot('04-global-search');
  await searchInput.fill('');
  await searchInput.press('Enter');
  await page.waitForTimeout(300);

  // 5. Theme switcher open
  await page.click('button[aria-label="Change theme"]');
  await page.waitForTimeout(400);
  await shot('05-theme-switcher');
  await page.click('.theme-option:has-text("Dracula")');
  await page.waitForTimeout(700);
  await shot('06-theme-dracula');
  await page.click('button[aria-label="Change theme"]');
  await page.waitForTimeout(300);
  await page.click('.theme-option:has-text("Default")');
  await page.waitForTimeout(500);

  // 6. Deck modal
  await page.click('button:has-text("Decks")');
  await page.waitForTimeout(500);
  await page.locator('.deck-row').first().click();
  await page.waitForTimeout(1500);
  await shot('07-deck-modal');

  // 7. Commander picker inside modal
  const changeBtn = page.locator('button:has-text("Change")');
  if (await changeBtn.count() > 0) {
    await changeBtn.first().click();
    await page.waitForTimeout(600);
    await shot('08-commander-picker');
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.count() > 0) await cancelBtn.first().click();
  }

  // close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const closeBtn = page.locator('button:has-text("Close")');
  if (await closeBtn.count() > 0) await closeBtn.first().click();
  await page.waitForTimeout(500);

  // 8. Card detail modal
  await page.click('button:has-text("Collection")');
  await page.waitForTimeout(1500);
  await page.locator('.coll-card').first().click();
  await page.waitForTimeout(1500);
  await shot('09-card-detail-modal');

  await browser.close();
  console.log('DONE');
})();

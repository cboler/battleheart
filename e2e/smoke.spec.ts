import { test, expect } from '@playwright/test';

test.describe('Battleheart Responsive Shell & Gameplay Smoke Tests', () => {
  test('should load Realm Hub, navigate tabs, enter battlefield, and verify zero horizontal overflow', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');

    // 1. Root shell and brand verification
    await expect(page.locator('.brand-title')).toHaveText('Battleheart');
    await expect(page.locator('#starter-title')).toHaveText('Battleheart');

    // 2. Primary layout elements are visible
    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();

    // 3. Prevent accidental horizontal overflow on Realm Hub
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // 4. Switch to Tavern tab and verify 10 hero classes are rendered (with story-locked progression)
    await page.locator('#tab-tavern').click();
    await expect(page.locator('.hero-card')).toHaveCount(10);
    await expect(page.locator('.hero-card.story-locked')).toHaveCount(6);

    // 4b. Switch to Armory tab and verify progressive Forge tier banner and dual relic slots
    await page.locator('#tab-armory').click();
    await expect(page.locator('.forge-tier-banner')).toContainText('Tier 2 / 7 Unlocked');
    await expect(page.locator('.trinket-slot-pill')).toHaveCount(2);

    // 4c. Switch to About & Credits tab and verify Mika Mobile attribution & disclaimer
    await page.locator('#tab-about').click();
    await expect(page.locator('.about-card')).toContainText('Mika Mobile');
    await expect(page.locator('.about-card')).toContainText('non-commercial');

    // 5. Switch to Map tab, verify Illustrated Overworld Map pins, and launch Stage 1 Battle
    await page.locator('#tab-map').click();
    await expect(page.locator('.parchment-map-stage')).toBeVisible();
    await expect(page.locator('.map-pin-node')).toHaveCount(10);
    await page.locator('#start-stage-1').click();

    const arena = page.locator('#battlefield-arena');
    await expect(arena).toBeVisible();
    await expect(page.locator('.arena-unit.is-hero')).toHaveCount(3);
    await expect(page.locator('.arena-unit.is-enemy').first()).toBeVisible();

    // Test line-drawing drag command from Hero 1 to the center of the arena
    const firstHero = page.locator('.arena-unit.is-hero').first();
    const heroBox = await firstHero.boundingBox();
    const arenaBox = await arena.boundingBox();
    if (heroBox && arenaBox) {
      await page.mouse.move(heroBox.x + heroBox.width / 2, heroBox.y + heroBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        arenaBox.x + arenaBox.width * 0.55,
        arenaBox.y + arenaBox.height * 0.65,
      );
      await page.mouse.up();
    }

    // Trigger an active skill from the bottom dock
    await page.locator('.skill-btn').first().click();

    // Verify no horizontal overflow inside Battlefield Arena
    const battleOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(battleOverflow).toBeFalsy();

    // Retreat back to Realm
    await page.locator('.hud-btn-retreat').click();
    await expect(page.locator('#starter-title')).toBeVisible();

    // 6. Navigate to Status diagnostics via top nav
    await page.locator('#nav-link-status').click();
    await expect(page).toHaveURL(/.*status/);
    await expect(page.locator('#status-heading')).toBeVisible();

    // 7. Navigate back to Realm
    await page.locator('#back-home-link').click();
    await expect(page).toHaveURL(/\/?$/);
    await expect(page.locator('#starter-title')).toBeVisible();

    // 8. Zero unhandled console errors or exceptions
    expect(consoleErrors).toEqual([]);
  });
});

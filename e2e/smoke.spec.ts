import { test, expect } from '@playwright/test';

test.describe('Responsive Shell Smoke Tests', () => {
  test('should load application cleanly without runtime errors or horizontal overflow', async ({
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
    await expect(page.locator('.brand-title')).toBeVisible();
    await expect(page.locator('#starter-title')).toHaveText('Angular PWA Starter');

    // 2. Primary layout elements are visible
    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();

    // 3. Prevent accidental horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // 4. Client-side navigation to status screen
    const statusLink = page.locator('#view-status-btn');
    await expect(statusLink).toBeVisible();
    await statusLink.click();

    await expect(page).toHaveURL(/.*status/);
    await expect(page.locator('#status-heading')).toBeVisible();
    await expect(page.locator('#base-uri-val')).toBeVisible();

    // Verify no horizontal overflow on secondary route
    const statusOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(statusOverflow).toBeFalsy();

    // 5. Navigate back to Home
    await page.locator('#back-home-link').click();
    await expect(page).toHaveURL(/\/?$/);
    await expect(page.locator('#starter-title')).toBeVisible();

    // 6. Zero unhandled console errors or exceptions
    expect(consoleErrors).toEqual([]);
  });
});

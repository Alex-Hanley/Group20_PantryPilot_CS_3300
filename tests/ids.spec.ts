import { test, expect, type Page } from '@playwright/test';

async function addItem(page: Page, name: string, quantity: string, unit: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Quantity', { exact: true }).fill(quantity);
  await page.getByLabel('Unit', { exact: true }).fill(unit);
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
}

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe('without crypto.randomUUID (plain-HTTP origin)', () => {
  test.beforeEach(async ({ page }) => {
    // Browsers omit randomUUID outside secure contexts; simulate that here.
    await page.addInitScript(() => { delete (Crypto.prototype as { randomUUID?: unknown }).randomUUID; });
    await page.goto('/');
  });

  test('items can still be added, removed independently, and reloaded', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await addItem(page, 'Beans', '2', 'can');
    await addItem(page, 'Rice', '1', 'kg');
    const inventory = page.getByRole('region', { name: 'Inventory' });
    await expect(inventory.getByRole('heading', { name: 'Beans' })).toBeVisible();
    await expect(inventory.getByRole('heading', { name: 'Rice' })).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Remove Beans', exact: true }).click();
    await page.reload();
    await expect(inventory.getByRole('heading', { name: 'Beans' })).toHaveCount(0);
    await expect(inventory.getByRole('heading', { name: 'Rice' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('generated item and history ids are unique v4 UUIDs', async ({ page }) => {
    await addItem(page, 'Beans', '2', 'can');
    await addItem(page, 'Rice', '1', 'kg');
    const ids = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('pantrypilot.inventory.v1')!);
      return [...saved.items, ...saved.history].map((entry: { id: string }) => entry.id);
    });
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(uuidV4);
  });
});
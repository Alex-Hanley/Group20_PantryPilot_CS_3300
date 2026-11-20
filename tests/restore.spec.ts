import { test, expect, type Page } from '@playwright/test';

async function addItem(page: Page, name: string, quantity: string, unit: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Quantity', { exact: true }).fill(quantity);
  await page.getByLabel('Unit', { exact: true }).fill(unit);
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// 0.14 + 1 is 1.1400000000000001 in floating point; 0.36 + 1 is 1.3599999999999999.
for (const [start, restored] of [['0.14', '1.14'], ['0.36', '1.36']]) {
  test(`restoring ${start} kg shows ${restored} kg and the full amount can be consumed`, async ({ page }) => {
    await addItem(page, 'Salt', start, 'kg');
    await page.getByRole('button', { name: 'Restore 1 kg of Salt', exact: true }).click();
    const inventory = page.getByRole('region', { name: 'Inventory' });
    await expect(inventory.getByText(`${restored} kg`, { exact: true })).toBeVisible();

    await page.getByLabel('Amount to consume for Salt').fill(restored);
    await page.getByRole('button', { name: 'Consume Salt', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(inventory.getByText('0 kg', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Consume Salt', exact: true })).toBeDisabled();
  });
}

test('restored quantity survives a reload without rounding noise', async ({ page }) => {
  await addItem(page, 'Flour', '0.57', 'kg');
  await page.getByRole('button', { name: 'Restore 1 kg of Flour', exact: true }).click();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pantrypilot.inventory.v1')!).items[0].quantity);
  expect(saved).toBe(1.57);
  await expect(page.getByText('Restored 1 kg of Flour', { exact: true })).toBeVisible();
});
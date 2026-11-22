import { test, expect, type Page } from '@playwright/test';

const storageKey = 'pantrypilot.inventory.v1';

async function addItem(page: Page, name: string, quantity: string, unit: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Quantity', { exact: true }).fill(quantity);
  await page.getByLabel('Unit', { exact: true }).fill(unit);
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
}

const item = { id: '1', name: 'Salt', quantity: 2, unit: 'kg', category: '', location: 'Pantry' };

// Each payload parses as JSON but must be rejected by the structural checks in load().
const invalidPayloads: Record<string, unknown> = {
  'a negative item quantity': { items: [{ ...item, quantity: -5 }], history: [] },
  'a non-array items field': { items: {}, history: [] },
  'a history entry with a non-string id': { items: [item], history: [{ id: 1, text: 'x', time: 't' }] },
};

for (const [label, payload] of Object.entries(invalidPayloads)) {
  test(`saved data with ${label} is reported and preserved`, async ({ page }) => {
    const raw = JSON.stringify(payload);
    await page.goto('/');
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [storageKey, raw]);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Saved pantry could not be loaded');
    await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeDisabled();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(raw);
  });
}

test('valid saved data loads without an alert', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value),
    [storageKey, JSON.stringify({ items: [item], history: [] })]);
  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Inventory' }).getByText('2 kg', { exact: true })).toBeVisible();
});

test.describe('with one item', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await addItem(page, 'Rice', '2', 'kg');
  });

  test('a whitespace-only consume amount is rejected without changing storage', async ({ page }) => {
    const before = await page.evaluate(key => localStorage.getItem(key), storageKey);
    await page.getByLabel('Amount to consume for Rice').fill('   ');
    await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a positive amount to consume.');
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(before);
  });

  test('dismissing the remove confirmation keeps the item', async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Remove Rice', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Inventory' }).getByRole('heading', { name: 'Rice' })).toBeVisible();
    await expect(page.getByText('Removed Rice', { exact: true })).toHaveCount(0);
  });

  test('removing the item being edited resets the form', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit item' })).toBeVisible();
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Remove Rice', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add a pantry item' })).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
    await expect(page.getByText('Removed Rice', { exact: true })).toBeVisible();
  });

  test('a blank item name is rejected', async ({ page }) => {
    await page.getByLabel('Name', { exact: true }).fill('   ');
    await page.getByLabel('Quantity', { exact: true }).fill('1');
    await page.getByLabel('Unit', { exact: true }).fill('kg');
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a name, unit, location');
    await expect(page.getByRole('region', { name: 'Inventory' }).getByRole('listitem')).toHaveCount(1);
  });
  test('a failed storage write keeps an edit open and the saved item unchanged', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Brown rice');
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alert')).toContainText('Could not save changes');
    await expect(page.getByRole('heading', { name: 'Edit item' })).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Brown rice');
    await expect(page.getByRole('region', { name: 'Inventory' }).getByRole('heading', { name: 'Rice', exact: true })).toBeVisible();
  });

  test('a failed storage write during removal keeps the item', async ({ page }) => {
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Remove Rice', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Could not save changes');
    await expect(page.getByRole('region', { name: 'Inventory' }).getByRole('heading', { name: 'Rice' })).toBeVisible();
    await expect(page.getByText('Removed Rice', { exact: true })).toHaveCount(0);
  });
});

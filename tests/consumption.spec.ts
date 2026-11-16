import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill('Rice');
  await page.getByLabel('Quantity', { exact: true }).fill('2.5');
  await page.getByLabel('Unit', { exact: true }).fill('kg');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
});

test('fractional consumption persists stock and an accurate activity entry', async ({ page }) => {
  await page.getByLabel('Amount to consume for Rice').fill('0.5');
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Inventory' }).getByText('2 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Consumed 0.5 kg of Rice', { exact: true })).toBeVisible();
});

test('the exact remaining amount can be consumed', async ({ page }) => {
  await page.getByLabel('Amount to consume for Rice').fill('2.5');
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Inventory' }).getByText('0 kg', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Consume Rice', exact: true })).toBeDisabled();
});

for (const amount of ['0', '-1', '3', '', 'abc', 'Infinity']) {
  test(`invalid amount ${JSON.stringify(amount)} does not change stock or history`, async ({ page }) => {
    const before = await page.evaluate(() => localStorage.getItem('pantrypilot.inventory.v1'));
    await page.getByLabel('Amount to consume for Rice').fill(amount);
    await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Inventory' }).getByText('2.5 kg', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('pantrypilot.inventory.v1'))).toBe(before);
  });
}

test('decimal subtraction leaves a usable remainder', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('0.3');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByLabel('Amount to consume for Rice').fill('0.1');
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Inventory' }).getByText('0.2 kg', { exact: true })).toBeVisible();
  await page.getByLabel('Amount to consume for Rice').fill('0.2');
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Inventory' }).getByText('0 kg', { exact: true })).toBeVisible();
});

test('a failed storage write does not report consumption or change inventory', async ({ page }) => {
  const before = await page.evaluate(() => localStorage.getItem('pantrypilot.inventory.v1'));
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByLabel('Amount to consume for Rice').fill('0.5');
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save changes');
  await expect(page.getByRole('region', { name: 'Inventory' }).getByText('2.5 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Consumed 0.5 kg of Rice', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pantrypilot.inventory.v1'))).toBe(before);
});

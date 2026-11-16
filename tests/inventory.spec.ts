import { test, expect } from '@playwright/test';

test('inventory workflow persists items and activity across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill('Rice');
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByLabel('Unit', { exact: true }).fill('kg');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const inventory = page.getByRole('region', { name: 'Inventory' });
  await expect(inventory.getByText('2 kg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await expect(inventory.getByText('1 kg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore 1 kg of Rice', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Brown rice');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(inventory.getByRole('heading', { name: 'Brown rice' })).toBeVisible();
  await expect(inventory.getByText('2 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Consumed 1 kg of Rice', { exact: true })).toBeVisible();
  await page.getByLabel('Search pantry').fill('beans');
  await expect(page.getByText('No matching items.')).toBeVisible();
  await page.getByLabel('Search pantry').fill('rice');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove Brown rice', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Your pantry is empty. Add your first item above.')).toBeVisible();
  await expect(page.getByText('Removed Brown rice', { exact: true })).toBeVisible();
});

test('negative quantities are rejected and empty items cannot be consumed', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill('Milk');
  await page.getByLabel('Quantity', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Milk', exact: true })).toHaveCount(0);
  await page.getByLabel('Quantity', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Consume Milk', exact: true })).toBeDisabled();
});

test('invalid saved data is preserved and reported', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pantrypilot.inventory.v1', '{invalid'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Saved pantry could not be loaded');
  await expect(page.getByRole('button', { name: 'Add item', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('pantrypilot.inventory.v1'))).toBe('{invalid');
});

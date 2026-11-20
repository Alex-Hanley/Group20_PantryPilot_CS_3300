import { test, expect, type Page } from '@playwright/test';

async function addItem(page: Page, name: string, quantity: string, unit: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Quantity', { exact: true }).fill(quantity);
  await page.getByLabel('Unit', { exact: true }).fill(unit);
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await addItem(page, 'Rice', '2', 'kg');
});

test('stock actions are paused for the item being edited', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Consume Rice', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restore 1 kg of Rice', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Amount to consume for Rice')).toBeDisabled();
  await expect(page.getByText('Editing. Save or cancel to consume or restore.')).toBeVisible();
});

test('saving an unrelated edit keeps the quantity and re-enables stock actions', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
  await page.getByLabel('Category (optional)').fill('Grains');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const inventory = page.getByRole('region', { name: 'Inventory' });
  await expect(inventory.getByText('2 kg', { exact: true })).toBeVisible();
  await expect(inventory.getByText('Grains · Pantry')).toBeVisible();
  await expect(page.getByText('Editing. Save or cancel to consume or restore.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consume Rice', exact: true }).click();
  await expect(inventory.getByText('1 kg', { exact: true })).toBeVisible();
});

test('cancelling an edit re-enables stock actions', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Consume Rice', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Restore 1 kg of Rice', exact: true })).toBeEnabled();
});

test('other items can be consumed while one is being edited, and saving keeps that change', async ({ page }) => {
  await addItem(page, 'Beans', '3', 'can');
  await page.getByRole('button', { name: 'Edit Rice', exact: true }).click();
  await page.getByRole('button', { name: 'Consume Beans', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();

  const inventory = page.getByRole('region', { name: 'Inventory' });
  await expect(inventory.getByText('2 can', { exact: true })).toBeVisible();
  await expect(inventory.getByText('2 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Consumed 1 can of Beans', { exact: true })).toBeVisible();
});
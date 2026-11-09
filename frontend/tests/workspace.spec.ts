import { expect, test } from '@playwright/test';

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

test('messages preserve drafts, stay in their conversation, and distinguish acknowledgement', async ({ page }) => {
  await page.goto(story('screens-workspace--messages'));
  const message = page.getByRole('textbox', { name: 'Message', exact: true });
  await message.fill('Keep this draft while I inspect the incident.');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Incident', exact: true }).click();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: /Messages/ }).click();
  await expect(message).toHaveValue('Keep this draft while I inspect the incident.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Keep this draft while I inspect the incident.', { exact: true })).toBeVisible();
  await expect(page.getByText('Local preview message / not delivered')).toBeVisible();
  await page.getByRole('button', { name: /Payment verification.*Emmanuel to you/ }).click();
  await expect(page.getByText('Keep this draft while I inspect the incident.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByText('Acknowledged by Jubril', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Database coordination.*Sammy, Emmanuel, you/ }).click();
  await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toBeVisible();
});

test('parts require resolution notes and an incident cannot close with open work', async ({ page }) => {
  await page.goto(story('screens-workspace--incident'));
  await page.getByRole('button', { name: 'Close incident', exact: true }).click();
  await page.getByRole('textbox', { name: 'Resolution summary' }).fill('Everything has recovered.');
  await expect(page.getByRole('button', { name: 'Confirm close' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Take this' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Resolve', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Record resolution' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'How was this resolved?' }).fill('Verified the sample recovery evidence.');
    await page.getByRole('button', { name: 'Record resolution' }).click();
  }
  await page.getByRole('button', { name: 'Close incident', exact: true }).click();
  await page.getByRole('textbox', { name: 'Resolution summary' }).fill('The crew verified recovery of all three parts.');
  await page.getByRole('button', { name: 'Confirm close' }).click();
  await expect(page.getByRole('heading', { name: 'The record', exact: true })).toBeVisible();
  await expect(page.getByText('CLOSED', { exact: true })).toBeVisible();
});

test('reconnection retains context and prevents sending new actions', async ({ page }) => {
  await page.goto(story('states-incident--reconnecting'));
  await expect(page.getByText('Connection interrupted.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close incident', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: /Messages/ }).click();
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Wait for the connection to recover.');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
});

test('dialog supports Escape and restores focus', async ({ page }) => {
  await page.goto(story('screens-workspace--incident'));
  const close = page.getByRole('button', { name: 'Close incident', exact: true });
  await close.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(close).toBeFocused();
});

test('wall mode presents the incident without mutation controls', async ({ page }) => {
  await page.goto(story('screens-workspace--wall-screen'));
  await expect(page.getByRole('heading', { name: 'Check-in kiosks failing at Hall B' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close incident', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Take this' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveCount(0);
});

test('screens render without runtime errors and fit a narrow viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['screens-workspace--incident', 'screens-workspace--messages', 'screens-workspace--crew', 'screens-workspace--record', 'screens-workspace--join', 'states-incident--no-active-incident', 'design-system-foundations--palette-and-components']) {
    await page.goto(story(id));
    await expect(page.locator('#storybook-root')).not.toBeEmpty();
    await expect(page.locator('.cm-app, .cm-foundations')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), id).toBe(true);
  }
  expect(errors).toEqual([]);
});

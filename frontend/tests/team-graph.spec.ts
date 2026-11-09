import { expect, test } from '@playwright/test';

const story = '/iframe.html?id=screens-team-graph--relationships&viewMode=story';

test('arcs stay hidden at rest and appear for the hovered or selected team', async ({ page }) => {
  await page.goto(story);
  const registration = page.getByRole('button', { name: /^Registration/ });
  await expect(registration).toBeVisible();
  await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible();
  await expect(page.locator('.cm-graph-tree')).toHaveCount(3);
  await expect(page.locator('.cm-graph-arc')).toHaveCount(0);

  await page.getByRole('button', { name: /^Platform/ }).hover();
  await expect(page.locator('.cm-graph-arc')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Ticketing/ })).toHaveClass(/is-faded/);

  await registration.click();
  await page.mouse.move(0, 0);
  await expect(registration).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cm-graph-arc')).toHaveCount(4);
  const inspector = page.getByRole('complementary', { name: 'Team relationships' });
  await expect(inspector.getByText('Registration depends on Platform')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('focus')).toBe('team:registration');

  await page.getByRole('button', { name: 'Messaged' }).click();
  await expect(page.getByRole('button', { name: 'Messaged' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cm-graph-arc.is-messaged')).toHaveCount(0);
  await expect(page.locator('.cm-graph-arc')).toHaveCount(2);
});

test('the graph fits a narrow viewport and keeps relationships readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story);
  await page.getByRole('button', { name: /^Platform/ }).click();
  await expect(page.getByRole('complementary', { name: 'Team relationships' }).getByText('Messaged with Registration')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test('loading and unavailable states are explicit', async ({ page }) => {
  await page.goto('/iframe.html?id=screens-team-graph--loading&viewMode=story');
  await expect(page.getByRole('status')).toContainText('Loading the team graph');
  await page.goto('/iframe.html?id=screens-team-graph--unavailable&viewMode=story');
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

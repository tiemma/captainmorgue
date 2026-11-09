import { expect, test } from '@playwright/test';

test('requests reveal supporting context without hiding the approval action', async ({ page }) => {
  await page.goto('/iframe.html?id=screens-workspace--messages&viewMode=story');
  const thread = page.getByRole('region', { name: 'Selected coordination thread' });
  for (const name of ['Evidence', 'History', 'Details']) {
    const disclosure = thread.locator('details').filter({ has: page.locator('summary').filter({ hasText: new RegExp(`^${name}$`) }) });
    await expect(disclosure).not.toHaveAttribute('open');
  }
  await expect(page.getByRole('button', { name: 'Approve and send reply' })).toBeVisible();
  await thread.locator('summary').filter({ hasText: /^Evidence$/ }).click();
  await expect(thread.getByText('Ask received in agent context', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Database coordination/ }).click();
  await expect(thread.getByText('Ask received in agent context', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Give input to agent' })).toBeVisible();
});

test('inspector stays in the page, resizes, remembers width and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto('/iframe.html?id=screens-workspace--messages&viewMode=story');
  const trigger = page.getByRole('button', { name: /Why this agent/ });
  await trigger.click();
  const panel = page.getByRole('complementary', { name: 'Evidence inspector' });
  const handle = page.getByRole('separator', { name: 'Resize Evidence inspector' });
  await expect(panel).toBeVisible();
  await handle.focus();
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '360');
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '376');
  const mainBox = await page.locator('main').boundingBox();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.x).toBeGreaterThanOrEqual(mainBox!.x + mainBox!.width - 1);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(handle).toHaveAttribute('aria-valuenow', '376');
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + 4, box!.y + 40);
  await page.mouse.down();
  await page.mouse.move(box!.x - 60, box!.y + 40);
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '440');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toHaveAttribute('data-stacked', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.getByRole('button', { name: 'Close Evidence inspector' }).click();
  await expect(panel).toHaveCount(0);
});

test('record timeline distinguishes active work from closure and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/iframe.html?id=screens-workspace--active-record&viewMode=story');
  const timeline = page.getByRole('region', { name: 'Timeline', exact: true });
  await expect(timeline.getByText('Active', { exact: true })).toBeVisible();
  await expect(timeline.getByRole('listitem')).toHaveCount(4);
  await expect(timeline.getByText('Awaiting payment verification', { exact: true })).toBeVisible();
  expect(await page.locator('.cm-response-active-dot').evaluate(node => getComputedStyle(node, '::after').animationName)).toBe('none');
  await page.goto('/iframe.html?id=screens-workspace--record&viewMode=story');
  await expect(timeline.getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.locator('.cm-response-active-dot')).toHaveCount(0);
  await expect(timeline.getByText('The sample incident was closed')).toBeVisible();
});

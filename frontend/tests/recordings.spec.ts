import { expect, test } from '@playwright/test';

const lookupTitle = 'Check-in lookup exhausted the shared database pool';

test('a postmortem lists the commands that resolved it, apart from checks and failed attempts', async ({ page }) => {
  await page.goto('/iframe.html?id=screens-postmortems--library&viewMode=story');
  await page.getByRole('button', { name: new RegExp(lookupTitle) }).click();
  await expect(page.getByRole('heading', { name: 'Commands that resolved it' })).toBeVisible();
  const resolving = page.locator('.cm-postmortem-commands > li');
  await expect(resolving).toHaveCount(2);
  await expect(resolving.first()).toContainText('kubectl rollout undo deployment/checkin -n conference');
  await expect(page.locator('.cm-postmortem-commands')).not.toContainText('rollout restart statefulset/confdb');
  await page.getByText('All commands run').click();
  await expect(page.locator('.cm-postmortem-all-commands > li')).toHaveCount(6);
  await expect(page.locator('.cm-postmortem-all-commands')).toContainText('failed / exit 1 / change');
});

test('the timeline shows what ran at each point on hover and colour codes each step', async ({ page }) => {
  await page.goto('/iframe.html?id=screens-postmortems--library&viewMode=story');
  await page.getByRole('button', { name: new RegExp(lookupTitle) }).click();
  const axis = page.getByRole('group', { name: 'Incident timeline' });
  await expect(axis.getByRole('button')).toHaveCount(11);
  await axis.getByRole('button', { name: /rollout undo deployment\/checkin/ }).hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('kubectl rollout undo deployment/checkin -n conference');
  await expect(tip).toContainText('exit 0 / led to the resolution');
  await axis.getByRole('button', { name: /rollout undo deployment\/checkin/ }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toContainText('Hold the confdb restart');

  const legend = page.getByRole('list', { name: 'Timeline colours' });
  await expect(legend).toContainText('Commands and claims');
  await expect(legend).toContainText('Conflicts');
  const work = await page.locator('.cm-record-steps li[data-category="work"] .cm-record-step-marker').first().evaluate((node) => getComputedStyle(node).backgroundColor);
  const alert = await page.locator('.cm-record-steps li[data-category="alert"] .cm-record-step-marker').first().evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(work).not.toBe(alert);
});

test('the incident activity feed colour codes events by kind with a legend', async ({ page }) => {
  await page.goto('/iframe.html?id=screens-workspace--incident&viewMode=story');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const legend = page.getByRole('list', { name: 'Event colours' });
  await expect(legend).toContainText('Investigation');
  await expect(legend).toContainText('Decisions');
  const colours = await page.locator('.cm-feed > .cm-event[data-category]').evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node, '::before').backgroundColor));
  expect(new Set(colours).size).toBeGreaterThan(2);
});

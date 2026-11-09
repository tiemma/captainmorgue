import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  for (const profile of [
    { actor: 'agent-checkin', team: 'registration', role: 'commander', task: 'Inspect check-in', repo: 'conference', tools: ['Radar'] },
    { actor: 'agent-platform', team: 'platform', role: 'scribe', task: 'Inspect confdb', repo: 'infrastructure', tools: ['kubectl'] },
  ]) expect((await request.post('/incidents/INC-LOCAL-VERIFY/join', { data: profile })).ok()).toBeTruthy();
  expect((await request.post('/events', { data: { actor: 'agent-checkin', team: 'registration', type: 'investigation', text: 'Verified query contention in check-in.', artifacts: [{ label: 'Query evidence', url: 'https://example.com/evidence' }] } })).ok()).toBeTruthy();
  expect((await request.post('/claims', { data: { actor: 'agent-platform', text: 'Review database configuration', resource: { namespace: 'conference', kind: 'Deployment', name: 'confdb' } } })).ok()).toBeTruthy();
  for (const [command, outcome] of [['kubectl get pods -n conference', 'ok'], ['kubectl rollout restart deployment/confdb -n conference', 'ok']]) {
    expect((await request.post('/events', { data: { actor: 'agent-platform', team: 'platform', type: 'action', tool: 'Bash', command, outcome, text: `Bash: ${command} (${outcome})` } })).ok()).toBeTruthy();
  }
});

test('real service feeds incident, claims, crew profiles and record', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Local verification', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Commander agent-checkin', { exact: true })).toBeVisible();
  await expect(page.getByText('Verified query contention in check-in.', { exact: true })).toBeVisible();
  await expect(page.getByText('conference/deployment/confdb', { exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  await nav.getByRole('button', { name: 'Crew', exact: true }).click();
  await expect(page.getByText('Inspect check-in', { exact: true })).toBeVisible();
  await expect(page.getByText('Inspect confdb', { exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByText('Verified query contention in check-in.', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Incident timeline' }).getByRole('button')).not.toHaveCount(0);
  await nav.getByRole('button', { name: 'Postmortems', exact: true }).click();
  await expect(page.getByText('SAMPLE-2041')).toHaveCount(0);
  await page.getByRole('button', { name: /Local verification/ }).click();
  await expect(page.getByRole('heading', { name: 'Commands that resolved it' })).toBeVisible();
  const resolving = page.locator('.cm-postmortem-commands');
  await expect(resolving.getByText('kubectl rollout restart deployment/confdb -n conference', { exact: true })).toBeVisible();
  await expect(resolving.getByText('kubectl get pods -n conference', { exact: true })).toHaveCount(0);
  await page.getByRole('group', { name: 'Incident timeline' }).getByRole('button', { name: /kubectl rollout restart deployment\/confdb/ }).hover();
  await expect(page.getByRole('tooltip')).toContainText('kubectl rollout restart deployment/confdb -n conference');
  await expect(page.getByRole('tooltip')).toContainText('led to the resolution');
});

test('postmortem and record APIs serve the recorded steps and commands', async ({ request }) => {
  const [postmortem] = await (await request.get('/postmortems')).json();
  expect(postmortem.id).toBe('INC-LOCAL-VERIFY');
  const restart = postmortem.commands.find((run: { command: string }) => run.command === 'kubectl rollout restart deployment/confdb -n conference');
  expect(restart).toMatchObject({ tool: 'Bash', outcome: 'ok', changed: true, led_to_resolution: true, actor: 'agent-platform' });
  expect(postmortem.commands.find((run: { command: string }) => run.command === 'kubectl get pods -n conference')).toMatchObject({ changed: false, led_to_resolution: false });
  expect(postmortem.steps.some((step: { kind: string; text: string }) => step.kind === 'investigated' && step.text === 'Verified query contention in check-in.')).toBeTruthy();
  const record = await (await request.get('/record/INC-LOCAL-VERIFY')).json();
  expect(record.commands.length).toBe(postmortem.commands.length);
  expect((await request.get('/postmortems/INC-NOPE')).status()).toBe(404);
});

test('team graph renders the roster tree and the arcs the service derives', async ({ page, request }) => {
  const graph = await (await request.get('/api/graph')).json();
  expect(graph.links.some((link: { means: string; a: string; b: string }) =>
    link.means === 'shared_incident' && [link.a, link.b].sort().join() === 'team:platform,team:registration')).toBeTruthy();
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Teams', exact: true }).click();
  const registration = page.getByRole('button', { name: /^Registration/ });
  await expect(registration).toContainText('agent-checkin');
  await expect(page.getByRole('button', { name: /^Platform/ })).toContainText('confdb');
  await registration.click();
  await expect(page.locator('.cm-graph-arc.is-shared_incident')).toHaveCount(1);
  await expect(page.getByRole('complementary', { name: 'Team relationships' }).getByText('Shared incident with Platform')).toBeVisible();
});

test('explicit browser join sends a real ask and renders service delivery state', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await page.getByLabel('Actor', { exact: true }).fill('browser-responder');
  await page.getByRole('combobox', { name: 'Team', exact: true }).selectOption('registration');
  await page.getByLabel('Task', { exact: true }).pressSequentially('Coordinate verification');
  await expect(page.getByLabel('Task', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Join incident', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Requests', exact: true }).click();
  await page.getByLabel('To', { exact: true }).fill('agent-platform');
  await page.getByLabel('Message', { exact: true }).fill('Can you verify confdb recovery?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Can you verify confdb recovery?', { exact: true })).toBeVisible();
  const record = await (await request.get('/record/INC-LOCAL-VERIFY')).json();
  expect(record.events.some((event: {text:string;actor:string}) => event.text === 'Can you verify confdb recovery?' && event.actor === 'browser-responder')).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

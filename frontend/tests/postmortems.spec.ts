import { expect, test } from "@playwright/test";

const story = (name: string) =>
  `/iframe.html?id=screens-postmortems--${name}&viewMode=story`;
const lookupTitle = "Check-in lookup exhausted the shared database pool";
const kioskTitle = "Hall A kiosks retained an outdated check-in endpoint";
const poolTitle = "Confdb connections remained open after an attendee import";

test("search narrows the archive and the full document preserves context on return", async ({
  page,
}) => {
  await page.goto(story("library"));
  await expect(
    page.getByRole("heading", { name: "Postmortems", exact: true }),
  ).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search postmortems" });
  await search.fill("outdated");
  const result = page.getByRole("button", { name: new RegExp(kioskTitle) });
  await expect(result).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(lookupTitle) }),
  ).toHaveCount(0);
  await result.click();
  await expect(
    page.getByRole("heading", { name: kioskTitle, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Summary", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Resolution", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prevention", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to postmortems" }).click();
  await expect(search).toHaveValue("outdated");
  await expect(result).toBeFocused();
  await expect(
    page.getByRole("button", { name: new RegExp(poolTitle) }),
  ).toHaveCount(0);
});

test("a postmortem exposes the complete summary, each resolution, timeline, and owned follow-ups", async ({
  page,
}) => {
  await page.goto(story("library"));
  await page.getByRole("button", { name: new RegExp(lookupTitle) }).click();
  await expect(
    page.getByRole("heading", { name: lookupTitle, exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText(/Registration and Platform coordinated a canary abort/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Restore check-in responses",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Drain confdb connections safely",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Correct the attendee lookup",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Active connections fell from 96 to 41 without interrupting/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Timeline", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recovery verified and incident closed", { exact: true }),
  ).toBeVisible();
  const prevention = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Prevention", exact: true }),
    });
  await expect(
    prevention.getByText(
      "Check query plans for new attendee lookups before release.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    prevention.getByText(
      "Alert on sustained confdb connection pool saturation.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(prevention.getByText("Platform", { exact: true })).toBeVisible();
});

test("no search matches is distinct from an empty archive and can be cleared", async ({
  page,
}) => {
  await page.goto(story("library"));
  const search = page.getByRole("searchbox", { name: "Search postmortems" });
  await search.fill("no-matching-incident-xyz");
  await expect(
    page.getByRole("heading", { name: "No matches", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No postmortems yet", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(
    page.getByRole("button", { name: new RegExp(lookupTitle) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(kioskTitle) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(poolTitle) }),
  ).toBeVisible();
  await page.goto(story("empty"));
  await expect(
    page.getByRole("heading", { name: "No postmortems yet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear search", exact: true }),
  ).toHaveCount(0);
});

test("loading and unavailable are explicit and retry can recover the sample archive", async ({
  page,
}) => {
  await page.goto(story("loading"));
  await expect(
    page.getByText("Loading postmortems", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No postmortems yet", exact: true }),
  ).toHaveCount(0);
  await page.goto(story("unavailable"));
  await expect(
    page.getByRole("heading", { name: "Unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("The incident archive could not be loaded.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(lookupTitle) }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unavailable", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(lookupTitle) }),
  ).toBeVisible();
});

test("the archive and full documents remain readable without horizontal overflow on mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story("library"));
  await expect(
    page.getByRole("button", { name: new RegExp(lookupTitle) }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: new RegExp(lookupTitle) }).click();
  await expect(
    page.getByRole("heading", { name: lookupTitle, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Prevention", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "Include a physical kiosk check in the recovery checklist.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

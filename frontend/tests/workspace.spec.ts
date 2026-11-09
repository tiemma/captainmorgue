import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;
const workspaceNav = (page: Page) =>
  page.getByRole("navigation", { name: "Workspace" });
const selectedThread = (page: Page) =>
  page.getByRole("region", { name: "Selected coordination thread" });
const threadButton = (page: Page, title: string) =>
  page
    .getByRole("complementary", { name: "Coordination threads" })
    .getByRole("button", { name: new RegExp(title) });

async function openHistory(page: Page) {
  const history = selectedThread(page)
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: /^History/ }) });
  await expect(history).toBeVisible();
  if ((await history.getAttribute("open")) === null) {
    await history.locator("summary").click();
  }
}

async function openComposer(page: Page) {
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  if (!(await message.isVisible())) {
    await page.getByRole("button", { name: /Ask through my agent/ }).click();
  }
  return message;
}

test("agent asks preserve drafts and recipients without leaking between conversations", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--messages"));
  const message = await openComposer(page);
  const recipients = page.getByRole("combobox", { name: "Message recipients" });
  await recipients.selectOption("Sammy");
  await message.fill("Keep this draft while I inspect the incident.");
  await workspaceNav(page)
    .getByRole("button", { name: "Incident", exact: true })
    .click();
  await workspaceNav(page)
    .getByRole("button", { name: /Requests/ })
    .click();
  await expect(message).toHaveValue(
    "Keep this draft while I inspect the incident.",
  );
  await expect(recipients).toHaveValue("Sammy");
  await threadButton(page, "Database coordination").click();
  await expect(message).toHaveValue("");
  await message.fill("A separate database question.");
  await recipients.selectOption("Platform team");
  await threadButton(page, "Payment verification").click();
  await expect(message).toHaveValue(
    "Keep this draft while I inspect the incident.",
  );
  await expect(recipients).toHaveValue("Sammy");
  await page
    .getByRole("button", { name: "Send ask through agent", exact: true })
    .click();
  await openHistory(page);
  await expect(
    selectedThread(page).getByText(
      "Keep this draft while I inspect the incident.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByText(
      "To Sammy via CaptainMorgue / no real delivery",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByRole("button", {
      name: "Approve and send reply",
    }),
  ).toBeVisible();
  await threadButton(page, "Database coordination").click();
  await expect(
    page.getByText("Keep this draft while I inspect the incident.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(message).toHaveValue("A separate database question.");
  await expect(recipients).toHaveValue("Platform team");
});

test("human acknowledgement does not approve a reply or acknowledge another ask", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--messages"));
  await openHistory(page);
  await selectedThread(page)
    .getByRole("button", { name: "Acknowledge ask", exact: true })
    .click();
  await expect(
    selectedThread(page).getByText("Human acknowledged by Jubril", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByRole("button", {
      name: "Approve and send reply",
    }),
  ).toBeEnabled();
  await expect(
    selectedThread(page).getByText("Human-approved answer", { exact: true }),
  ).toHaveCount(0);
  await expect(threadButton(page, "Payment verification")).toContainText(
    "Awaiting approval",
  );
  await threadButton(page, "Database coordination").click();
  await openHistory(page);
  await expect(
    selectedThread(page).getByRole("button", { name: "Acknowledge ask" }),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByText("Human acknowledged by Jubril", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("only explicit approval sends the edited proposed reply and marks its ask answered", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--messages"));
  await page.getByRole("button", { name: "Edit reply", exact: true }).click();
  const editedReply =
    "Errors are back to baseline. Keep this open until we verify a real card payment.";
  await page
    .getByRole("textbox", { name: "Proposed reply", exact: true })
    .fill(editedReply);
  await expect(threadButton(page, "Payment verification")).toContainText(
    "Awaiting approval",
  );
  await page
    .getByRole("button", { name: "Approve and send reply", exact: true })
    .click();
  await expect(
    selectedThread(page).getByText("Human-approved answer", { exact: true }),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByText(editedReply, { exact: true }),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByText(
      "Approved by Jubril / sample reply routed to Emmanuel",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(threadButton(page, "Payment verification")).toContainText(
    "Answered",
  );
  await expect(threadButton(page, "Database coordination")).toContainText(
    "Needs your input",
  );
  await expect(
    page.getByRole("button", { name: "Approve and send reply" }),
  ).toHaveCount(0);
});

test("returning a proposal requires feedback and keeps the ask unanswered while the agent works", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--messages"));
  await page
    .getByRole("button", { name: "Return to agent", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Return with feedback", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Feedback for agent" })
    .fill(
      "Check the last five minutes of payment failures before proposing an answer.",
    );
  await page
    .getByRole("button", { name: "Return with feedback", exact: true })
    .click();
  await expect(
    selectedThread(page).getByText("Agent is investigating", { exact: true }),
  ).toBeVisible();
  await expect(threadButton(page, "Payment verification")).toContainText(
    "Agent working",
  );
  await expect(
    selectedThread(page).getByText("Human-approved answer", { exact: true }),
  ).toHaveCount(0);
  await expect(
    selectedThread(page).getByText(
      /Your instruction: Check the last five minutes/,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show sample proposed reply" })
    .click();
  await expect(threadButton(page, "Payment verification")).toContainText(
    "Awaiting approval",
  );
  await expect(
    page.getByRole("button", { name: "Approve and send reply" }),
  ).toBeVisible();
});

test("a timeout status update is distinct from an answer and from agent context received", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--messages"));
  await threadButton(page, "Platform handoff").click();
  await expect(
    selectedThread(page).getByText("Automated status update. Not an answer.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByText("Ask remains open", { exact: true }),
  ).toBeVisible();
  await openHistory(page);
  await expect(
    selectedThread(page).getByText("Agent context not yet received", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    selectedThread(page).getByText("Human-approved answer", { exact: true }),
  ).toHaveCount(0);
  await expect(threadButton(page, "Platform handoff")).toContainText(
    "Escalated / no answer",
  );
});

test("progress labels remain clear and their indicators stop moving with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(story("screens-workspace--messages"));
  await expect(page.locator(".cm-progress-waiting")).toContainText(
    "Awaiting your approval",
  );
  await threadButton(page, "Connection recovery").click();
  await expect(page.locator(".cm-progress-working")).toContainText(
    "Agent is investigating",
  );
  await expect(page.locator(".cm-progress-working > svg")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page
    .getByRole("button", { name: "Show sample proposed reply" })
    .click();
  await expect(page.locator(".cm-progress-waiting")).toContainText(
    "Awaiting your approval",
  );
  await expect(page.locator(".cm-progress-waiting > svg")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("button", { name: "Approve and send reply" }).click();
  await expect(page.locator(".cm-progress-done")).toContainText(
    "Human-approved answer",
  );
  await expect(page.locator(".cm-progress-done > svg")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("parts require resolution notes and an incident cannot close with open work", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--incident"));
  await page
    .getByRole("button", { name: "Close incident", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Resolution summary" })
    .fill("Everything has recovered.");
  await expect(
    page.getByRole("button", { name: "Confirm close" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Take this" }).click();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Resolve", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Record resolution" }),
    ).toBeDisabled();
    await page
      .getByRole("textbox", { name: "How was this resolved?" })
      .fill("Verified the sample recovery evidence.");
    await page.getByRole("button", { name: "Record resolution" }).click();
  }
  await page
    .getByRole("button", { name: "Close incident", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Resolution summary" })
    .fill("The crew verified recovery of all three parts.");
  await page.getByRole("button", { name: "Confirm close" }).click();
  await expect(
    page.getByRole("heading", { name: "Record", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
});

test("reconnection retains context but blocks asks, acknowledgements, approvals, and incident mutations", async ({
  page,
}) => {
  await page.goto(story("states-incident--reconnecting"));
  await expect(
    page.getByText("Connection interrupted.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close incident", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review conflict", exact: true }),
  ).toBeDisabled();
  await workspaceNav(page)
    .getByRole("button", { name: /Requests/ })
    .click();
  await openHistory(page);
  await expect(
    page.getByRole("button", { name: "Acknowledge ask" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Approve and send reply" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Return to agent" }),
  ).toBeDisabled();
  await (await openComposer(page)).fill("Wait for the connection to recover.");
  await expect(
    page.getByRole("button", { name: "Send ask through agent", exact: true }),
  ).toBeDisabled();
  await threadButton(page, "Database coordination").click();
  await page
    .getByRole("textbox", { name: "Input for agent" })
    .fill("A payment succeeded at the merch stand.");
  await expect(
    page.getByRole("button", { name: "Give input to agent" }),
  ).toBeDisabled();
});

test("dialog supports Escape and restores focus", async ({ page }) => {
  await page.goto(story("screens-workspace--incident"));
  const close = page.getByRole("button", {
    name: "Close incident",
    exact: true,
  });
  await close.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(close).toBeFocused();
});

test("wall mode presents the incident without mutation controls", async ({
  page,
}) => {
  await page.goto(story("screens-workspace--wall-screen"));
  await expect(
    page.getByRole("heading", { name: "Check-in kiosks failing at Hall B" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close incident", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Take this" })).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveCount(0);
});

test("screens render without runtime errors and fit a narrow viewport", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of [
    "screens-workspace--incident",
    "screens-workspace--messages",
    "screens-workspace--crew",
    "screens-workspace--record",
    "screens-workspace--join",
    "states-incident--no-active-incident",
    "design-system-foundations--palette-and-components",
  ]) {
    await page.goto(story(id));
    await expect(page.locator("#storybook-root")).not.toBeEmpty();
    await expect(page.locator(".cm-app, .cm-foundations")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      id,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

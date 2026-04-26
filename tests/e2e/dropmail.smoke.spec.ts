// @ts-nocheck
import { expect, test } from "@playwright/test";

test.describe("DropMail public smoke", () => {
  test("homepage renders the temporary address tool", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /receive mail/i })).toBeVisible();
    await expect(page.getByLabel(/dropmail mailbox/i)).toBeVisible();
    await expect(page.getByText(/@dropmail\./i)).toBeVisible();
    await expect(page.getByRole("button", { name: /copy address/i })).toBeVisible();
  });

  test("legal links render their public pages", async ({ page }) => {
    await page.goto("/");

    const expectedPages = [
      { name: /privacy/i, heading: /privacy notice/i, text: /no selling personal data/i },
      { name: /terms/i, heading: /terms of service/i, text: /receive-only/i },
      { name: /abuse/i, heading: /abuse contact/i, text: /abuse@dropmail\.local/i }
    ];

    for (const expectedPage of expectedPages) {
      await page.getByRole("link", { name: expectedPage.name }).click();
      await expect(page.getByRole("heading", { name: expectedPage.heading })).toBeVisible();
      await expect(page.getByText(expectedPage.text).first()).toBeVisible();
      await page.goto("/");
    }
  });

  test("admin metrics require authentication", async ({ request }) => {
    const response = await request.get("/api/admin/metrics");

    expect(response.status()).toBe(401);
  });
});

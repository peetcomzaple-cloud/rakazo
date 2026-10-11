import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("mobile integrations exposes Gmail, Drive and Microsoft apps and owner setup", async ({
  page,
}, testInfo) => {
  await page.route("**/rpc/integrationSetup/get", (route) =>
    route.fulfill({
      json: {
        json: {
          canConfigure: true,
          needsSetup: false,
          providers: [],
          webUrl: "https://example.test/integrations/setup",
        },
      },
    }),
  );
  await page.route("**/rpc/connections/catalog", (route) => route.fulfill({ json: { json: [] } }));
  await signup(page, `app-connections-${Date.now()}@rakazo.test`, "password12", "App Connections");
  await completeOnboarding(page);
  await page.getByText("Integrations", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const featured = page.getByTestId("featured-connectors");
  for (const name of ["Gmail", "Google Drive", "OneDrive", "Outlook"])
    await expect(featured.getByText(name, { exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "mobile-app-connections");
  await page.getByRole("button", { name: "Server integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Server integrations", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Composio", exact: true }).click();
  await expect(page.getByLabel("API key", { exact: true })).toHaveAttribute("type", "password");
  await captureScreenshot(page, testInfo, "mobile-app-provider-setup");
});

import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("chooses a model in chat, persists it and returns to automatic", async ({
  page,
}, testInfo) => {
  await signup(page, `chat-model-${Date.now()}@rakazo.test`, "password12", "Model Selection");
  await completeOnboarding(page);
  await rpc(page, "models/connect", {
    provider: "openai-compatible",
    baseUrl: "http://127.0.0.1:8090/v1",
    modelId: "test-chat-model",
    apiKey: "fake-test-key",
    supportsImages: false,
  });
  const picker = page.getByTestId("chat-model-picker");
  await expect(picker).toContainText("Automatic");
  await picker.click();
  await page.getByRole("textbox", { name: "Search models" }).fill("test-chat-model");
  const model = page.getByRole("combobox", { name: "Model", exact: true });
  await expect(model).toContainText("test-chat-model");
  await captureScreenshot(page, testInfo, "chat-model-picker-search");
  await model.selectOption("openai-compatible::test-chat-model");
  await expect(picker).toContainText("test-chat-model");
  await page.reload();
  await expect(picker).toContainText("test-chat-model");
  await picker.click();
  await expect(
    page.getByText(
      "This model cannot see screenshots. Select an image-capable model for desktop control.",
    ),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Model", exact: true }).selectOption("");
  await expect(picker).toContainText("Automatic");
  await page.reload();
  await expect(picker).toContainText("Automatic");
  await page.setViewportSize({ width: 390, height: 844 });
  await picker.click();
  await expect(page.getByRole("textbox", { name: "Search models" })).toBeVisible();
  await captureScreenshot(page, testInfo, "chat-model-picker-mobile");
});

// @vitest-environment jsdom
import type { Bot } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("../../lib/rpc", () => ({ rpc: { models: { credentials: vi.fn(), list: vi.fn() } } }));
vi.mock("@rakazo/ui-web", () => {
  let openPopover = () => {};
  return {
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" {...props} />
    ),
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    // Render the opened content to exercise loading, persistence and errors without positioning.
    Popover: ({
      children,
      onOpenChange,
    }: {
      children: ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => {
      openPopover = () => onOpenChange(true);
      return children;
    },
    PopoverTrigger: ({ children }: { children: ReactNode }) => (
      <button type="button" onClick={() => openPopover()}>
        {children}
      </button>
    ),
    PopoverContent: ({ children }: { children: ReactNode }) => children,
  };
});

import { rpc } from "../../lib/rpc";
import { ChatModelPicker } from "./chat-model-picker";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let props: ComponentProps<typeof ChatModelPicker>;
beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(rpc.models.credentials).mockResolvedValue([
    {
      id: "cred-1",
      provider: "connected",
      label: "Connected",
      hasKey: true,
      isDefault: true,
      modelId: "custom-alias",
    },
  ]);
  vi.mocked(rpc.models.list).mockResolvedValue([
    {
      provider: "connected",
      id: "small-model",
      label: "Small",
      billing: "",
      supportsImages: false,
    },
    {
      provider: "connected",
      id: "strong-model",
      label: "Strong",
      billing: "",
      supportsImages: true,
    },
    { provider: "disconnected", id: "other-model", label: "Other", billing: "" },
  ]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  props = {
    bot: { id: "bot-1", modelProvider: null, modelId: null } as Bot,
    onChange: vi.fn().mockResolvedValue(undefined),
    onManageModels: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => root.render(<ChatModelPicker {...props} />));
  // The first rendered button is the popover trigger in this positioning-free fixture.
  await act(async () => container.querySelector("button")?.click());
}
async function select(value: string) {
  await act(async () => {
    const element = container.querySelector("select");
    if (!element) throw new Error("Missing model picker");
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("chat model picker", () => {
  it("labels image capabilities and warns on text-only selections without assuming unknown models can see", async () => {
    props.bot = { ...props.bot, modelProvider: "connected", modelId: "small-model" };
    await render();
    expect(container.textContent).toContain("Strong · Images");
    expect(container.textContent).toContain("Small · Text only");
    expect(container.textContent).toContain("custom-alias · Image support unknown");
    expect(container.textContent).toContain("This model cannot see screenshots.");
  });
  it("offers automatic, saved custom IDs and connected catalog models without disconnected providers", async () => {
    await render();
    expect([...container.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "",
      "connected::custom-alias",
      "connected::small-model",
      "connected::strong-model",
    ]);
    await select("connected::strong-model");
    expect(props.onChange).toHaveBeenCalledWith({
      modelProvider: "connected",
      modelId: "strong-model",
      thinkingLevel: null,
    });
  });
  it("clears the native bot override when switching back to automatic", async () => {
    props.bot = { ...props.bot, modelProvider: "connected", modelId: "strong-model" };
    await render();
    await select("");
    expect(props.onChange).toHaveBeenCalledWith({
      modelProvider: null,
      modelId: null,
      thinkingLevel: null,
    });
  });
  it("searches model IDs and preserves the current selection while filtering", async () => {
    props.bot = { ...props.bot, modelProvider: "connected", modelId: "custom-alias" };
    await render();
    await act(async () => {
      const input = container.querySelector("input");
      if (!input) throw new Error("Missing search");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "strong-model",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect([...container.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "",
      "connected::custom-alias",
      "connected::strong-model",
    ]);
  });
  it("shows save errors without claiming a changed model", async () => {
    vi.mocked(props.onChange).mockRejectedValue(new Error("Could not change model"));
    await render();
    await select("connected::strong-model");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not change model");
    expect(container.querySelector("select")?.value).toBe("");
  });
});

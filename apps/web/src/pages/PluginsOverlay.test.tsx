// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core", () => ({
  _t: (_i18n: unknown, descriptor: { message?: string } | string) =>
    typeof descriptor === "string" ? descriptor : (descriptor?.message ?? ""),
  i18n: { _: (m: any) => (typeof m === "string" ? m : m?.message ?? "") },
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
  Plural: () => null,
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
  Plural: () => null,
  I18nProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    connections: { catalog: vi.fn(), list: vi.fn() },
    capabilities: { list: vi.fn(), catalogSearch: vi.fn() },
    integrationSetup: { get: vi.fn() },
  },
}));
vi.mock("../components/integrations/IntegrationSetup", () => ({
  IntegrationSetup: ({ serverSetup, onDone }: { serverSetup: boolean; onDone: () => void }) => (
    <button type="button" onClick={onDone}>
      {serverSetup ? "Save server connection" : "Add MCP connection"}
    </button>
  ),
}));
vi.mock("@rakazo/ui-web", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
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
    Card: Box,
    CardContent: Box,
    CardHeader: Box,
    CardTitle: Box,
    Dialog: Box,
    DialogClose: Box,
    DialogContent: Box,
    DialogHeader: Box,
    DialogTitle: Box,
  };
});

import { rpc } from "../lib/rpc";
import { PluginsOverlay } from "./PluginsOverlay";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(rpc.connections.catalog).mockResolvedValue([]);
  vi.mocked(rpc.connections.list).mockResolvedValue([]);
  vi.mocked(rpc.capabilities.list).mockResolvedValue([]);
  vi.mocked(rpc.capabilities.catalogSearch).mockResolvedValue({ enabled: false, results: [] });
  vi.mocked(rpc.integrationSetup.get).mockResolvedValue({
    canConfigure: true,
    needsSetup: true,
    providers: [],
    webUrl: "https://example.test/integrations/setup",
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render() {
  await act(async () => root.render(<PluginsOverlay onClose={vi.fn()} />));
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === text,
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  await act(async () => button.click());
}

it("shows the requested apps with an owner setup path before any catalog exists", async () => {
  await render();
  for (const name of ["Gmail", "Google Drive", "OneDrive", "Outlook"])
    expect(container.textContent).toContain(name);
  await click("Server integrations");
  expect(container.textContent).toContain("Save server connection");
  await click("Save server connection");
  expect(rpc.connections.catalog).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain("Save server connection");
});

it("does not expose server credential setup to a non-owner while retaining direct MCP", async () => {
  vi.mocked(rpc.integrationSetup.get).mockResolvedValue({
    canConfigure: false,
    needsSetup: false,
    providers: [],
    webUrl: "https://example.test/integrations/setup",
  });
  await render();
  expect(container.textContent).not.toContain("Server integrations");
  await click("Browse MCP servers");
  expect(container.textContent).toContain("Add MCP connection");
});

it("shows a setup load failure instead of offering a connection that cannot work", async () => {
  vi.mocked(rpc.integrationSetup.get).mockRejectedValue(
    new Error("Integration settings unavailable"),
  );
  await render();
  expect(container.textContent).toContain("Integration settings unavailable");
  expect(container.textContent).not.toContain("Server integrations");
});

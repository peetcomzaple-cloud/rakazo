import { describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-agent-core", () => ({
  Agent: class {
    state = { errorMessage: "WebSocket closed 1006", messages: [] };

    subscribe() {}
    async prompt() {}
    async waitForIdle() {}
    abort() {}
  },
}));

vi.mock("@earendil-works/pi-ai/providers/all", () => ({
  builtinModels: () => ({
    getModel: () => ({ provider: "openai-codex", id: "gpt-test" }),
    streamSimple: vi.fn(),
  }),
}));

vi.mock("./pi-current-models.js", () => ({
  supplementPiModels: (models: unknown) => models,
}));

vi.mock("./pi-local-provider.js", () => ({
  registerLocalProvider: (models: unknown) => models,
}));

vi.mock("./pi-openai-compatible-provider.js", () => ({
  OPENAI_COMPATIBLE_PROVIDER_ID: "openai-compatible",
  registerOpenAiCompatibleCatalog: (models: unknown) => models,
  registerOpenAiCompatibleRuntime: (models: unknown) => models,
}));

import { PiAgentRuntime } from "./pi-runtime.js";

describe("Pi runtime errors", () => {
  it("keeps the actual provider error and reports the failure in Thai", async () => {
    await expect(
      (async () => {
        for await (const _event of new PiAgentRuntime().run({
          botId: "bot",
          threadId: "thread",
          runId: "thai-error",
          prompt: "อ่านหน้าเว็บให้หน่อย",
          instructions: "test",
          history: [],
          tools: [],
          model: { provider: "openai-codex", id: "gpt-test" },
        })) {
        }
      })(),
    ).rejects.toThrow("งานหยุดก่อนสำเร็จ รายละเอียด: WebSocket closed 1006");
  });
  it("propagates provider failures instead of completing with error text", async () => {
    const runtime = new PiAgentRuntime();
    const consume = async () => {
      for await (const _event of runtime.run(
        {
          botId: "bot",
          threadId: "thread",
          runId: "run",
          prompt: "continue",
          instructions: "test",
          history: [],
          tools: [],
          model: { provider: "openai-codex", id: "gpt-test" },
        },
        {
          operationId: "operation",
          traceId: "trace",
          spaceId: "workspace",
          userId: "user",
          signal: new AbortController().signal,
        },
      )) {
        // Consume the stream so terminal failures surface to the executor.
      }
    };

    await expect(consume()).rejects.toThrow("WebSocket closed 1006");
  });
});

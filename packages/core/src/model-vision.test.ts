import { describe, expect, it } from "vitest";
import { isVisionModelId } from "./model-vision.js";

describe("isVisionModelId", () => {
  it("identifies Gemini models as vision capable", () => {
    expect(isVisionModelId("google/gemini-3.1-flash-lite")).toBe(true);
    expect(isVisionModelId("google/gemini-2.5-pro")).toBe(true);
  });

  it("identifies Claude 3 and Sonnet/Haiku/Opus models as vision capable", () => {
    expect(isVisionModelId("anthropic/claude-3-7-sonnet")).toBe(true);
    expect(isVisionModelId("anthropic/claude-3-haiku")).toBe(true);
    expect(isVisionModelId("anthropic/claude-opus-4")).toBe(true);
  });

  it("identifies GPT-4o, GPT-5, o1, and o3 models as vision capable", () => {
    expect(isVisionModelId("openai/gpt-4o")).toBe(true);
    expect(isVisionModelId("openai/gpt-4o-mini")).toBe(true);
    expect(isVisionModelId("openai/gpt-5")).toBe(true);
    expect(isVisionModelId("openai/o1")).toBe(true);
    expect(isVisionModelId("openai/o3-mini")).toBe(true);
  });

  it("identifies vision language models (-vl / /vl)", () => {
    expect(isVisionModelId("qwen/qwen-2.5-vl-72b-instruct")).toBe(true);
    expect(isVisionModelId("meta-llama/llama-3.2-11b-vision-instruct")).toBe(true);
  });

  it("returns false for text-only models and empty/null inputs", () => {
    expect(isVisionModelId("deepseek/deepseek-chat")).toBe(false);
    expect(isVisionModelId("meta-llama/llama-3.3-70b-instruct")).toBe(false);
    expect(isVisionModelId("")).toBe(false);
    expect(isVisionModelId(null)).toBe(false);
    expect(isVisionModelId(undefined)).toBe(false);
  });
});

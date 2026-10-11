/** Known patterns for models that accept image/multimodal input. */
export function isVisionModelId(id: string | null | undefined): boolean {
  if (!id) return false;
  const lower = id.toLowerCase();
  return (
    lower.includes("gemini") ||
    lower.includes("vision") ||
    lower.includes("-vl") ||
    lower.includes("/vl") ||
    lower.includes("claude-3") ||
    lower.includes("claude-sonnet") ||
    lower.includes("claude-haiku") ||
    lower.includes("claude-opus") ||
    lower.includes("gpt-4o") ||
    lower.includes("gpt-4-turbo") ||
    lower.includes("gpt-4.5") ||
    lower.includes("gpt-5") ||
    lower.includes("gpt-6") ||
    lower.includes("o1") ||
    lower.includes("o3")
  );
}

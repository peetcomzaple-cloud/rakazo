/** A run-scoped budget, restored from existing effect results after an approval resume. */
export class BrowserRecovery {
  private failures = 0;
  private uncertain = false;
  private lastError = "";

  constructor(effects: Array<{ kind: string; result: unknown }> = []) {
    for (const effect of effects) this.record(effect.kind, effect.result);
  }

  record(name: string, result: unknown): void {
    if (name !== "browser_act" && name !== "computer_act") return;
    if (!result || typeof result !== "object") return;
    const value = result as Record<string, unknown>;
    if (value.error || value.ok === false) {
      if (name === "browser_act") {
        this.failures += 1;
        this.uncertain ||= value.uncertain === true || Number(value.completed ?? 0) > 0;
        this.lastError = String(value.error || "Page action was not confirmed");
      }
    } else {
      this.failures = 0;
      this.uncertain = false;
      this.lastError = "";
    }
  }

  blockedResult(): Record<string, unknown> | undefined {
    if (this.failures < 2 && !this.uncertain) return undefined;
    return this.unresolvedResult();
  }

  unresolvedResult(): Record<string, unknown> | undefined {
    if (this.failures === 0 && !this.uncertain) return undefined;
    return {
      ok: false,
      completed: 0,
      uncertain: this.uncertain,
      error: `Page actions paused after a browser failure: ${this.lastError}`,
      fallback: "computer_act",
      note: "Do not retry browser_act or request another approval for it in this run. Use computer_observe to inspect the actual screen, then computer_act for the remaining work, or request_takeover if desktop tools are unavailable. Never repeat completed or uncertain actions. Do not claim the requested task succeeded without evidence.",
    };
  }
}

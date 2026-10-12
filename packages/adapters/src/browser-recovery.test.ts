import { describe, expect, it } from "vitest";
import { BrowserRecovery } from "./browser-recovery.js";

const stale = { ok: false, completed: 0, uncertain: false, error: "Stale element ref" };

describe("browser failure recovery", () => {
  it("allows one fresh attempt, then blocks across approval resumes and snapshots", () => {
    const recovery = new BrowserRecovery([{ kind: "browser_act", result: stale }]);
    expect(recovery.blockedResult()).toBeUndefined();
    // One failed click is still not a completed task, even before the retry limit.
    expect(recovery.unresolvedResult()).toMatchObject({ completed: 0, ok: false });
    recovery.record("browser_snapshot", { ok: true });
    recovery.record("browser_act", stale);
    expect(recovery.blockedResult()).toMatchObject({ fallback: "computer_act", uncertain: false });
    recovery.record("browser_snapshot", { ok: true });
    expect(recovery.blockedResult()).toBeDefined();
  });

  it.each([
    { completed: 1, uncertain: false },
    { completed: 0, uncertain: true },
  ])("does not replay a partial or uncertain mutation: %s", (progress) => {
    const recovery = new BrowserRecovery([
      { kind: "browser_act", result: { ...stale, ...progress } },
    ]);
    expect(recovery.blockedResult()).toMatchObject({ uncertain: true });
  });

  it("clears the failure only after a successful action, not a failed fallback", () => {
    const effects = [
      { kind: "browser_act", result: stale },
      { kind: "browser_act", result: stale },
    ];
    const recovery = new BrowserRecovery(effects);
    recovery.record("computer_act", { error: "Screen unavailable" });
    expect(recovery.blockedResult()).toBeDefined();
    recovery.record("computer_act", { completed: 1 });
    expect(recovery.blockedResult()).toBeUndefined();
    expect(recovery.unresolvedResult()).toBeUndefined();
    expect(
      new BrowserRecovery([
        ...effects,
        { kind: "computer_act", result: { completed: 1 } },
      ]).blockedResult(),
    ).toBeUndefined();
  });
});

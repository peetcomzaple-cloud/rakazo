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

  describe("navigation failure recovery", () => {
    const nxdomainFailure = {
      ok: false,
      url: "https://flick.mdcu.ac.th/",
      hostname: "flick.mdcu.ac.th",
      error: "net::ERR_NAME_NOT_RESOLVED",
      errorCode: "NXDOMAIN",
      errorKind: "nxdomain",
      retryable: false,
      suggestions: ["https://flick.docchula.com/"],
      note: "เปิด flick.mdcu.ac.th ไม่ได้ เพราะตรวจไม่พบชื่อโดเมนใน DNS",
    };

    it("records navigation failure and blocks browser_act", () => {
      const recovery = new BrowserRecovery([
        { kind: "browser_navigate", result: nxdomainFailure },
      ]);
      const actBlocked = recovery.blockedResult("browser_act");
      expect(actBlocked).toBeDefined();
      expect(actBlocked?.error).toContain("navigation to https://flick.mdcu.ac.th/ failed");

      const unresolved = recovery.unresolvedResult();
      expect(unresolved).toBeDefined();
      expect(unresolved?.errorCode).toBe("NXDOMAIN");
      expect(unresolved?.fallback).toBeUndefined(); // Fallback to computer_act suppressed for NXDOMAIN
      expect(unresolved?.suggestions).toEqual(["https://flick.docchula.com/"]);
    });

    it("blocks retrying the same NXDOMAIN host via browser_navigate or computer_act", () => {
      const recovery = new BrowserRecovery([
        { kind: "browser_navigate", result: nxdomainFailure },
      ]);

      // Retrying the same unresolvable URL is blocked
      const navBlocked = recovery.blockedResult("browser_navigate", {
        url: "https://flick.mdcu.ac.th/another-page",
      });
      expect(navBlocked).toBeDefined();
      expect(navBlocked?.errorCode).toBe("NXDOMAIN");

      // Desktop fallback trying to open the unresolvable host is also blocked
      const desktopBlocked = recovery.blockedResult("computer_act", {
        action: "launch",
        application: "google-chrome",
        uri: "https://flick.mdcu.ac.th/",
      });
      expect(desktopBlocked).toBeDefined();
      expect(desktopBlocked?.errorCode).toBe("NXDOMAIN");
    });

    it("allows navigating to a different verified URL", () => {
      const recovery = new BrowserRecovery([
        { kind: "browser_navigate", result: nxdomainFailure },
      ]);
      const diffNav = recovery.blockedResult("browser_navigate", {
        url: "https://flick.docchula.com/",
      });
      expect(diffNav).toBeUndefined();
    });

    it("clears navigation failure only when browser_navigate succeeds, not on snapshot or computer_act", () => {
      const recovery = new BrowserRecovery([
        { kind: "browser_navigate", result: nxdomainFailure },
      ]);

      // Snapshot does NOT clear navigation failure
      recovery.record("browser_snapshot", { ok: true, title: "about:blank" });
      expect(recovery.unresolvedResult()).toBeDefined();

      // computer_act click does NOT clear navigation failure
      recovery.record("computer_act", { completed: 1 });
      expect(recovery.unresolvedResult()).toBeDefined();

      // Successful browser_navigate DOES clear navigation failure
      recovery.record("browser_navigate", {
        ok: true,
        url: "https://flick.docchula.com/",
        title: "Flick Chula",
      });
      expect(recovery.unresolvedResult()).toBeUndefined();
      expect(recovery.blockedResult("browser_act")).toBeUndefined();
    });
  });

  describe("stale ref pre-dispatch recovery and idempotency", () => {
    it("guides model to take fresh snapshot before retrying browser_act on stale ref", () => {
      const recovery = new BrowserRecovery([{ kind: "browser_act", result: stale }]);
      // Without fresh snapshot, browser_act is blocked with guidance
      const blocked = recovery.blockedResult("browser_act");
      expect(blocked).toBeDefined();
      expect(blocked?.failedBeforeDispatch).toBe(true);
      expect(blocked?.retryable).toBe(true);
      expect(String(blocked?.error)).toContain("Call browser_snapshot");

      // Recording a successful snapshot unblocks browser_act for retry
      recovery.record("browser_snapshot", { ok: true, elements: [] });
      expect(recovery.blockedResult("browser_act")).toBeUndefined();

      // Successful retry clears all failures
      recovery.record("browser_act", { ok: true, completed: 1 });
      expect(recovery.blockedResult("browser_act")).toBeUndefined();
      expect(recovery.unresolvedResult()).toBeUndefined();
    });

    it("locks and falls back to computer_act if stale ref fails twice after snapshots", () => {
      const recovery = new BrowserRecovery([{ kind: "browser_act", result: stale }]);
      recovery.record("browser_snapshot", { ok: true });
      recovery.record("browser_act", stale);
      const blocked = recovery.blockedResult("browser_act");
      expect(blocked).toBeDefined();
      expect(blocked?.fallback).toBe("computer_act");
      expect(String(blocked?.note)).toContain("Do not retry browser_act");
    });

    it("never permits replaying an action that was uncertain or partially completed", () => {
      const partial = new BrowserRecovery([
        { kind: "browser_act", result: { ok: false, completed: 1, uncertain: false, error: "timeout" } },
      ]);
      expect(partial.blockedResult("browser_act")).toBeDefined();
      expect(partial.blockedResult("browser_act")?.uncertain).toBe(true);

      const uncertain = new BrowserRecovery([
        { kind: "browser_act", result: { ok: false, completed: 0, uncertain: true, error: "network reset" } },
      ]);
      expect(uncertain.blockedResult("browser_act")).toBeDefined();
      expect(uncertain.blockedResult("browser_act")?.uncertain).toBe(true);
    });
  });
});

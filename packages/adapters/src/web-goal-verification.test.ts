import { describe, expect, it } from "vitest";
import {
  isLoginFormTask,
  isScreenshotRequest,
  isWebNavigationTask,
  isWindowCloseTask,
  verifyWebGoal,
} from "./web-goal-verification.js";

describe("web goal verification", () => {
  it("detects screenshot requests accurately in Thai and English", () => {
    expect(isScreenshotRequest("ขอดูภาพหน้าจอปัจจุบันหน่อย")).toBe(true);
    expect(isScreenshotRequest("ขอภาพหน้าจอ")).toBe(true);
    expect(isScreenshotRequest("ถ่ายภาพหน้าจอ")).toBe(true);
    expect(isScreenshotRequest("ขอดูหน้าจอหน่อย")).toBe(true);
    expect(isScreenshotRequest("take a screenshot")).toBe(true);
    expect(isScreenshotRequest("show me the screen")).toBe(true);

    expect(isScreenshotRequest("JSON คืออะไร")).toBe(false);
    expect(isScreenshotRequest("เปิดเว็บ https://example.com")).toBe(false);
  });

  it("distinguishes window close from open requests (Thai เปิด vs ปิด)", () => {
    expect(isWindowCloseTask("ปิดหน้าต่างนี้")).toBe(true);
    expect(isWindowCloseTask("ปิด chromium")).toBe(true);
    expect(isWindowCloseTask("ปิดมุมขวากว่านั้น")).toBe(true);
    expect(isWindowCloseTask("close window")).toBe(true);
    expect(isWindowCloseTask("quit browser")).toBe(true);

    // เปิด (open) must NEVER match as ปิด (close)
    expect(isWindowCloseTask("เปิดเบราว์เซอร์ไปที่ https://example.com")).toBe(false);
    expect(isWindowCloseTask("เปิดเว็บ https://example.com")).toBe(false);
    expect(isWindowCloseTask("เปิด example.com")).toBe(false);
    expect(isWindowCloseTask("เปิดคลิป NS3")).toBe(false);
  });

  it("detects navigation requests", () => {
    expect(isWebNavigationTask("เปิด flick mdcu แล้วเข้า year3 แล้วเลือก NS3")).toBe(true);
    expect(isWebNavigationTask("กด More information ในเว็บเมื่อกี้")).toBe(true);
    expect(isWebNavigationTask("พิมพ์ กรุงเทพ ในช่องค้นหา แล้วกดค้นหา")).toBe(true);
    expect(isWebNavigationTask("JSON คืออะไร ตอบสั้น ๆ")).toBe(false);
  });

  it("fails verification when screenshot was requested but no artifact attached", () => {
    const res = verifyWebGoal("ขอดูภาพหน้าจอปัจจุบันหน่อย", {
      actionsAttempted: 1,
      screenArtifactAttached: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("ไม่พบภาพหน้าจอที่แนบจริง");
  });

  it("passes verification when screenshot was requested and artifact was attached", () => {
    const res = verifyWebGoal("ขอดูภาพหน้าจอปัจจุบันหน่อย", {
      actionsAttempted: 1,
      screenArtifactAttached: true,
    });
    expect(res.ok).toBe(true);
  });

  it("fails verification when web action failed without recovery", () => {
    const res = verifyWebGoal("กด new", {
      actionsAttempted: 1,
      lastActionOk: false,
      lastActionError: "Stale element ref",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Stale element ref");
  });

  it("fails verification on no-op clicks that remain stranded on /home", () => {
    const res = verifyWebGoal("เปิด flick mdcu แล้วเข้า year3 แล้วเลือก NS3", {
      actionsAttempted: 2,
      lastActionOk: true,
      initialUrl: "https://example.com/home",
      currentUrl: "https://example.com/home",
      domStateChanged: false,
      screenChanged: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("ตรวจพบว่าหน้าเว็บยังคงอยู่ที่เดิม (no-op)");
  });

  it("passes verification when URL changed", () => {
    const res = verifyWebGoal("กด new", {
      actionsAttempted: 1,
      lastActionOk: true,
      initialUrl: "https://news.ycombinator.com/",
      currentUrl: "https://news.ycombinator.com/newest",
      domStateChanged: true,
    });
    expect(res.ok).toBe(true);
  });

  it("passes verification on SPA when DOM state changed even if URL is same", () => {
    const res = verifyWebGoal("เลือกแท็บประวัติ", {
      actionsAttempted: 1,
      lastActionOk: true,
      initialUrl: "https://app.test/dashboard",
      currentUrl: "https://app.test/dashboard",
      domStateChanged: true,
    });
    expect(res.ok).toBe(true);
  });

  it("fails verification when tool limit was exceeded (evidence: เทสๆ 24 calls)", () => {
    const res = verifyWebGoal("เปิด flick แล้วกด sign in", {
      actionsAttempted: 24,
      toolLimitExceeded: true,
      toolLimit: 24,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("limit of 24 tool calls");
  });

  it("fails verification when closing a window but target window is still present (Chief incident)", () => {
    const res = verifyWebGoal("ปิด chromium", {
      actionsAttempted: 1,
      lastActionOk: true,
      lastActionVerified: false,
      targetWindowClosed: false,
      targetWindowClass: "chromium",
      windowsRemaining: [
        { id: "0x00600003", wmClass: "chromium.Chromium", title: "MDCU Lecture - Chromium" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("หน้าต่างเป้าหมายยังคงเปิดอยู่");
  });

  it("fails verification when closing a window action had verified=false", () => {
    const res = verifyWebGoal("ปิดมุมขวากว่านั้น", {
      actionsAttempted: 1,
      lastActionOk: true,
      lastActionVerified: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("verified=false");
  });

  it("passes verification when window close was verified", () => {
    const res = verifyWebGoal("ปิด chromium", {
      actionsAttempted: 1,
      lastActionOk: true,
      lastActionVerified: true,
      targetWindowClosed: true,
      targetWindowClass: "chromium",
      windowsRemaining: [{ id: "0x01800001", wmClass: "xterm.XTerm", title: "Terminal" }],
    });
    expect(res.ok).toBe(true);
  });

  it("fails verification when click was requested but only web_fetch was used (suite-d-3 incident)", () => {
    const res = verifyWebGoal("คลิกปุ่ม Array", {
      actionsAttempted: 1,
      browserClickAttempted: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("web_fetch ไม่สามารถทดแทนการคลิกได้");
  });

  it("fails verification when click was dispatched but verified=false without state change", () => {
    const res = verifyWebGoal("กดปุ่ม SIGN IN", {
      actionsAttempted: 1,
      lastActionOk: true,
      lastActionVerified: false,
      browserClickAttempted: true,
      domStateChanged: false,
      screenChanged: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("verified=false");
  });

  it("fails verification when click was requested but 0 clicks attempted (no button found / snapshot only)", () => {
    const res = verifyWebGoal("กด More information", {
      actionsAttempted: 0,
      browserClickAttempted: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("ไม่พบการคลิกผ่านเบราว์เซอร์จริงตามเป้าหมายที่ร้องขอ");
  });

  it("does not treat informational inquiries about buttons as click tasks", () => {
    const res = verifyWebGoal("ถ้ากดปุ่มนี้แล้วจะเป็นอย่างไร?", {
      actionsAttempted: 0,
      browserClickAttempted: false,
    });
    expect(res.ok).toBe(true);
  });

  it("distinguishes login form requests from generic open/navigate prompts", () => {
    expect(isLoginFormTask("open the login page")).toBe(true);
    expect(isLoginFormTask("navigate to sign in form")).toBe(true);
    expect(isLoginFormTask("เปิดหน้าล็อกอินแล้วรอผมกรอก")).toBe(true);

    expect(isLoginFormTask("Open Multi-Origin Enterprise Portal")).toBe(false);
    expect(isLoginFormTask("navigate to https://example.com/dashboard")).toBe(false);
    expect(
      verifyWebGoal(
        "rakazo-record-playlist --urls https://localhost:18443/dashboard https://localhost:18443/sso/login",
        { actionsAttempted: 0, browserClickAttempted: false },
      ).ok,
    ).toBe(true);
  });
});

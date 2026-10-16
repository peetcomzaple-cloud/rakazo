/**
 * General-purpose web goal verification and task completion gating.
 * Enforces evidence-based task completion gates without site-specific hardcoding.
 */

export interface WebGoalState {
  actionsAttempted: number;
  lastActionOk?: boolean;
  lastActionError?: string;
  lastActionVerified?: boolean;
  httpStatus?: number;
  initialUrl?: string;
  currentUrl?: string;
  currentTitle?: string;
  selectedTargets?: string[];
  activeHeading?: string;
  domStateChanged?: boolean;
  screenChanged?: boolean;
  screenArtifactAttached?: boolean;
  toolLimitExceeded?: boolean;
  toolLimit?: number;
  browserClickAttempted?: boolean;
  desktopClickAttempted?: boolean;
  keyboardEnterAttempted?: boolean;
  searchAttempted?: boolean;
  searchSubmitted?: boolean;
  loginFormVisible?: boolean;
  activeModal?: string | boolean;
  navigationOnly?: boolean;
  targetWindowClosed?: boolean;
  windowsRemaining?: readonly { id: string; wmClass?: string; title?: string }[];
  targetWindowId?: string;
  targetWindowClass?: string;
  challengeDetected?: boolean;
  challengeType?: string;
}

/**
 * Detect whether the user's turn prompt is requesting a screenshot or screen capture.
 * Pure screen capture requests do not require vision-model interpretation to attach artifacts.
 */
export function isScreenshotRequest(prompt: string): boolean {
  const normalized = prompt.trim();
  const thaiCapture =
    /(?:ขอดู|ขอภาพ|ถ่ายภาพ|แคป|จับภาพ|บันทึกภาพ)(?:ภาพ)?(?:หน้าจอ|จอ)|(?:ภาพหน้าจอ|รูปหน้าจอ)(?:ปัจจุบัน)?(?:หน่อย|ด้วย)?/i;
  const engCapture =
    /\b(?:take\s+(?:a\s+)?screenshot|capture\s+(?:the\s+)?screen|show\s+(?:me\s+)?(?:the\s+)?(?:current\s+)?screen(?:shot)?)\b/i;
  return thaiCapture.test(normalized) || engCapture.test(normalized);
}

/**
 * Detect whether the prompt specifies an active web navigation or element selection task.
 */
export function isWebNavigationTask(prompt: string): boolean {
  const normalized = prompt.trim();
  const thaiNav =
    /(?:เปิดเว็บ|เข้าเว็บ|เข้า|เลือก|กด(?:ไป)?|คลิก(?:ไป)?|ไปยัง|ค้นหา|พิมพ์.*แล้วกดค้นหา)\s*[\w\u0E00-\u0E7F]/i;
  const engNav =
    /\b(?:open|navigate|go to|click|select|search for)\b/i;
  return thaiNav.test(normalized) || engNav.test(normalized);
}

/**
 * Detect whether the prompt specifies closing an application, window, or tab.
 */
export function isWindowCloseTask(prompt: string): boolean {
  const normalized = prompt.trim();
  const thaiClose =
    /(?:(?<!เ)ปิด|หุบ|(?<!เ)ปิดการทำงาน|(?<!เ)ปิดหน้าต่าง|(?<!เ)ปิดจอ|(?<!เ)ปิดแอพ|(?<!เ)ปิดโปรแกรม)(?:\s*(?:ของ)?\s*(?:หน้าต่าง|chromium|chrome|browser|เบราว์เซอร์|แอพ|โปรแกรม|จอ|หน้า|มุมขวา.*)?)?/i;
  const engClose =
    /\b(?:close|quit|exit|kill)\s+(?:window|tab|browser|chromium|chrome|app|screen)\b/i;
  return (thaiClose.test(normalized) && /(?:(?<!เ)ปิด|หุบ)/.test(normalized)) || engClose.test(normalized);
}

/**
 * Detect whether the prompt specifies clicking or selecting an interactive element.
 */
export function isClickTask(prompt: string): boolean {
  const normalized = prompt.trim();
  // Exclude purely informational queries or questions about buttons
  if (/(?:คืออะไร|ทำหน้าที่อะไร|อย่างไร|ใช่ไหม|หรือไม่|มี.*หรือไม่|\?)\s*$/i.test(normalized)) {
    return false;
  }
  if (isLoginFormTask(prompt)) {
    return false;
  }
  const thaiClick =
    /(?:กด|คลิก|เลือก|เปิดคลิป|ลงชื่อเข้าใช้|เข้าสู่ระบบ|ล็อกอิน|sign\s*in|log\s*in)/i;
  const engClick =
    /\b(?:click|press|select|sign\s*in|log\s*in|open\s+video)\b/i;
  return thaiClick.test(normalized) || engClick.test(normalized);
}

/**
 * Detect whether the prompt specifies a search task on a website.
 */
export function isSearchTask(prompt: string): boolean {
  const normalized = prompt.trim();
  if (/(?:คืออะไร|ทำหน้าที่อะไร|อย่างไร|ใช่ไหม|หรือไม่|\?)\s*$/i.test(normalized)) {
    return false;
  }
  const thaiSearch =
    /(?:ค้นหา|ค้น|เสิร์ช|มองหา|สืบค้น|(?<=[\s\b]|^|และ|แล้ว|ช่วย|ให้)หา(?!ร\b|ร[\sก-๙]))\s*[\w\u0E00-\u0E7F]+/i;
  const engSearch =
    /\b(?:search\s+(?:for\s+)?|find|look\s+up)\b/i;
  return thaiSearch.test(normalized) || engSearch.test(normalized);
}

/**
 * Detect whether the prompt specifies navigating to a login or signin form.
 */
export function isLoginFormTask(prompt: string): boolean {
  const normalized = prompt.trim();
  if (/(?:คืออะไร|ทำหน้าที่อะไร|อย่างไร|\?)\s*$/i.test(normalized)) {
    return false;
  }
  const thaiLoginForm =
    /(?:เปิดหน้ารอกรอก|เปิดหน้า(?:ล็อกอิน|เข้าสู่ระบบ|ลงชื่อเข้าใช้|sign\s*in|login)|ไปหน้า(?:ล็อกอิน|เข้าสู่ระบบ|ลงชื่อเข้าใช้|login|signin)|เข้าสู่ระบบ(?:ที่|\s*https?:)|ล็อกอิน(?:ที่|\s*https?:)|รอกรอก(?:เมล|รหัส|username|password)|รอ(?:ผม|ฉัน|เรา)?กรอก|เปิดหน้าไว้.*กรอกเอง|เปิดหน้า\s*(?:sign\s*in|login))/i;
  const engLoginForm =
    /\b(?:open|go\s+to|navigate\s+to|log\s*in\s+(?:to|at)|sign\s*in\s+(?:to|at))\s+(?:the\s+)?(?:login|signin|sign-in)?\s*(?:page|form|https?:|http:)?\b/i;
  return thaiLoginForm.test(normalized) || engLoginForm.test(normalized);
}

/**
 * Verify that a web/desktop interaction task produced independent evidence of goal completion.
 * Rejects false completion where input was dispatched but state remained stuck on home/no-op,
 * where target window was not verified closed, where search was only navigation to home,
 * or where web_fetch was claimed as a click.
 */
export function verifyWebGoal(
  prompt: string,
  state: WebGoalState,
): { ok: boolean; reason?: string } {
  // 1. Tool call budget exhaustion is an incomplete stop, never a completed run.
  if (state.toolLimitExceeded) {
    const limit = state.toolLimit ?? 24;
    return {
      ok: false,
      reason: `I stopped after reaching the limit of ${limit} tool calls in this turn. Send another message to continue.`,
    };
  }

  // 1b. Active challenge / CAPTCHA on the page means the goal is blocked, never a success.
  if (state.challengeDetected) {
    return {
      ok: false,
      reason: `งานยังไม่สำเร็จ: ตรวจพบแบบทดสอบความปลอดภัย (${state.challengeType || "CAPTCHA"}) ที่ต้องให้ผู้ใช้ช่วยยืนยันบนหน้าจอ`,
    };
  }
  if (
    state.currentTitle &&
    /(?:captcha|challenge|turnstile|hcaptcha|just a moment\.\.\.|security check)/i.test(state.currentTitle)
  ) {
    return {
      ok: false,
      reason: `งานยังไม่สำเร็จ: หน้าเว็บติดแบบทดสอบความปลอดภัย (${state.currentTitle})`,
    };
  }

  // 2. If screenshot was requested, ensure artifact was attached
  if (isScreenshotRequest(prompt) && !state.screenArtifactAttached) {
    return {
      ok: false,
      reason: "งานขอดูภาพหน้าจอไม่สำเร็จ: ไม่พบภาพหน้าจอที่แนบจริงในระบบ",
    };
  }

  // 3. If actions were attempted and the last action failed without recovery
  if (state.actionsAttempted > 0 && state.lastActionOk === false) {
    return {
      ok: false,
      reason: `การทำงานบนหน้าเว็บไม่สำเร็จ: ${state.lastActionError || "เกิดข้อผิดพลาดในการคลิกหรือทำงานบนหน้าเว็บ"}`,
    };
  }

  // 4. Window closing verification
  if (isWindowCloseTask(prompt)) {
    if (state.targetWindowClosed === false) {
      return {
        ok: false,
        reason: "การปิดหน้าต่างยังไม่สำเร็จ: หน้าต่างเป้าหมายยังคงเปิดอยู่ในระบบ",
      };
    }
    if (state.actionsAttempted > 0 && state.lastActionVerified === false && state.targetWindowClosed !== true) {
      return {
        ok: false,
        reason: "การปิดหน้าต่างยังไม่สำเร็จ: คำสั่งถูกส่งไปแต่ไม่ได้รับการยืนยันว่าหน้าต่างถูกปิดจริง (verified=false)",
      };
    }
    if (state.targetWindowClass && state.windowsRemaining) {
      const remaining = state.windowsRemaining.some((w) =>
        w.wmClass?.toLowerCase().includes(state.targetWindowClass!.toLowerCase()),
      );
      if (remaining) {
        return {
          ok: false,
          reason: `การปิดหน้าต่างยังไม่สำเร็จ: ตรวจพบหน้าต่าง ${state.targetWindowClass} ยังคงเปิดอยู่ในระบบ`,
        };
      }
    }
  }

  // 5. Search task verification:
  // Cannot be satisfied by mere navigation to homepage, typing without submit, or staying on homepage with language modal!
  if (isSearchTask(prompt)) {
    if (state.activeModal) {
      return {
        ok: false,
        reason: "งานค้นหายังไม่สำเร็จ: หน้าเว็บยังติดหน้าต่างเลือกภาษาหรือ modal บังอยู่ ยังไม่ถึงหน้าผลการค้นหา",
      };
    }

    const hasSearchSubmission =
      Boolean(state.searchSubmitted) ||
      Boolean(state.keyboardEnterAttempted) ||
      Boolean(
        state.domStateChanged &&
          state.currentUrl &&
          !state.currentUrl.endsWith("/") &&
          !state.currentUrl.endsWith("/home") &&
          /(?:search|results|query|find|\?q=|\?keyword=)/i.test(state.currentUrl),
      );

    if (state.navigationOnly && !hasSearchSubmission) {
      return {
        ok: false,
        reason: "งานค้นหายังไม่สำเร็จ: บอตเพียงเปิดหน้าแรกของเว็บไซต์ แต่ยังไม่ได้กรอกคำค้นหาหรือส่งคำค้นหาเพื่อแสดงผลลัพธ์",
      };
    }

    if (!hasSearchSubmission) {
      if (state.searchAttempted) {
        return {
          ok: false,
          reason: "งานค้นหายังไม่สำเร็จ: พิมพ์คำค้นหาแล้วแต่ยังไม่ได้กด Enter หรือส่งคำค้นหา (searchSubmitted เป็น false)",
        };
      }
      return {
        ok: false,
        reason: "งานค้นหายังไม่สำเร็จ: บอตยังไม่ได้กรอกคำค้นหาหรือส่งคำค้นหาเพื่อแสดงผลลัพธ์",
      };
    }

    if (
      state.actionsAttempted === 0 &&
      !state.domStateChanged &&
      !state.screenChanged &&
      !hasSearchSubmission
    ) {
      return {
        ok: false,
        reason: "งานค้นหายังไม่สำเร็จ: ไม่พบการค้นหาหรือผลการค้นหาตามที่ระบุ",
      };
    }

    if (
      state.initialUrl &&
      state.currentUrl &&
      state.initialUrl === state.currentUrl &&
      (state.currentUrl.endsWith("/") || state.currentUrl.endsWith("/home")) &&
      !hasSearchSubmission &&
      !state.domStateChanged
    ) {
      return {
        ok: false,
        reason: "งานค้นหายังไม่สำเร็จ: ตรวจพบว่ายังคงอยู่ที่หน้าแรก ไม่พบหลักฐานการค้นหาหรือผลการค้นหาที่ต้องการ",
      };
    }
  }

  // 6. Login form task verification:
  // Requesting to open the login page waiting for user to fill credentials requires reaching visible login form.
  // URL matching /login alone without a visible login form is rejected.
  if (isLoginFormTask(prompt)) {
    if (state.httpStatus && state.httpStatus >= 400) {
      return {
        ok: false,
        reason: `การเปิดหน้าล็อกอินไม่สำเร็จ: หน้าเว็บส่งกลับรหัสข้อผิดพลาด HTTP ${state.httpStatus}`,
      };
    }
    if (
      state.currentTitle &&
      /(?:Error 400|Error 403|Error 404|Error 500|Bad Request)/i.test(state.currentTitle)
    ) {
      return {
        ok: false,
        reason: `การเปิดหน้าล็อกอินไม่สำเร็จ: พบหน้าข้อผิดพลาด ${state.currentTitle}`,
      };
    }
    if (state.activeModal) {
      return {
        ok: false,
        reason: "การเปิดหน้าล็อกอินยังไม่สำเร็จ: หน้าเว็บยังติด modal บังอยู่ ยังไม่ถึงฟอร์มเข้าสู่ระบบ",
      };
    }

    if (!state.loginFormVisible) {
      return {
        ok: false,
        reason: "การเปิดหน้าล็อกอินยังไม่สำเร็จ: หน้าเว็บยังไม่พบฟอร์มสำหรับกรอกอีเมลและรหัสผ่านจริง (loginFormVisible เป็น false)",
      };
    }
  }

  // 7. Click and interactive element verification
  if (isClickTask(prompt)) {
    const clickExplicitlySkipped =
      state.browserClickAttempted === false &&
      state.desktopClickAttempted !== true &&
      state.keyboardEnterAttempted !== true;

    // web_fetch or web_search alone where click was explicitly skipped cannot satisfy a click requirement
    if (clickExplicitlySkipped && state.actionsAttempted > 0) {
      return {
        ok: false,
        reason: "งานคลิกหรือเลือกองค์ประกอบบนหน้าเว็บไม่สำเร็จ: ไม่พบการคลิกผ่านเบราว์เซอร์จริง (web_fetch ไม่สามารถทดแทนการคลิกได้)",
      };
    }
    // No actions attempted at all and no state/screen change occurred
    if (state.actionsAttempted === 0 && !state.domStateChanged && !state.screenChanged) {
      return {
        ok: false,
        reason: "งานคลิกหรือเลือกองค์ประกอบบนหน้าเว็บไม่สำเร็จ: ไม่พบการคลิกผ่านเบราว์เซอร์จริงตามเป้าหมายที่ร้องขอ",
      };
    }
    // Click dispatched but verified is false without any state or screen change
    if (
      state.actionsAttempted > 0 &&
      state.lastActionVerified === false &&
      !state.domStateChanged &&
      !state.screenChanged
    ) {
      return {
        ok: false,
        reason: "การทำงานบนหน้าเว็บไม่สำเร็จ: คำสั่งคลิกไม่ได้รับการยืนยันผลลัพธ์ (verified=false)",
      };
    }
  }

  // 8. Sub-navigation / selection no-op detection
  if (
    (!isLoginFormTask(prompt) || !state.loginFormVisible) &&
    isWebNavigationTask(prompt) &&
    state.actionsAttempted > 0 &&
    !state.domStateChanged &&
    !state.screenChanged &&
    state.initialUrl &&
    state.currentUrl &&
    state.initialUrl === state.currentUrl &&
    (state.currentUrl.endsWith("/home") || state.currentUrl.endsWith("/") || state.lastActionVerified === false)
  ) {
    return {
      ok: false,
      reason: "การทำงานบนหน้าเว็บยังไม่ถึงเป้าหมาย: ตรวจพบว่าหน้าเว็บยังคงอยู่ที่เดิม (no-op) ไม่มีการเปลี่ยนสถานะหรือไปยังหน้าที่ต้องการ",
    };
  }

  return { ok: true };
}

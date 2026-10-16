export interface NavigationFailureRecord {
  url: string;
  hostname: string;
  error: string;
  errorCode: string;
  errorKind: string;
  retryable: boolean;
  httpStatus?: number;
  suggestions?: string[];
  note?: string;
  attempts: number;
}

/** A run-scoped budget, restored from existing effect results after an approval resume. */
export class BrowserRecovery {
  private failures = 0;
  private staleRefFailures = 0;
  private snapshotSinceStale = false;
  private uncertain = false;
  private lastError = "";
  private navigationFailure?: NavigationFailureRecord;
  private challengeDetected = false;
  private challengeType?: string;
  private cdpDisconnected = false;

  constructor(effects: Array<{ kind: string; result: unknown }> = []) {
    for (const effect of effects) this.record(effect.kind, effect.result);
  }

  isChallengeDetected(): boolean {
    return this.challengeDetected;
  }

  getChallengeType(): string | undefined {
    return this.challengeType;
  }

  isCdpDisconnected(): boolean {
    return this.cdpDisconnected;
  }

  getNavigationFailure(): NavigationFailureRecord | undefined {
    return this.navigationFailure;
  }

  record(name: string, result: unknown): void {
    if (
      name !== "browser_act" &&
      name !== "computer_act" &&
      name !== "browser_navigate" &&
      name !== "browser_snapshot"
    ) {
      return;
    }
    if (!result || typeof result !== "object") return;
    const value = result as Record<string, unknown>;

    // Handle browser_snapshot: record fresh snapshot taken
    if (name === "browser_snapshot") {
      if (!value.error && value.ok !== false) {
        this.snapshotSinceStale = true;
        if (value.challengeDetected === false) {
          this.challengeDetected = false;
          this.challengeType = undefined;
        }
      }
      if (
        value.challengeDetected === true ||
        (typeof value.title === "string" &&
          /(?:captcha|challenge|turnstile|hcaptcha|just a moment)/i.test(value.title))
      ) {
        this.challengeDetected = true;
        this.challengeType =
          typeof value.challengeType === "string"
            ? value.challengeType
            : typeof value.title === "string" && /turnstile/i.test(value.title)
              ? "turnstile"
              : typeof value.title === "string" && /hcaptcha/i.test(value.title)
                ? "hcaptcha"
                : "captcha";
      }
      return;
    }

    // Handle browser_navigate
    if (name === "browser_navigate") {
      if (value.error || value.ok === false) {
        const err = String(value.error || "Navigation failed");
        const url = String(value.url ?? "");
        let hostname = String(value.hostname ?? "");
        if (!hostname && url) {
          try {
            hostname = new URL(url).hostname;
          } catch {
            hostname = url.replace(/^[a-zA-Z]+:\/\//, "").split("/")[0]?.split(":")[0] ?? "";
          }
        }
        const httpStatus =
          typeof value.httpStatus === "number"
            ? value.httpStatus
            : typeof value.status_code === "number"
              ? value.status_code
              : undefined;

        const isNxdomain =
          value.errorCode === "NXDOMAIN" ||
          err.includes("ERR_NAME_NOT_RESOLVED") ||
          err.includes("ERR_NAME_RESOLUTION_FAILED") ||
          err.includes("ENOTFOUND");

        const isTlsDns =
          !isNxdomain &&
          (value.errorCode === "TLS_DNS" ||
            err.includes("ERR_CONNECTION_REFUSED") ||
            err.includes("ERR_CERT_") ||
            err.includes("ERR_SSL_") ||
            err.includes("certificate"));

        const isCdp =
          err.includes("WebSocket") ||
          err.includes("Target closed") ||
          err.includes("CDP disconnected") ||
          err.includes("No target");

        const isChallenge =
          value.challengeDetected === true ||
          /(?:captcha|challenge|turnstile|hcaptcha|just a moment)/i.test(err);

        const isFlowStateInvalid =
          httpStatus === 400 ||
          err.includes("Error 400") ||
          err.includes("400 Bad Request") ||
          (/(?:signin|login|auth|oauth|challenge|callback|flowEntry)/i.test(url) &&
            httpStatus !== undefined &&
            httpStatus >= 400);

        let errorCode = String(value.errorCode ?? "BROWSER_ERROR");
        let errorKind = String(value.errorKind ?? "unknown");
        let retryable = value.retryable === true;
        let suggestions = Array.isArray(value.suggestions)
          ? (value.suggestions as string[])
          : undefined;
        let note = typeof value.note === "string" ? value.note : undefined;

        if (isNxdomain) {
          errorCode = "NXDOMAIN";
          errorKind = "nxdomain";
          retryable = false;
        } else if (isTlsDns) {
          errorCode = "TLS_DNS";
          errorKind = "tls_dns";
          retryable = false;
        } else if (isCdp) {
          errorCode = "CDP_DISCONNECTED";
          errorKind = "cdp_disconnected";
          retryable = true;
          this.cdpDisconnected = true;
        } else if (isChallenge) {
          errorCode = "CHALLENGE_DETECTED";
          errorKind = "challenge";
          retryable = false;
          this.challengeDetected = true;
          this.challengeType =
            typeof value.challengeType === "string" ? value.challengeType : "captcha";
        } else if (isFlowStateInvalid) {
          errorCode = "FLOW_STATE_INVALID";
          errorKind = "flow_state_invalid";
          retryable = true;
          suggestions = suggestions || [
            "Return to service entry point (base login URL) before attempting any storage resets",
          ];
          note =
            note ||
            "หน้าล็อกอินภายในคืนค่า HTTP 400 Bad Request เนื่องจากขาด flow state ให้กลับไปยัง entry point เริ่มต้นของบริการ";
        } else if (httpStatus !== undefined && httpStatus >= 400) {
          errorCode = `HTTP_${httpStatus}`;
          errorKind =
            httpStatus === 429
              ? "rate_limited"
              : httpStatus >= 500
                ? "server_error"
                : "http_error";
          retryable = httpStatus === 429 || httpStatus >= 500;
        }

        this.navigationFailure = {
          url,
          hostname,
          error: err,
          errorCode,
          errorKind,
          retryable,
          httpStatus,
          suggestions,
          note,
          attempts: (this.navigationFailure?.attempts ?? 0) + 1,
        };
      } else {
        // Successful navigation clears any navigation failure
        this.navigationFailure = undefined;
        this.cdpDisconnected = false;
      }
      return;
    }

    // Handle browser_act and computer_act
    if (value.error || value.ok === false) {
      if (name === "browser_act") {
        const err = String(value.error || "");
        const isChallenge =
          value.challengeDetected === true ||
          /(?:captcha|challenge|turnstile|hcaptcha)/i.test(err);
        if (isChallenge) {
          this.challengeDetected = true;
          this.challengeType =
            typeof value.challengeType === "string"
              ? value.challengeType
              : /turnstile/i.test(err)
                ? "turnstile"
                : /hcaptcha/i.test(err)
                  ? "hcaptcha"
                  : "captcha";
          this.lastError = err || "Security challenge detected";
          return;
        }

        const isCdp =
          err.includes("WebSocket") ||
          err.includes("Target closed") ||
          err.includes("CDP disconnected") ||
          err.includes("No target");
        if (isCdp) {
          this.cdpDisconnected = true;
          this.lastError = err;
          return;
        }

        const isStaleBeforeDispatch =
          !value.uncertain &&
          Number(value.completed ?? 0) === 0 &&
          err.includes("Stale element ref");
        if (isStaleBeforeDispatch) {
          this.staleRefFailures += 1;
          this.snapshotSinceStale = false;
          this.lastError = err || "Stale element ref";
        } else {
          this.failures += 1;
          this.uncertain ||= value.uncertain === true || Number(value.completed ?? 0) > 0;
          this.lastError = err || "Page action was not confirmed";
        }
      }
    } else {
      // Successful action clears action failures
      this.failures = 0;
      this.staleRefFailures = 0;
      this.snapshotSinceStale = false;
      this.uncertain = false;
      this.lastError = "";
      this.cdpDisconnected = false;
      // NOTE: A successful computer_act does NOT clear navigation failure,
      // because clicking the desktop does not prove navigation to a dead domain succeeded.
    }
  }

  blockedResult(
    toolName?: string,
    args?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    // 1. Check if browser_navigate is blocked
    if (toolName === "browser_navigate") {
      if (this.navigationFailure) {
        const targetUrl = String(args?.url ?? "");
        let targetHost = "";
        try {
          targetHost = new URL(targetUrl).hostname;
        } catch {
          targetHost = targetUrl.replace(/^[a-zA-Z]+:\/\//, "").split("/")[0]?.split(":")[0] ?? "";
        }

        // If previous failure was NXDOMAIN and targeting the same unresolvable host, block it!
        if (
          this.navigationFailure.errorKind === "nxdomain" &&
          (!targetHost || targetHost === this.navigationFailure.hostname)
        ) {
          return {
            ok: false,
            error: `Domain ${this.navigationFailure.hostname} does not exist in DNS (NXDOMAIN). Do not retry without a different verified URL.`,
            errorCode: "NXDOMAIN",
            retryable: false,
            suggestions: this.navigationFailure.suggestions,
            note: this.navigationFailure.note,
          };
        }

        // If flow_state_invalid: block retrying the exact same broken URL, but allow navigating to service entry point
        if (
          this.navigationFailure.errorKind === "flow_state_invalid" &&
          targetUrl &&
          targetUrl === this.navigationFailure.url
        ) {
          return {
            ok: false,
            error: `Navigation to ${this.navigationFailure.url} failed with HTTP 400 (flow state invalid). Do not retry the exact internal flow URL; navigate to the service entry point instead.`,
            errorCode: "FLOW_STATE_INVALID",
            retryable: false,
            suggestions: this.navigationFailure.suggestions,
            note: this.navigationFailure.note,
          };
        }

        // Non-retryable errors block repeating the same URL
        if (!this.navigationFailure.retryable && targetHost === this.navigationFailure.hostname) {
          return {
            ok: false,
            error: `Navigation to ${this.navigationFailure.url} failed (${this.navigationFailure.errorCode}) and is not retryable.`,
            errorCode: this.navigationFailure.errorCode,
            retryable: false,
          };
        }

        // Bounded retries for transient failures (max 2 attempts)
        if (
          this.navigationFailure.attempts >= 2 &&
          targetHost === this.navigationFailure.hostname &&
          (!targetUrl || targetUrl === this.navigationFailure.url)
        ) {
          return {
            ok: false,
            error: `Navigation to ${this.navigationFailure.url} reached retry limit (${this.navigationFailure.attempts} attempts).`,
            errorCode: "RETRY_LIMIT_EXCEEDED",
            retryable: false,
          };
        }
      }
      return undefined;
    }

    // 2. Check if browser_act is blocked
    if (toolName === "browser_act") {
      if (this.challengeDetected) {
        return {
          ok: false,
          completed: 0,
          blocked: true,
          challengeDetected: true,
          challengeType: this.challengeType,
          error: `Security challenge (${this.challengeType || "CAPTCHA"}) detected. Automated page actions paused.`,
          fallback: "request_takeover",
          note: "ตรวจพบแบบทดสอบความปลอดภัย (CAPTCHA) กรุณาใช้ request_takeover เพื่อให้ผู้ใช้ช่วยยืนยันบนหน้าจอ ห้ามส่งคำสั่งอัตโนมัติซ้ำ",
        };
      }
      if (this.cdpDisconnected) {
        return {
          ok: false,
          completed: 0,
          error: "Browser connection was interrupted (CDP disconnected). Reconnect or inspect page before retrying.",
          errorCode: "CDP_DISCONNECTED",
          retryable: true,
          note: "การเชื่อมต่อเบราว์เซอร์ขัดข้อง ควรเชื่อมต่อใหม่ก่อนลองส่งคำสั่งบนหน้าเว็บ",
        };
      }
      if (this.navigationFailure) {
        if (this.navigationFailure.errorKind === "flow_state_invalid") {
          return {
            ok: false,
            completed: 0,
            error: `Cannot perform page actions: current page is an invalid flow state (${this.navigationFailure.error}). Return to service entry point first.`,
            errorCode: "FLOW_STATE_INVALID",
            suggestions: this.navigationFailure.suggestions,
            note: this.navigationFailure.note,
          };
        }
        return {
          ok: false,
          completed: 0,
          error: `Cannot perform page actions: navigation to ${this.navigationFailure.url} failed (${this.navigationFailure.error}).`,
          errorCode: this.navigationFailure.errorCode,
        };
      }
      if (this.uncertain) {
        return this.unresolvedResult();
      }
      if (this.staleRefFailures > 0) {
        if (this.staleRefFailures >= 2) {
          return {
            ok: false,
            completed: 0,
            uncertain: false,
            fallback: "computer_act",
            error: `Page actions paused after repeated stale ref failures: ${this.lastError}`,
            note: "Do not retry browser_act or request another approval for it in this run. Use computer_observe to inspect the actual screen, then computer_act for the remaining work, or request_takeover if desktop tools are unavailable. Never repeat completed or uncertain actions. Do not claim the requested task succeeded without evidence.",
          };
        }
        if (!this.snapshotSinceStale) {
          return {
            ok: false,
            completed: 0,
            failedBeforeDispatch: true,
            retryable: true,
            error: "Element ref was stale before dispatch. Call browser_snapshot to get fresh element refs before retrying browser_act.",
            note: "Element ref was stale before dispatch. Call browser_snapshot to get fresh element refs and retry browser_act with the new ref.",
          };
        }
        return undefined;
      }
      if (this.failures < 2 && !this.uncertain) return undefined;
      return this.unresolvedResult();
    }

    // 3. Check if computer_act fallback is blocked (NXDOMAIN cannot be solved by desktop Chrome)
    if (toolName === "computer_act") {
      if (this.navigationFailure?.errorKind === "nxdomain") {
        const argsStr = JSON.stringify(args ?? "");
        if (argsStr.includes(this.navigationFailure.hostname)) {
          return {
            ok: false,
            completed: 0,
            error: `Cannot open ${this.navigationFailure.hostname}: domain does not exist in DNS (NXDOMAIN). Desktop fallback cannot resolve a non-existent DNS domain.`,
            errorCode: "NXDOMAIN",
          };
        }
      }
      return undefined;
    }

    // Default check without toolName specified
    if (this.challengeDetected) {
      return this.unresolvedResult();
    }
    if (this.cdpDisconnected) {
      return this.unresolvedResult();
    }
    if (this.navigationFailure) {
      return this.unresolvedResult();
    }
    if (this.uncertain) return this.unresolvedResult();
    if (this.staleRefFailures >= 2) return this.unresolvedResult();
    if (this.failures < 2 && !this.uncertain) return undefined;
    return this.unresolvedResult();
  }

  unresolvedResult(): Record<string, unknown> | undefined {
    if (this.challengeDetected) {
      return {
        ok: false,
        completed: 0,
        uncertain: false,
        challengeDetected: true,
        challengeType: this.challengeType,
        error: `Security challenge (${this.challengeType || "CAPTCHA"}) detected on page.`,
        fallback: "request_takeover",
        note: "ตรวจพบแบบทดสอบความปลอดภัย (CAPTCHA) ต้องให้ผู้ใช้ช่วยดำเนินการบนหน้าจอ",
      };
    }

    if (this.cdpDisconnected) {
      return {
        ok: false,
        completed: 0,
        uncertain: false,
        errorCode: "CDP_DISCONNECTED",
        error: "Browser connection was interrupted (CDP disconnected).",
        note: "การเชื่อมต่อเบราว์เซอร์ขัดข้อง",
      };
    }

    // If navigation failed and was never recovered by a successful navigation:
    if (this.navigationFailure) {
      const isNxdomain = this.navigationFailure.errorKind === "nxdomain";
      const isFlowInvalid = this.navigationFailure.errorKind === "flow_state_invalid";
      return {
        ok: false,
        completed: 0,
        uncertain: false,
        error: `Navigation to ${this.navigationFailure.url} failed: ${this.navigationFailure.error}`,
        errorCode: this.navigationFailure.errorCode,
        errorKind: this.navigationFailure.errorKind,
        hostname: this.navigationFailure.hostname,
        httpStatus: this.navigationFailure.httpStatus,
        suggestions: this.navigationFailure.suggestions,
        retryable: this.navigationFailure.retryable,
        fallback: isNxdomain ? undefined : "computer_act",
        note:
          this.navigationFailure.note ||
          (isNxdomain
            ? "Cannot resolve domain name in DNS. Do not retry this URL or use desktop fallback to fix DNS."
            : isFlowInvalid
              ? "หน้าเว็บคืนค่า HTTP 400 flow state ไม่ถูกต้อง ควรกลับไปยัง entry point เริ่มต้นของบริการ"
              : "Page navigation failed and was not recovered."),
      };
    }

    if (this.failures === 0 && this.staleRefFailures === 0 && !this.uncertain) return undefined;
    const isStale =
      !this.uncertain &&
      this.staleRefFailures > 0 &&
      this.lastError.includes("Stale element ref");
    return {
      ok: false,
      completed: 0,
      uncertain: this.uncertain,
      error: `Page actions paused after a browser failure: ${this.lastError}`,
      fallback: isStale && this.staleRefFailures < 2 ? undefined : "computer_act",
      note: isStale && this.staleRefFailures < 2
        ? "Element ref was stale before dispatch. Call browser_snapshot to get fresh element refs and retry browser_act with the new ref."
        : "Do not retry browser_act or request another approval for it in this run. Use computer_observe to inspect the actual screen, then computer_act for the remaining work, or request_takeover if desktop tools are unavailable. Never repeat completed or uncertain actions. Do not claim the requested task succeeded without evidence.",
    };
  }
}

export interface NavigationFailureRecord {
  url: string;
  hostname: string;
  error: string;
  errorCode: string;
  errorKind: string;
  retryable: boolean;
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

  constructor(effects: Array<{ kind: string; result: unknown }> = []) {
    for (const effect of effects) this.record(effect.kind, effect.result);
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
        const isNxdomain =
          value.errorCode === "NXDOMAIN" ||
          err.includes("ERR_NAME_NOT_RESOLVED") ||
          err.includes("ERR_NAME_RESOLUTION_FAILED") ||
          err.includes("ENOTFOUND");

        const errorCode = String(
          value.errorCode ?? (isNxdomain ? "NXDOMAIN" : "BROWSER_ERROR"),
        );
        const errorKind = String(
          value.errorKind ?? (isNxdomain ? "nxdomain" : "unknown"),
        );
        const retryable = value.retryable === true && !isNxdomain;

        this.navigationFailure = {
          url,
          hostname,
          error: err,
          errorCode,
          errorKind,
          retryable,
          suggestions: Array.isArray(value.suggestions)
            ? (value.suggestions as string[])
            : undefined,
          note: typeof value.note === "string" ? value.note : undefined,
          attempts: (this.navigationFailure?.attempts ?? 0) + 1,
        };
      } else {
        // Successful navigation clears any navigation failure
        this.navigationFailure = undefined;
      }
      return;
    }

    // Handle browser_act and computer_act
    if (value.error || value.ok === false) {
      if (name === "browser_act") {
        const isStaleBeforeDispatch =
          !value.uncertain &&
          Number(value.completed ?? 0) === 0 &&
          String(value.error || "").includes("Stale element ref");
        if (isStaleBeforeDispatch) {
          this.staleRefFailures += 1;
          this.snapshotSinceStale = false;
          this.lastError = String(value.error || "Stale element ref");
        } else {
          this.failures += 1;
          this.uncertain ||= value.uncertain === true || Number(value.completed ?? 0) > 0;
          this.lastError = String(value.error || "Page action was not confirmed");
        }
      }
    } else {
      // Successful action clears action failures
      this.failures = 0;
      this.staleRefFailures = 0;
      this.snapshotSinceStale = false;
      this.uncertain = false;
      this.lastError = "";
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
        if (this.navigationFailure.attempts >= 2 && targetHost === this.navigationFailure.hostname) {
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
      if (this.navigationFailure) {
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
    if (this.navigationFailure) {
      return this.unresolvedResult();
    }
    if (this.uncertain) return this.unresolvedResult();
    if (this.staleRefFailures >= 2) return this.unresolvedResult();
    if (this.failures < 2 && !this.uncertain) return undefined;
    return this.unresolvedResult();
  }

  unresolvedResult(): Record<string, unknown> | undefined {
    // If navigation failed and was never recovered by a successful navigation:
    if (this.navigationFailure) {
      const isNxdomain = this.navigationFailure.errorKind === "nxdomain";
      return {
        ok: false,
        completed: 0,
        uncertain: false,
        error: `Navigation to ${this.navigationFailure.url} failed: ${this.navigationFailure.error}`,
        errorCode: this.navigationFailure.errorCode,
        errorKind: this.navigationFailure.errorKind,
        hostname: this.navigationFailure.hostname,
        suggestions: this.navigationFailure.suggestions,
        retryable: this.navigationFailure.retryable,
        fallback: isNxdomain ? undefined : "computer_act",
        note:
          this.navigationFailure.note ||
          (isNxdomain
            ? "Cannot resolve domain name in DNS. Do not retry this URL or use desktop fallback to fix DNS."
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

import type {
  AdapterContext,
  BrowserActKind,
  BrowserActStep,
  BrowserProvider,
  ComputerRef,
} from "@rakazo/adapter-kit";
import type { LoginField } from "./bot-secrets.js";
import { redactConnectorPayload } from "./connector-safety.js";
import {
  classifyNavigationError,
  type DnsLookupFn,
} from "./navigation-error.js";
import { formatThaiDnsFailureMessage } from "./verified-urls.js";

const MAX_BROWSER_ACTIONS = 24;

/** Fills a saved website login by name; the model never supplies or sees the value. */
export type SecretFillStep = {
  kind: "fill_secret";
  ref: string;
  secret: string;
  field: LoginField;
};
export type BrowserActInput = BrowserActStep | SecretFillStep;
export type ResolveSecretFill = (
  step: SecretFillStep,
) => Promise<{ text: string; origin: string } | { error: string }>;

export interface BrowserNavigateToolOptions {
  findVerifiedUrls?: (spaceId: string, keyword?: string) => Promise<string[]>;
  spaceId?: string;
  dnsLookupFn?: DnsLookupFn;
}

export async function browserNavigateFromTool(
  browser: BrowserProvider,
  computer: ComputerRef,
  context: AdapterContext,
  args: Record<string, unknown>,
  options: BrowserNavigateToolOptions = {},
) {
  const url = String(args.url ?? "").trim();
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) {
      return {
        ok: false,
        url,
        error: "An HTTP(S) URL without embedded credentials is required",
        errorCode: "INVALID_URL",
        errorKind: "invalid_url",
        retryable: false,
      };
    }
  } catch {
    return {
      ok: false,
      url,
      error: "An HTTP(S) URL without embedded credentials is required",
      errorCode: "INVALID_URL",
      errorKind: "invalid_url",
      retryable: false,
    };
  }

  let result: Awaited<ReturnType<BrowserProvider["navigate"]>>;
  try {
    result = await browser.navigate(computer, { url, signal: context.signal }, context);
  } catch (error) {
    context.signal.throwIfAborted();
    result = {
      url,
      title: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (result.error) {
    let suggestions: string[] = [];
    if (options.findVerifiedUrls && options.spaceId) {
      try {
        suggestions = await options.findVerifiedUrls(options.spaceId);
      } catch {
        suggestions = [];
      }
    }
    const classified = await classifyNavigationError(url, result.error, {
      lookupFn: options.dnsLookupFn,
      suggestions,
    });

    const isNxdomain = classified.errorKind === "nxdomain";
    const thaiMsg = isNxdomain
      ? formatThaiDnsFailureMessage({
          hostname: classified.hostname,
          suggestions: classified.suggestions,
        })
      : undefined;

    const baseResult = {
      ok: false,
      url: classified.url,
      hostname: classified.hostname,
      title: "",
      error: classified.error,
      errorCode: classified.errorCode,
      errorKind: classified.errorKind,
      retryable: classified.retryable,
      fallback: isNxdomain ? undefined : result.fallback,
      suggestions: classified.suggestions,
      dnsStatus: classified.dnsStatus,
      note: thaiMsg || classified.recoveryGuidance,
    };
    return formatBrowserResult(baseResult);
  }

  return formatBrowserResult(result);
}

export async function browserSnapshotFromTool(
  browser: BrowserProvider,
  computer: ComputerRef,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  void args;
  try {
    const result = await browser.snapshot(computer, { signal: context.signal }, context);
    return formatBrowserResult(result);
  } catch (error) {
    context.signal.throwIfAborted();
    return {
      error: error instanceof Error ? error.message : String(error),
      fallback: "computer_act" as const,
    };
  }
}

export async function browserActFromTool(
  browser: BrowserProvider,
  computer: ComputerRef,
  context: AdapterContext,
  args: Record<string, unknown>,
  options: { resolveSecretFill?: ResolveSecretFill; redactions?: () => string[] } = {},
) {
  try {
    const actions: BrowserActStep[] = [];
    // Resolve every saved login before acting, so a missing one cannot leave a half-filled form.
    for (const step of parseBrowserActions(args.actions)) {
      if (step.kind !== "fill_secret") {
        actions.push(step);
        continue;
      }
      const resolved = options.resolveSecretFill
        ? await options.resolveSecretFill(step)
        : { error: "Saved logins are unavailable here." };
      if ("error" in resolved) return { ok: false, completed: 0, error: resolved.error };
      actions.push({ kind: "fill", ref: step.ref, text: resolved.text, origin: resolved.origin });
    }
    const result = await browser.act(computer, { actions, signal: context.signal }, context);
    return redactConnectorPayload(formatBrowserResult(result), options.redactions?.() ?? []);
  } catch (error) {
    context.signal.throwIfAborted();
    return {
      ok: false,
      uncertain: true,
      error: error instanceof Error ? error.message : String(error),
      fallback: "computer_act" as const,
    };
  }
}

export function parseBrowserActions(value: unknown): BrowserActInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("browser_act requires at least one action");
  }
  if (value.length > MAX_BROWSER_ACTIONS) {
    throw new Error(`browser_act accepts at most ${MAX_BROWSER_ACTIONS} actions`);
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`browser_act action ${index} must be an object`);
    }
    const action = raw as Record<string, unknown>;
    const kind = String(action.kind ?? "") as BrowserActKind | "fill_secret";
    if (kind !== "click" && kind !== "fill" && kind !== "type" && kind !== "fill_secret") {
      throw new Error(`browser_act action ${index} has unsupported kind`);
    }
    const ref = String(action.ref ?? "").trim();
    if (!ref) throw new Error(`browser_act action ${index} requires ref`);
    if (kind === "fill_secret") {
      const secret = String(action.secret ?? "").trim();
      const field = action.field;
      if (!secret) throw new Error("browser_act fill_secret requires secret");
      if (field !== "username" && field !== "password") {
        throw new Error("browser_act fill_secret field must be username or password");
      }
      return { kind, ref, secret, field };
    }
    if (kind === "fill" || kind === "type") {
      if (typeof action.text !== "string") {
        throw new Error(`browser_act ${kind} requires text`);
      }
      return { kind, ref, text: String(action.text) };
    }
    return { kind, ref };
  });
}

function formatBrowserResult<T extends { fallback?: "computer_act"; error?: string }>(result: T) {
  if (result.fallback === "computer_act") {
    return {
      ...result,
      note: "Page browser could not complete this step. Inspect the current state before continuing with computer_act if available, otherwise request_takeover. Do not replay completed or uncertain actions.",
    };
  }
  return result;
}

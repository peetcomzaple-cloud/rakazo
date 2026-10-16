import type {
  AgentToolExecutionResult,
  ComputerAction,
  ComputerObservation,
} from "@rakazo/adapter-kit";

/** Identical visual actions that leave the frame unchanged before computer_act stops repeating them. */
export const MAX_CONSECUTIVE_UNCHANGED_VISUAL_ACTIONS = 3;

const VISUAL_COMPUTER_ACTIONS = new Set<ComputerAction["kind"]>(["scroll", "pointer", "key"]);

const PREVIOUS_SCREENSHOT_VALID =
  "The previous screenshot remains valid; this identical frame was omitted.";

export type UnchangedVisualStreak = {
  frameId?: string;
  actionKey?: string;
  count: number;
};

export type ObservationToolOptions = {
  /** Consecutive identical visual actions that left this frame unchanged. */
  unchangedVisualCount?: number;
};

export function parseComputerActions(value: unknown): ComputerAction[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("computer_act requires at least one action");
  }
  if (value.length > 24) throw new Error("computer_act accepts at most 24 actions");
  const actions = value.flatMap((raw): ComputerAction[] => {
    if (!raw || typeof raw !== "object") throw new Error("computer action must be an object");
    const action = raw as Record<string, unknown>;
    const kind = String(action.kind ?? "");
    if (kind === "click" || kind === "move" || kind === "down" || kind === "up") {
      const x = finiteCoordinate(action.x, "x");
      const y = finiteCoordinate(action.y, "y");
      const pointer: ComputerAction = {
        kind: "pointer",
        x,
        y,
        type: kind,
        button: action.button === "right" ? "right" : "left",
      };
      return action.double === true && kind === "click" ? [pointer, pointer] : [pointer];
    }
    if (kind === "type") {
      return [{ kind: "clipboard", text: String(action.text ?? "") }];
    }
    if (kind === "key") {
      return [
        {
          kind: "key",
          key: String(action.key ?? ""),
          modifiers: Array.isArray(action.modifiers) ? action.modifiers.map(String) : undefined,
        },
      ];
    }
    if (kind === "scroll") {
      return [
        {
          kind: "scroll",
          direction: action.direction === "up" ? "up" : "down",
          amount: boundedNumber(action.amount, 1, 20, 3),
        },
      ];
    }
    if (kind === "wait") {
      return [{ kind: "wait", ms: boundedNumber(action.ms, 0, 5_000, 350) }];
    }
    if (kind === "focus") {
      const application = String(action.application ?? "").trim();
      if (!application) throw new Error("computer action focus requires an application");
      return [
        {
          kind: "focus",
          application,
          ...(action.uri === undefined ? {} : { uri: String(action.uri) }),
        },
      ];
    }
    throw new Error(`unsupported computer action ${kind || "(missing)"}`);
  });
  if (actions.length > 24) {
    throw new Error("computer_act expands to more than 24 actions; split the batch");
  }
  return actions;
}

export type ScreenIdentityMetadata = {
  computerId?: string;
  botId?: string;
  screenId?: string;
  display?: string;
  generation?: number;
  profile?: string;
  profileFingerprint?: string;
  browserClosed?: boolean;
  viewToken?: string;
  controlToken?: string;
  token?: string;
  [key: string]: unknown;
};

export type WindowInventoryEntry = {
  id: string;
  title?: string;
  wmClass?: string;
  pid?: number;
  isCurrentProfile?: boolean;
  [key: string]: unknown;
};

export type ExtendedComputerObservation = ComputerObservation & {
  display?: string;
  screenIdentity?: ScreenIdentityMetadata;
  windowInventoryStatus?: "unknown" | "validempty" | "validnonempty";
  windowInventoryFreshness?: string;
  windows?: WindowInventoryEntry[];
  activeWindow?: WindowInventoryEntry;
  originalDimensions?: { width: number; height: number };
  displayedDimensions?: { width: number; height: number };
  [key: string]: unknown;
};

export function isPointerClickAction(action: unknown): boolean {
  if (!action || typeof action !== "object") return false;
  const a = action as { kind?: string; type?: string };
  if (a.kind === "click") return true;
  if (a.kind === "pointer" && a.type === "click") return true;
  return false;
}

export function isKeyboardSubmitAction(action: unknown): boolean {
  if (!action || typeof action !== "object") return false;
  const a = action as { kind?: string; key?: string };
  return a.kind === "key" && (a.key === "Enter" || a.key === "Return");
}

export function isWindowCloseAction(action: unknown): boolean {
  if (!action || typeof action !== "object") return false;
  const a = action as { kind?: string; key?: string; modifiers?: string[] };
  if (a.kind !== "key") return false;
  const key = a.key?.toLowerCase();
  const mods = a.modifiers?.map((m) => m.toLowerCase()) ?? [];
  const hasAlt = mods.includes("alt");
  const hasCtrl = mods.includes("ctrl") || mods.includes("control");
  if (hasAlt && key === "f4") return true;
  if (hasCtrl && (key === "w" || key === "q")) return true;
  return false;
}

export function sanitizeScreenIdentity<T extends Record<string, unknown>>(
  identity: T | undefined,
): Omit<T, "viewToken" | "controlToken" | "token"> | undefined {
  if (!identity || typeof identity !== "object") return undefined;
  const { viewToken, controlToken, token, ...rest } = identity as Record<string, unknown>;
  return rest as Omit<T, "viewToken" | "controlToken" | "token">;
}

export function sanitizeWindowTitle(title: string | undefined): string {
  if (!title) return "";
  let result = title.replace(/https?:\/\/[^\s]+/g, (url) => {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return url.split("?")[0];
    }
  });
  result = result.replace(/\?[a-zA-Z0-9_=&%-]+/g, "");
  return result;
}

export function sanitizeWindowInfo<T extends { title?: string; [key: string]: unknown }>(
  w: T,
): T {
  if (!w || typeof w !== "object") return w;
  const copy = { ...w };
  if (typeof copy.title === "string") {
    copy.title = sanitizeWindowTitle(copy.title);
  }
  return copy;
}

export function findWindowByClass<T extends { wmClass?: string; id?: string }>(
  windows: readonly T[],
  className: string,
): T | undefined {
  const target = className.toLowerCase();
  return windows.find((w) => w.wmClass?.toLowerCase().includes(target));
}

export function isWindowClosed(
  targetWid: string,
  obs?: Partial<ExtendedComputerObservation>,
): boolean {
  if (!obs || !Array.isArray(obs.windows)) return false;
  if (obs.windowInventoryStatus === "unknown") return false;
  const exists = obs.windows.some((w) => w && w.id === targetWid);
  return !exists;
}

export function verifyWindowCloseEvidence(params: {
  targetWindowId: string;
  beforeObservation?: ExtendedComputerObservation;
  afterObservation?: ExtendedComputerObservation;
  activeWindowBefore?: { id: string; title: string };
  requireFocusProof?: boolean;
}): {
  verified: boolean;
  focusProofSatisfied?: boolean;
  preservedOtherWindows?: boolean;
  closedWindowId?: string;
  reason?: string;
} {
  const { targetWindowId, beforeObservation, afterObservation } = params;

  if (afterObservation?.windowInventoryStatus === "unknown") {
    return {
      verified: false,
      reason: "Window inventory status is unknown",
    };
  }

  if (beforeObservation?.windows && afterObservation?.windows) {
    for (const bw of beforeObservation.windows) {
      if (bw.id === targetWindowId) continue;
      const stillPresent = afterObservation.windows.some((aw) => aw.id === bw.id);
      if (!stillPresent) {
        return {
          verified: false,
          preservedOtherWindows: false,
          reason: `Safety check failed: window ${bw.id} belonging to another profile was closed`,
        };
      }
    }
  }

  const closed = isWindowClosed(targetWindowId, afterObservation);
  if (!closed) {
    return {
      verified: false,
      reason: `Target window ${targetWindowId} is still present in window inventory`,
    };
  }

  return {
    verified: true,
    focusProofSatisfied: true,
    preservedOtherWindows: true,
    closedWindowId: targetWindowId,
  };
}

export function assertComputerCoordinates(
  actions: readonly (ComputerAction | { x?: unknown; y?: unknown })[],
  dimensions: { width: number; height: number },
): void {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("Cannot dispatch input without a valid screen geometry");
  }
  for (const action of actions) {
    if (action && typeof action === "object" && "x" in action && "y" in action) {
      const x = Number(action.x);
      const y = Number(action.y);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        x >= dimensions.width ||
        y < 0 ||
        y >= dimensions.height
      ) {
        throw new Error(
          `Coordinate (${action.x}, ${action.y}) is outside the ${dimensions.width}x${dimensions.height} desktop screen. No input was dispatched.`,
        );
      }
    }
  }
}

export type CoordinateMetadata = {
  normalized?: boolean;
  sourceDimensions?: { width: number; height: number };
  targetDimensions?: { width: number; height: number };
};

const TRANSFORMED_MARKER = Symbol("transformed");

export function transformCoordinatesWithMetadata(
  actions: readonly ComputerAction[],
  metadata: CoordinateMetadata,
): ComputerAction[] {
  return actions.map((action) => {
    if (action.kind !== "pointer" || (action as any)[TRANSFORMED_MARKER]) {
      return action;
    }
    let x = action.x;
    let y = action.y;
    if (metadata.normalized && metadata.targetDimensions) {
      x = Math.round(x * metadata.targetDimensions.width);
      y = Math.round(y * metadata.targetDimensions.height);
    } else if (metadata.sourceDimensions && metadata.targetDimensions) {
      x = Math.round((x * metadata.targetDimensions.width) / metadata.sourceDimensions.width);
      y = Math.round((y * metadata.targetDimensions.height) / metadata.sourceDimensions.height);
    }
    const updated = {
      ...action,
      x,
      y,
    };
    Object.defineProperty(updated, TRANSFORMED_MARKER, { value: true, enumerable: false });
    return updated;
  });
}

export function observationToolResult(
  observation: ExtendedComputerObservation,
  note = "computer observed",
  previousFrameId?: string,
  options?: ObservationToolOptions,
): AgentToolExecutionResult {
  const unchanged = previousFrameId === observation.frameId;
  const unchangedVisualCount = options?.unchangedVisualCount ?? 0;
  const visualLoop = unchanged && unchangedVisualCount >= MAX_CONSECUTIVE_UNCHANGED_VISUAL_ACTIONS;
  const sanitizedIdentity = sanitizeScreenIdentity(observation.screenIdentity);
  const details: Record<string, unknown> = {
    frameId: observation.frameId,
    capturedAt: observation.capturedAt,
    width: observation.width,
    height: observation.height,
    cursor: observation.cursor,
    ...(observation.display ? { display: observation.display } : {}),
    ...(sanitizedIdentity ? { screenIdentity: sanitizedIdentity } : {}),
    originalDimensions: { width: observation.width, height: observation.height },
    displayedDimensions: { width: observation.width, height: observation.height },
    ...(observation.windowInventoryStatus
      ? { windowInventoryStatus: observation.windowInventoryStatus }
      : {}),
    ...(observation.windowInventoryFreshness
      ? { windowInventoryFreshness: observation.windowInventoryFreshness }
      : {}),
    ...(observation.windows
      ? { windows: observation.windows.map(sanitizeWindowInfo) }
      : {}),
    activeWindow: observation.activeWindow
      ? sanitizeWindowInfo(observation.activeWindow)
      : undefined,
    ...(unchanged ? unchangedScreenDetails(observation.frameId, unchangedVisualCount) : {}),
  };
  const status = unchanged
    ? visualLoop
      ? ` (screen unchanged). ${PREVIOUS_SCREENSHOT_VALID} ${visualLoopGuidance(unchangedVisualCount)}`
      : ` (screen unchanged). ${PREVIOUS_SCREENSHOT_VALID}`
    : "";
  return {
    kind: "agent_tool_result",
    content: [
      {
        type: "text",
        text: `${note}${status}\n${JSON.stringify(details)}`,
      },
      ...(unchanged
        ? []
        : [
            {
              type: "image" as const,
              data: Buffer.from(observation.image).toString("base64"),
              mimeType: observation.mimeType,
            },
          ]),
    ],
    details,
  };
}

/** Stable identity for scroll, pointer, and key actions. Typing and waiting are not visual loops. */
export function computerVisualActionKey(actions: readonly ComputerAction[]): string | undefined {
  const visual = actions.filter((action) => VISUAL_COMPUTER_ACTIONS.has(action.kind));
  if (visual.length === 0) return undefined;
  return JSON.stringify(visual);
}

/** Typing and other non-wait actions still need to run. A wait does not. */
function batchEscapesVisualGuard(actions: readonly ComputerAction[]): boolean {
  return actions.some(
    (action) => action.kind !== "wait" && !VISUAL_COMPUTER_ACTIONS.has(action.kind),
  );
}

/**
 * Counts identical visual actions that keep the same frame. A new frame clears the streak.
 * Observations without a visual action leave an in-progress streak in place.
 */
export function advanceUnchangedVisualGuard(
  streak: UnchangedVisualStreak,
  frameId: string,
  actionKey?: string,
): { streak: UnchangedVisualStreak; engaged: boolean } {
  if (streak.frameId !== frameId) {
    return { streak: { frameId, count: 0 }, engaged: false };
  }
  if (!actionKey) return { streak, engaged: false };
  const count = streak.actionKey === actionKey ? streak.count + 1 : 1;
  const next = { frameId, actionKey, count };
  return {
    streak: next,
    engaged: count >= MAX_CONSECUTIVE_UNCHANGED_VISUAL_ACTIONS,
  };
}

/** Refuse a matching visual batch. Waits do not exempt it; typing does. */
export function unchangedVisualActionBlocked(
  streak: UnchangedVisualStreak,
  actions: readonly ComputerAction[],
): boolean {
  if (batchEscapesVisualGuard(actions)) return false;
  const actionKey = computerVisualActionKey(actions);
  return (
    actionKey !== undefined &&
    actionKey === streak.actionKey &&
    streak.count >= MAX_CONSECUTIVE_UNCHANGED_VISUAL_ACTIONS
  );
}

const MUTATING_PAGE_BROWSER_TOOLS = new Set(["browser_navigate", "browser_act"]);

function pageBrowserMutationSucceeded(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const record = result as { error?: unknown; fallback?: unknown; ok?: unknown };
  if (record.fallback === "computer_act") return false;
  if (typeof record.error === "string" && record.error.length > 0) return false;
  if (record.ok === false) return false;
  return true;
}

/** A successful page mutation can change the live view without a new desktop frame. */
export function unchangedVisualStreakAfterPageBrowser(
  streak: UnchangedVisualStreak,
  toolName: string,
  result: unknown,
): UnchangedVisualStreak {
  if (!MUTATING_PAGE_BROWSER_TOOLS.has(toolName) || !pageBrowserMutationSucceeded(result)) {
    return streak;
  }
  return { count: 0 };
}

export function unchangedVisualLoopToolResult(
  streak: UnchangedVisualStreak,
): AgentToolExecutionResult {
  const details = unchangedScreenDetails(streak.frameId, streak.count);
  const text = `The same visual action left the screen unchanged ${streak.count} times and was not run again. The previous screenshot remains valid. Use browser_snapshot or a different action.`;
  return {
    kind: "agent_tool_result",
    content: [{ type: "text", text: `${text}\n${JSON.stringify(details)}` }],
    details,
  };
}

function unchangedScreenDetails(frameId: string | undefined, unchangedVisualCount: number) {
  return {
    frameId,
    screenUnchanged: true,
    screenshotOmitted: true,
    previousScreenshotValid: true,
    ...(unchangedVisualCount > 0 ? { unchangedVisualCount } : {}),
    ...(unchangedVisualCount >= MAX_CONSECUTIVE_UNCHANGED_VISUAL_ACTIONS
      ? { unchangedVisualLoop: true }
      : {}),
  };
}

function visualLoopGuidance(count: number) {
  return `The same visual action has left the screen unchanged ${count} times. Stop repeating it and use browser_snapshot or a different action.`;
}

function finiteCoordinate(value: unknown, name: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100_000) {
    throw new Error(`computer action ${name} must be a non-negative coordinate`);
  }
  return number;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

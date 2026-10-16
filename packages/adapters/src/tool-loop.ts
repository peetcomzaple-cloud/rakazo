import { type ToolCallStreak, trackToolCallStreak } from "@rakazo/core";

// Same tool, same arguments, this many times in a row means the agent is stuck, not paginating.
const MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS = 6;

export type ExtendedToolCallStreak = ToolCallStreak & {
  lastOutput?: string;
};

export function recordToolResult(
  streak: ExtendedToolCallStreak,
  output: string,
): ExtendedToolCallStreak {
  if (streak.lastOutput !== undefined && streak.lastOutput !== output) {
    return {
      ...streak,
      count: 0,
      lastOutput: output,
    };
  }
  return {
    ...streak,
    lastOutput: output,
  };
}

export function advanceToolCallLoopGuard(
  streak: ExtendedToolCallStreak,
  name: string,
  args: unknown,
  output?: string,
): { streak: ExtendedToolCallStreak; stuck: boolean } {
  let next = trackToolCallStreak(streak, name, args) as ExtendedToolCallStreak;
  if (output !== undefined) {
    next = recordToolResult({ ...next, lastOutput: streak.lastOutput }, output);
  }
  return {
    streak: next,
    stuck: next.count >= MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS,
  };
}

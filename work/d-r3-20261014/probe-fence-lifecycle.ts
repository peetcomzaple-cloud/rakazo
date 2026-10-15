import { describe, it, expect, vi } from "vitest";
import {
  acquireComputerExecutionLease,
  releaseComputerExecutionLease,
  holdComputerExecutionLeaseForTakeover,
  screenLeaseIdForRun,
  ComputerBusyError,
} from "@rakazo/adapters";
import { canTakeScreenLease, canReleaseScreenLease } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";

describe("dedicated and team computer screen fencing lifecycle", () => {
  it("enforces monotonic fencing and rejects stale requests across runs", async () => {
    // In-memory mock database tracking leases
    const leases = new Map<string, {
      computerId: string;
      botId: string;
      runId: string;
      fence: number;
      expiresAt: Date;
    }>();

    const mockPrisma = {
      computer: {
        findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }) => ({
          id: where.id,
          scope: "dedicated",
          state: "running",
          maintenanceId: null,
          updatedAt: new Date(),
        })),
      },
      computerExecutionLease: {
        updateManyAndReturn: vi.fn().mockImplementation(async ({ where, data }) => {
          const key = `${where.computerId}:${where.botId}`;
          const existing = leases.get(key);
          if (!existing) return [];
          const now = new Date();
          const matchesExpiry = where.OR?.some((cond: any) => {
            if (cond.expiresAt?.lt && existing.expiresAt < now) return true;
            if (cond.runId && existing.runId === cond.runId) return true;
            return false;
          });
          if (!matchesExpiry) return [];
          const newFence = existing.fence + (data.fence?.increment ?? 1);
          existing.fence = newFence;
          existing.runId = data.runId;
          existing.expiresAt = data.expiresAt;
          leases.set(key, existing);
          return [{ fence: newFence }];
        }),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const key = `${data.computerId}:${data.botId}`;
          if (leases.has(key)) {
            const err = new Error("unique constraint violation");
            (err as any).code = "P2002";
            throw err;
          }
          leases.set(key, { ...data });
          return { fence: data.fence };
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
          const key = `${where.computerId}:${where.botId}`;
          const existing = leases.get(key);
          if (existing && existing.runId === where.runId && existing.fence === where.fence) {
            existing.expiresAt = data.expiresAt;
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
    } as unknown as PrismaClient;

    // 1. Run 1 starts: acquires lease on dedicated computer
    const lease1 = await acquireComputerExecutionLease(mockPrisma, {
      computerId: "comp-reader",
      runId: "run-1",
      botId: "bot-reader",
    });
    expect(lease1).toEqual({
      computerId: "comp-reader",
      botId: "bot-reader",
      runId: "run-1",
      fence: 1,
    });

    const screenLease1 = screenLeaseIdForRun(lease1, "run-1");
    expect(screenLease1).toBe("run-1:1");
    expect(canTakeScreenLease(undefined, screenLease1)).toBe(true);

    // 2. Active run 1 is running: a second concurrent run for the same bot is rejected as busy
    await expect(
      acquireComputerExecutionLease(mockPrisma, {
        computerId: "comp-reader",
        runId: "run-concurrent",
        botId: "bot-reader",
      }),
    ).rejects.toThrow(ComputerBusyError);

    // 3. Run 1 finishes or is stopped -> lease released (expired tombstone retained)
    await releaseComputerExecutionLease(mockPrisma, lease1);
    expect(leases.get("comp-reader:bot-reader")?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());

    // 4. Run 2 starts: acquires lease and receives monotonic increment fence = 2
    const lease2 = await acquireComputerExecutionLease(mockPrisma, {
      computerId: "comp-reader",
      runId: "run-2",
      botId: "bot-reader",
    });
    expect(lease2).toEqual({
      computerId: "comp-reader",
      botId: "bot-reader",
      runId: "run-2",
      fence: 2,
    });

    const screenLease2 = screenLeaseIdForRun(lease2, "run-2");
    expect(screenLease2).toBe("run-2:2");

    // Supervisor accepts run 2 taking screen from run 1
    expect(canTakeScreenLease(screenLease1, screenLease2)).toBe(true);

    // Supervisor REJECTS delayed old request from run 1 attempting to take screen after run 2
    expect(canTakeScreenLease(screenLease2, screenLease1)).toBe(false);

    // Supervisor REJECTS delayed old release from run 1 attempting to tear down run 2's screen
    expect(canReleaseScreenLease(screenLease2, screenLease1)).toBe(false);

    // 5. Takeover flow: Run 2 holds lease for takeover
    const held = await holdComputerExecutionLeaseForTakeover(mockPrisma, lease2);
    expect(held).toBe(true);
    expect(leases.get("comp-reader:bot-reader")?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3600_000);

    // 6. Resume held lease: Run 2 resumes with resumeHeldLease=true
    const resumedLease = await acquireComputerExecutionLease(mockPrisma, {
      computerId: "comp-reader",
      runId: "run-2",
      botId: "bot-reader",
      resumeHeldLease: true,
    });
    expect(resumedLease?.fence).toBe(3);
    const resumedScreenLease = screenLeaseIdForRun(resumedLease, "run-2");
    expect(resumedScreenLease).toBe("run-2:3");
    expect(canTakeScreenLease(screenLease2, resumedScreenLease)).toBe(true);
  });
});

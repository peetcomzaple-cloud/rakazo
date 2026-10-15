import { createDb } from '@rakazo/db';
import {
  acquireComputerExecutionLease,
  releaseComputerExecutionLease,
  screenLeaseIdForRun,
  createSandboxProvider
} from '@rakazo/adapters';
import { loadEnv } from '/app/apps/api/src/env.js';

const env = loadEnv(process.env);
const { prisma } = createDb(env.databaseUrl, { poolMax: 2 });
const sandbox = createSandboxProvider(env.sandboxProvider, {
  supervisorUrl: env.sandboxSupervisorUrl,
  supervisorToken: env.sandboxSupervisorToken
});

async function main() {
  const bot = await prisma.bot.findFirstOrThrow({
    where: { name: 'reader' },
    include: { computer: true }
  });
  const compRow = bot.computer;
  if (!compRow) throw new Error('Reader computer missing');

  const computer = {
    id: compRow.providerRef!,
    providerRef: compRow.providerRef!,
    kind: compRow.kind,
    botId: bot.id
  };

  const baseContext = {
    operationId: 'test-fence',
    traceId: 'test-fence',
    spaceId: bot.spaceId,
    userId: 'default',
    botId: bot.id,
    signal: AbortSignal.timeout(15000)
  };

  console.log('Testing live sandbox observe on dedicated computer container:', computer.id, 'spaceId:', bot.spaceId);

  // Expire any leftover unexpired leases for this computer/bot
  await prisma.computerExecutionLease.updateMany({
    where: { computerId: compRow.id, botId: bot.id },
    data: { expiresAt: new Date(0) }
  });

  // 1. Lease 1
  const lease1 = await prisma.$transaction(async (tx) => {
    return acquireComputerExecutionLease(tx, {
      computerId: compRow.id,
      botId: bot.id,
      holderType: 'bot',
      holderId: bot.id,
      runId: 'test-run-1'
    });
  });
  console.log('Lease 1:', JSON.stringify(lease1));
  const sLease1 = screenLeaseIdForRun(lease1, 'test-run-1');
  console.log('Screen Lease ID 1:', sLease1);

  const obs1 = await sandbox.observe(computer, {
    ...baseContext,
    screenLeaseId: sLease1
  });
  console.log('Obs 1 active window:', obs1.activeWindow?.title ?? 'none', 'bytes:', obs1.image.length);

  // Release Lease 1 (creates tombstone)
  await prisma.$transaction(async (tx) => {
    await releaseComputerExecutionLease(tx, lease1);
  });
  console.log('Lease 1 released.');

  // 2. Lease 2
  const lease2 = await prisma.$transaction(async (tx) => {
    return acquireComputerExecutionLease(tx, {
      computerId: compRow.id,
      botId: bot.id,
      holderType: 'bot',
      holderId: bot.id,
      runId: 'test-run-2'
    });
  });
  console.log('Lease 2:', JSON.stringify(lease2));
  const sLease2 = screenLeaseIdForRun(lease2, 'test-run-2');
  console.log('Screen Lease ID 2:', sLease2);

  try {
    const obs2 = await sandbox.observe(computer, {
      ...baseContext,
      screenLeaseId: sLease2
    });
    console.log('Obs 2 active window:', obs2.activeWindow?.title ?? 'none', 'bytes:', obs2.image.length);

    // 3. Delayed stale observe from Run 1 should FAIL with 409 Conflict!
    let staleFailed = false;
    try {
      await sandbox.observe(computer, {
        ...baseContext,
        screenLeaseId: sLease1
      });
    } catch (err: any) {
      staleFailed = true;
      console.log('Stale delayed observe correctly rejected with error:', err.message);
    }

    if (!staleFailed) {
      throw new Error('FAIL: Stale delayed observe was NOT rejected!');
    }

    console.log('ALL LIVE FENCE INVARIANTS PASS: Monotonic leases, consecutive runs, stale rejection!');
  } finally {
    // Always cleanup Lease 2
    await prisma.$transaction(async (tx) => {
      await releaseComputerExecutionLease(tx, lease2);
    }).catch(() => {});
    console.log('Lease 2 released in finally.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

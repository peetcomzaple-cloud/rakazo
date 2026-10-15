import { createDb } from '@rakazo/db';
import { acquireComputerExecutionLease, releaseComputerExecutionLease } from '@rakazo/adapters';
import { loadEnv } from '/app/apps/api/src/env.js';

const env = loadEnv(process.env);
const { prisma } = createDb(env.databaseUrl, { poolMax: 2 });

async function main() {
  const bot = await prisma.bot.findFirstOrThrow({
    where: { name: 'reader' },
    include: { computer: true }
  });
  const computer = bot.computer;
  if (!computer) throw new Error('Reader computer missing');

  console.log('Testing live dedicated computer fence for:', computer.id, 'scope:', computer.scope);

  // Clean any leftover expired leases from previous failed probe run
  await prisma.computerExecutionLease.deleteMany({
    where: { computerId: computer.id, botId: bot.id }
  });

  // 1. Simulate Run 1 acquiring lease
  const run1Id = 'test-run-1-' + Date.now();
  const lease1 = await prisma.$transaction(async (tx) => {
    return acquireComputerExecutionLease(tx, {
      computerId: computer.id,
      botId: bot.id,
      holderType: 'bot',
      holderId: bot.id,
      runId: run1Id
    });
  });
  console.log('Run 1 lease acquired:', JSON.stringify(lease1));

  // Release Run 1 execution lease (creates tombstone with fence 1)
  await prisma.$transaction(async (tx) => {
    await releaseComputerExecutionLease(tx, lease1);
  });
  console.log('Run 1 lease released (tombstone preserved)');

  // 2. Simulate Run 2 acquiring lease
  const run2Id = 'test-run-2-' + Date.now();
  const lease2 = await prisma.$transaction(async (tx) => {
    return acquireComputerExecutionLease(tx, {
      computerId: computer.id,
      botId: bot.id,
      holderType: 'bot',
      holderId: bot.id,
      runId: run2Id
    });
  });
  console.log('Run 2 lease acquired:', JSON.stringify(lease2));

  if (!lease1 || !lease2) {
    throw new Error('FAIL: lease is null for dedicated computer!');
  }
  if (lease2.fence <= lease1.fence) {
    throw new Error('FAIL: lease2 fence (' + lease2.fence + ') not strictly greater than lease1 fence (' + lease1.fence + ')');
  }

  // 3. Test screen lease against live sandbox supervisor
  const supUrl = env.sandboxSupervisorUrl || 'http://rakazo-supervisor-1:7091';
  const supToken = env.sandboxSupervisorToken || '';

  // Run 1 claims screen
  const r1Res = await fetch(supUrl + '/computers/' + computer.providerRef + '/screen', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(supToken ? { authorization: 'Bearer ' + supToken } : {})
    },
    body: JSON.stringify({
      ownerId: run1Id,
      ownerType: 'bot',
      fence: lease1.fence
    })
  });
  const r1Json = await r1Res.json();
  console.log('Supervisor screen Run 1 response (status ' + r1Res.status + '):', JSON.stringify(r1Json));

  // Run 2 claims screen (higher fence)
  const r2Res = await fetch(supUrl + '/computers/' + computer.providerRef + '/screen', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(supToken ? { authorization: 'Bearer ' + supToken } : {})
    },
    body: JSON.stringify({
      ownerId: run2Id,
      ownerType: 'bot',
      fence: lease2.fence
    })
  });
  const r2Json = await r2Res.json();
  console.log('Supervisor screen Run 2 response (status ' + r2Res.status + '):', JSON.stringify(r2Json));

  if (r2Res.status !== 200 || !r2Json.ok) {
    throw new Error('FAIL: Run 2 could not claim screen with higher fence!');
  }

  // Stale delayed Run 1 request (lower fence) should be REJECTED (409)
  const staleRes = await fetch(supUrl + '/computers/' + computer.providerRef + '/screen', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(supToken ? { authorization: 'Bearer ' + supToken } : {})
    },
    body: JSON.stringify({
      ownerId: run1Id,
      ownerType: 'bot',
      fence: lease1.fence
    })
  });
  const staleJson = await staleRes.json();
  console.log('Supervisor screen delayed Run 1 response (status ' + staleRes.status + '):', JSON.stringify(staleJson));

  if (staleRes.status !== 409) {
    throw new Error('FAIL: Delayed stale request was not rejected with 409! Got: ' + staleRes.status);
  }

  // Cleanup: release lease2 and delete screen lease on supervisor
  await prisma.$transaction(async (tx) => {
    await releaseComputerExecutionLease(tx, lease2);
  });
  await fetch(supUrl + '/computers/' + computer.providerRef + '/screen', {
    method: 'DELETE',
    headers: { ...(supToken ? { authorization: 'Bearer ' + supToken } : {}) }
  });

  console.log('SUCCESS: Live screen fencing fully verified on dedicated computer!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

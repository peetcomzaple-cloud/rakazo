import { PrismaClient } from '@rakazo/db';

async function main() {
  const prisma = new PrismaClient();
  const bot = await prisma.bot.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!bot) {
    console.error("No active bot found");
    process.exit(1);
  }
  
  await prisma.bot.update({
    where: { id: bot.id },
    data: { memoryScope: "isolated" }
  });
  console.log("Memory enabled (memoryScope: isolated)");
  
  const routine = await prisma.routine.create({
    data: {
      spaceId: bot.spaceId,
      botId: bot.id,
      userId: bot.userId,
      name: "morning-check",
      prompt: "list files on rakazo-computer",
      crons: ["*/15 * * * *"],
      timezone: "UTC",
      active: true,
      notify: true,
      webhookEnabled: false,
      githubEnabled: false,
      nextRunAt: new Date()
    }
  });
  console.log(`Routine created: ${routine.id} - ${routine.name}`);
  
  const payload = JSON.stringify({
    payload: {
      routineId: routine.id,
      scheduledFor: new Date().toISOString()
    }
  });
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO graphile_worker.jobs (task_identifier, payload, run_at, key)
    VALUES ('routine.wakeup', $1::json, now(), 'routine:${routine.id}')
    ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, run_at = EXCLUDED.run_at;
  `, payload);
  console.log("Job injected into graphile_worker.jobs");
}

main().catch(console.error).finally(() => process.exit(0));

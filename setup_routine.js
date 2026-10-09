const { PrismaClient } = require('@rakazo/db');

async function main() {
  const prisma = new PrismaClient();
  
  // Find the first bot
  const bot = await prisma.bot.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!bot) {
    console.error("No active bot found");
    process.exit(1);
  }
  
  console.log(`Found bot: ${bot.id} - ${bot.name}`);
  
  // 1. Enable memory for the bot
  await prisma.bot.update({
    where: { id: bot.id },
    data: { memoryScope: "isolated" }
  });
  
  console.log("Memory enabled (memoryScope: isolated)");
  
  // 2. Create the morning-check routine
  // We'll set it to run every 15 minutes, but also insert a graphile job to trigger it now.
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
  
  // 3. Inject job directly into graphile_worker.jobs table using raw SQL
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

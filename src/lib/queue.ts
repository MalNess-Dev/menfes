import { prisma, ensureWalMode } from "./prisma";

export interface QueueOptions {
  minDelaySeconds: number;
  maxDelaySeconds: number;
  maxDailyPosts: number;
}

/**
 * Returns configuration settings from environment variables
 */
export function getQueueConfig(): QueueOptions {
  return {
    minDelaySeconds: parseInt(process.env.MIN_POST_DELAY_SECONDS || "300", 10),
    maxDelaySeconds: parseInt(process.env.MAX_POST_DELAY_SECONDS || "900", 10),
    maxDailyPosts: parseInt(process.env.MAX_DAILY_POSTS || "30", 10),
  };
}

/**
 * Check if the worker is paused via BOT_PAUSED env flag
 */
export function isBotPaused(): boolean {
  return process.env.BOT_PAUSED?.toLowerCase() === "true";
}

/**
 * Recovers messages stuck in 'processing' for more than 10 minutes (e.g. after crash/restart)
 * as specified in Section 6 of PRD.
 */
export async function recoverHangingJobs(): Promise<number> {
  await ensureWalMode();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const stuckJobs = await prisma.menfess.updateMany({
    where: {
      status: "processing",
      createdAt: {
        lt: tenMinutesAgo,
      },
    },
    data: {
      status: "pending",
      errorMessage: "Recovered from hanging processing state upon restart.",
    },
  });

  if (stuckJobs.count > 0) {
    console.log(`[Queue] Recovered ${stuckJobs.count} hanging jobs back to 'pending'.`);
  }

  return stuckJobs.count;
}

/**
 * Counts how many posts have been published today to enforce conservative daily limit.
 */
export async function getTodayPublishedCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.menfess.count({
    where: {
      status: "published",
      publishedAt: {
        gte: startOfDay,
      },
    },
  });
}

/**
 * Gets the next pending menfess message ordered by createdAt ascending (FIFO)
 */
export async function getNextPendingMenfess() {
  return prisma.menfess.findFirst({
    where: {
      status: "pending",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * Calculates a random jitter delay between minDelaySeconds and maxDelaySeconds
 */
export function getRandomDelayMs(minSec: number, maxSec: number): number {
  const min = Math.min(minSec, maxSec);
  const max = Math.max(minSec, maxSec);
  const randomSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomSeconds * 1000;
}

/**
 * Gets current persistent bot status from database
 */
export async function getBotStatus() {
  await ensureWalMode();
  return prisma.botStatus.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, isHalted: false },
  });
}

/**
 * Records that the worker has halted due to critical checkpoint or login failure
 */
export async function setBotHalted(reason: string) {
  await ensureWalMode();
  return prisma.botStatus.upsert({
    where: { id: 1 },
    update: {
      isHalted: true,
      haltReason: reason,
      haltedAt: new Date(),
    },
    create: {
      id: 1,
      isHalted: true,
      haltReason: reason,
      haltedAt: new Date(),
    },
  });
}

/**
 * Clears the halted status so the worker can resume processing
 */
export async function clearBotHalted() {
  await ensureWalMode();
  return prisma.botStatus.upsert({
    where: { id: 1 },
    update: {
      isHalted: false,
      haltReason: null,
      haltedAt: null,
    },
    create: {
      id: 1,
      isHalted: false,
    },
  });
}

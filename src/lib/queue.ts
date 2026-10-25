import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { db, toSqliteDateTime } from "./db";
import { botStatuses, menfess } from "./schema";

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
  const tenMinutesAgo = toSqliteDateTime(new Date(Date.now() - 10 * 60 * 1000));

  const stuckJobs = await db
    .update(menfess)
    .set({
      status: "pending",
      errorMessage: "Recovered from hanging processing state upon restart.",
    })
    .where(and(eq(menfess.status, "processing"), lt(menfess.createdAt, tenMinutesAgo)))
    .returning({ id: menfess.id });

  if (stuckJobs.length > 0) {
    console.log(`[Queue] Recovered ${stuckJobs.length} hanging jobs back to 'pending'.`);
  }

  return stuckJobs.length;
}

/**
 * Counts how many posts have been published today to enforce conservative daily limit.
 */
export async function getTodayPublishedCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ value: count() })
    .from(menfess)
    .where(and(eq(menfess.status, "published"), gte(menfess.publishedAt, toSqliteDateTime(startOfDay))));
  return result?.value ?? 0;
}

/**
 * Gets the next pending menfess message ordered by createdAt ascending (FIFO)
 */
export async function getNextPendingMenfess() {
  const [job] = await db
    .select()
    .from(menfess)
    .where(eq(menfess.status, "pending"))
    .orderBy(asc(menfess.createdAt))
    .limit(1);
  return job;
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
  await db.insert(botStatuses).values({ id: 1, isHalted: false }).onConflictDoNothing();
  const [status] = await db.select().from(botStatuses).where(eq(botStatuses.id, 1));
  return status;
}

/**
 * Records that the worker has halted due to critical checkpoint or login failure
 */
export async function setBotHalted(reason: string) {
  const now = toSqliteDateTime();
  await db
    .insert(botStatuses)
    .values({ id: 1, isHalted: true, haltReason: reason, haltedAt: now })
    .onConflictDoUpdate({
      target: botStatuses.id,
      set: {
        isHalted: true,
        haltReason: reason,
        haltedAt: now,
        updatedAt: now,
      },
    });
  const [status] = await db.select().from(botStatuses).where(eq(botStatuses.id, 1));
  return status;
}

/**
 * Clears the halted status so the worker can resume processing
 */
export async function clearBotHalted() {
  const now = toSqliteDateTime();
  await db
    .insert(botStatuses)
    .values({ id: 1, isHalted: false })
    .onConflictDoUpdate({
      target: botStatuses.id,
      set: {
        isHalted: false,
        haltReason: null,
        haltedAt: null,
        updatedAt: now,
      },
    });
  const [status] = await db.select().from(botStatuses).where(eq(botStatuses.id, 1));
  return status;
}

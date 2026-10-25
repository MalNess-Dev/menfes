import dotenv from "dotenv";
import path from "path";
import { eq } from "drizzle-orm";

// Load .env.local first, then fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { db, toSqliteDateTime } from "../lib/db";
import { menfess } from "../lib/schema";
import {
  recoverHangingJobs,
  getNextPendingMenfess,
  getTodayPublishedCount,
  getQueueConfig,
  isBotPaused,
  getRandomDelayMs,
  getBotStatus,
  setBotHalted,
} from "../lib/queue";
import { renderAllSlides } from "../lib/template";
import {
  publishImage,
  publishAlbum,
  buildCaption,
  IgCheckpointError,
  IgLoginRequiredError,
} from "../lib/instagram";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runWorker() {
  console.log("==================================================================");
  console.log("🚀 Simple IG Menfess Worker Started");
  console.log("==================================================================");

  const igUser = process.env.IG_USERNAME?.trim() || "";
  const igPass = process.env.IG_PASSWORD?.trim() || "";
  const igSid = process.env.IG_SESSIONID?.trim() || "";
  const isMock = process.env.IG_DEV_MOCK === "true";

  console.log("📋 Pengecekan Kredensial Instagram (.env / .env.local):");
  console.log(`   • IG_USERNAME  : ${igUser ? "@" + igUser : "(KOSONG - Belum Disimpan / Belum Diisi)"}`);
  console.log(`   • IG_PASSWORD  : ${igPass ? "****** (" + igPass.length + " karakter)" : "(KOSONG - Belum Disimpan / Belum Diisi)"}`);
  console.log(`   • IG_SESSIONID : ${igSid ? igSid.slice(0, 10) + "..." : "(KOSONG - Opsional)"}`);
  console.log(`   • IG_DEV_MOCK  : ${isMock ? "AKTIF (Mode Simulasi)" : "TIDAK AKTIF"}`);
  console.log("------------------------------------------------------------------");

  // 1. Recover any jobs stuck in 'processing' from a previous crash/restart
  try {
    await recoverHangingJobs();
  } catch (err) {
    console.error("Error during startup hang recovery:", err);
  }

  // Continuous worker loop
  while (true) {
    const config = getQueueConfig();

    // Check if worker was halted due to checkpoint or login failure
    try {
      const botStatus = await getBotStatus();
      if (botStatus?.isHalted) {
        console.warn("\n==================================================================");
        console.warn("🛑 [WORKER HALTED] Bot sedang dalam status BERHENTI.");
        console.warn(`Alasan: ${botStatus.haltReason || "Instagram Checkpoint / Login Failure"}`);
        console.warn("Selesaikan verifikasi pada akun Instagram, lalu jalankan:");
        console.warn("👉 npm run admin resume");
        console.warn("==================================================================\n");
        await sleep(30000);
        continue;
      }
    } catch (err) {
      console.error("[Worker] Error checking bot status:", err);
    }

    // Check if worker is paused via BOT_PAUSED env flag
    if (isBotPaused()) {
      console.log("[Worker] BOT_PAUSED=true terdeteksi. Worker dijeda. Menunggu 30s...");
      await sleep(30000);
      continue;
    }

    // Check daily post limit
    try {
      const todayCount = await getTodayPublishedCount();
      if (todayCount >= config.maxDailyPosts) {
        console.log(
          `[Worker] Batas posting harian tercapai (${todayCount}/${config.maxDailyPosts}). Tidur selama 30 menit...`
        );
        await sleep(30 * 60 * 1000);
        continue;
      }
    } catch (err) {
      console.error("[Worker] Error checking daily post count:", err);
    }

    // Check if Instagram credentials exist before picking jobs
    const hasCreds =
      Boolean(process.env.IG_SESSIONID?.trim()) ||
      Boolean(process.env.IG_USERNAME?.trim() && process.env.IG_PASSWORD?.trim()) ||
      process.env.IG_DEV_MOCK === "true";

    if (!hasCreds) {
      console.log(
        "[Worker] ⚠️ Kredensial Instagram belum diisi di file .env (isi IG_USERNAME & IG_PASSWORD atau IG_SESSIONID). Antrean ditahan aman tanpa gagal. Menunggu 30 detik..."
      );
      await sleep(30000);
      continue;
    }

    // Fetch next pending job
    let job;
    try {
      job = await getNextPendingMenfess();
    } catch (err) {
      console.error("[Worker] Database query error:", err);
      await sleep(10000);
      continue;
    }

    if (!job) {
      // No pending jobs, poll every 10 seconds
      await sleep(10000);
      continue;
    }

    console.log(`\n[Worker] Memproses Menfess #${job.id} (Percobaan: ${job.retryCount + 1}/3)...`);

    // Lock job into 'processing'
    try {
      await db.update(menfess).set({ status: "processing" }).where(eq(menfess.id, job.id));
    } catch (err) {
      console.error(`[Worker] Gagal mengupdate status ke processing untuk #${job.id}:`, err);
      await sleep(5000);
      continue;
    }

    let isCheckpointError = false;
    let haltMessage = "";

    try {
      // 1. Generate JPEG buffers for slides according to chosen template
      let templateStyle: "comic" | "unj-classic" | "cyber" | "scrapbook" = "comic";
      if (job.senderDevice && job.senderDevice.includes("template:")) {
        const parsed = job.senderDevice.split("template:")[1]?.trim();
        if (parsed && ["comic", "unj-classic", "cyber", "scrapbook"].includes(parsed)) {
          templateStyle = parsed as "comic" | "unj-classic" | "cyber" | "scrapbook";
        }
      }

      console.log(`[Worker] Membuat gambar template (${templateStyle}) untuk Menfess #${job.id}...`);
      const slideBuffers = await renderAllSlides(job.recipient, job.sender, job.message, templateStyle);
      const totalSlides = slideBuffers.length;
      console.log(`[Worker] Berhasil merender ${totalSlides} slide (${templateStyle}) untuk Menfess #${job.id}.`);

      // 2. Build caption
      const caption = buildCaption(job.recipient, job.sender, job.id);

      // 3. Post to Instagram
      let mediaId: string;
      if (totalSlides === 1) {
        console.log(`[Worker] Mengunggah foto tunggal ke Instagram...`);
        mediaId = await publishImage(slideBuffers[0], caption);
      } else {
        console.log(`[Worker] Mengunggah album carousel (${totalSlides} slide) ke Instagram...`);
        mediaId = await publishAlbum(slideBuffers, caption);
      }

      // 4. Update status to 'published'
      await db
        .update(menfess)
        .set({
          status: "published",
          igMediaId: mediaId,
          slideCount: totalSlides,
          publishedAt: toSqliteDateTime(),
          errorMessage: null,
        })
        .where(eq(menfess.id, job.id));

      console.log(`✅ [Worker] Menfess #${job.id} BERHASIL diposting! Media ID: ${mediaId}`);
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`❌ [Worker] Gagal memposting Menfess #${job.id}:`, err.message);

      // Check for Checkpoint or Login Required
      if (
        error instanceof IgCheckpointError ||
        error instanceof IgLoginRequiredError ||
        err.name === "IgCheckpointError" ||
        err.name === "IgLoginRequiredError" ||
        err.message?.toLowerCase().includes("checkpoint") ||
        err.message?.toLowerCase().includes("login_required")
      ) {
        isCheckpointError = true;
        haltMessage = `Instagram Checkpoint / Login Gagal: ${err.message}`;

        // Save halt state to database so admin status can display it
        await setBotHalted(haltMessage);

        console.error("\n==================================================================");
        console.error("🛑 [WORKER BERHENTI / HALTED]");
        console.error("Terdeteksi IgCheckpointError atau IgLoginRequiredError pada akun Instagram.");
        console.error(`Alasan: ${haltMessage}`);
        console.error("Worker otomatis dihentikan untuk melindungi akun.");
        console.error("Alasan ini disimpan di database dan tampil di: npm run admin status");
        console.error("==================================================================\n");
      }

      const nextRetry = job.retryCount + 1;
      const willFailPermanently = nextRetry >= 3 || isCheckpointError;

      await db
        .update(menfess)
        .set({
          retryCount: nextRetry,
          status: willFailPermanently ? "failed" : "pending",
          errorMessage: isCheckpointError ? haltMessage : err.message || "Error saat pemrosesan",
        })
        .where(eq(menfess.id, job.id));

      if (isCheckpointError) {
        process.exit(1);
      }
    }

    // Wait random delay between posts (5 to 15 minutes by default)
    const delayMs = getRandomDelayMs(config.minDelaySeconds, config.maxDelaySeconds);
    const delayMin = (delayMs / 60000).toFixed(1);
    console.log(`[Worker] Menunggu jeda aman ${delayMin} menit sebelum postingan berikutnya...`);
    await sleep(delayMs);
  }
}

// Start worker
runWorker().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});

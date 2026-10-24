import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  getTodayPublishedCount,
  isBotPaused,
  getBotStatus,
  clearBotHalted,
} from "../src/lib/queue";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command.toLowerCase()) {
    case "status": {
      const [pending, processing, published, failed, rejected, todayCount, botStatus] =
        await Promise.all([
          prisma.menfess.count({ where: { status: "pending" } }),
          prisma.menfess.count({ where: { status: "processing" } }),
          prisma.menfess.count({ where: { status: "published" } }),
          prisma.menfess.count({ where: { status: "failed" } }),
          prisma.menfess.count({ where: { status: "rejected" } }),
          getTodayPublishedCount(),
          getBotStatus(),
        ]);

      console.log("\n==================================================================");
      console.log("📊 Simple IG Menfess — Status Sistem & Bot");
      console.log("==================================================================");

      if (botStatus?.isHalted) {
        console.log("Status Operasional: 🛑 HALTED (Worker Berhenti Total)");
        console.log(`Alasan Berhenti:    ${botStatus.haltReason || "Terjadi Checkpoint / Gagal Login"}`);
        console.log(
          `Waktu Kejadian:     ${
            botStatus.haltedAt ? new Date(botStatus.haltedAt).toLocaleString("id-ID") : "-"
          }`
        );
        console.log("👉 Jalankan 'npm run admin resume' setelah menyelesaikan verifikasi di IG.");
      } else if (isBotPaused()) {
        console.log("Status Operasional: ⏸️  PAUSED (Dijeda via BOT_PAUSED=true di .env)");
      } else {
        console.log("Status Operasional: 🟢 NORMAL (Worker Aktif & Siap Berjalan)");
      }

      console.log("------------------------------------------------------------------");
      console.log(`Postingan Hari Ini: ${todayCount} posts`);
      console.log(`Pending:            ${pending}`);
      console.log(`Processing:         ${processing}`);
      console.log(`Published:          ${published}`);
      console.log(`Failed:             ${failed}`);
      console.log(`Rejected:           ${rejected}`);
      console.log("==================================================================\n");
      break;
    }

    case "list": {
      const filterStatus = args[1]; // optional filter e.g. list pending
      const whereClause = filterStatus ? { status: filterStatus } : {};

      const items = await prisma.menfess.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 25,
      });

      console.log("\n==========================================================================================");
      console.log(`📋 Menfess Messages List (Recent 25${filterStatus ? ` - Status: ${filterStatus}` : ""})`);
      console.log("==========================================================================================");

      if (items.length === 0) {
        console.log("Tidak ada pesan.");
      } else {
        for (const item of items) {
          const preview = item.message.replace(/\n/g, " ").slice(0, 45);
          console.log(
            `#${item.id.toString().padEnd(4)} | [${item.status.toUpperCase().padEnd(10)}] | To: ${(
              item.recipient || "-"
            ).padEnd(12)} | From: ${(item.sender || "-").padEnd(12)} | Retry: ${item.retryCount} | "${preview}..."`
          );
          if (item.errorMessage) {
            console.log(`      ↳ Error: ${item.errorMessage}`);
          }
        }
      }
      console.log("==========================================================================================\n");
      break;
    }

    case "reject": {
      const id = parseInt(args[1], 10);
      if (isNaN(id)) {
        console.error("❌ Gunakan: npm run admin reject <id>");
        process.exit(1);
      }

      const existing = await prisma.menfess.findUnique({ where: { id } });
      if (!existing) {
        console.error(`❌ Menfess #${id} tidak ditemukan.`);
        process.exit(1);
      }

      await prisma.menfess.update({
        where: { id },
        data: { status: "rejected" },
      });

      console.log(`🚫 Menfess #${id} berhasil ditandai sebagai REJECTED.`);
      break;
    }

    case "retry": {
      const id = parseInt(args[1], 10);
      if (isNaN(id)) {
        console.error("❌ Gunakan: npm run admin retry <id>");
        process.exit(1);
      }

      const existing = await prisma.menfess.findUnique({ where: { id } });
      if (!existing) {
        console.error(`❌ Menfess #${id} tidak ditemukan.`);
        process.exit(1);
      }

      await prisma.menfess.update({
        where: { id },
        data: {
          status: "pending",
          retryCount: 0,
          errorMessage: null,
        },
      });

      console.log(`🔄 Menfess #${id} berhasil direset ke status PENDING dan akan diproses worker.`);
      break;
    }

    case "resume":
    case "unhalt": {
      await clearBotHalted();
      console.log("✅ Status halt bot berhasil dibersihkan. Worker dapat melanjutkan pemrosesan.");
      break;
    }

    default: {
      console.log("\n==================================================================");
      console.log("🛠️  Simple IG Menfess Admin CLI");
      console.log("==================================================================");
      console.log("Perintah yang tersedia:");
      console.log("  npm run admin status         - Cek status antrean, bot, & alasan halt jika ada");
      console.log("  npm run admin list [status]  - Lihat 25 pesan terbaru (opsional: pending, failed, dll)");
      console.log("  npm run admin reject <id>    - Tolak pesan dari antrean");
      console.log("  npm run admin retry <id>     - Reset pesan failed/rejected ke status pending");
      console.log("  npm run admin resume         - Reset status halt bot setelah checkpoint selesai");
      console.log("==================================================================\n");
      break;
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Admin CLI error:", e);
  process.exit(1);
});

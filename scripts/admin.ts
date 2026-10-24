import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { prisma, ensureWalMode } from "../src/lib/prisma";

async function main() {
  await ensureWalMode();

  const [pending, processing, published, failed, rejected] = await Promise.all([
    prisma.menfess.count({ where: { status: "pending" } }),
    prisma.menfess.count({ where: { status: "processing" } }),
    prisma.menfess.count({ where: { status: "published" } }),
    prisma.menfess.count({ where: { status: "failed" } }),
    prisma.menfess.count({ where: { status: "rejected" } }),
  ]);

  console.log("\n=======================================================");
  console.log("📨 Status Antrean IG Menfess");
  console.log("=======================================================");
  console.log(`⏳ Menfess Menunggu (Pending):   ${pending}`);
  console.log(`⚙️  Sedang Diproses:             ${processing}`);
  console.log(`✅ Berhasil Diposting:           ${published}`);
  console.log(`⚠️  Gagal / Retry:                ${failed}`);
  console.log(`❌ Ditolak:                      ${rejected}`);
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import dotenv from "dotenv";
import path from "path";
import { count } from "drizzle-orm";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { db, closeDatabase } from "../src/lib/db";
import { menfess } from "../src/lib/schema";

async function main() {
  const counts = await db
    .select({ status: menfess.status, total: count() })
    .from(menfess)
    .groupBy(menfess.status);
  const byStatus = new Map<string, number>(
    counts.map((row: { status: string; total: number }) => [row.status, Number(row.total)])
  );
  const pending = byStatus.get("pending") ?? 0;
  const processing = byStatus.get("processing") ?? 0;
  const published = byStatus.get("published") ?? 0;
  const failed = byStatus.get("failed") ?? 0;
  const rejected = byStatus.get("rejected") ?? 0;

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
    await closeDatabase();
  });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const databaseUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: databaseUrl,
  ...(authToken ? { authToken } : {}),
});

export const db = drizzle(client, { schema });

export function toSqliteDateTime(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function closeDatabase() {
  client.close();
}

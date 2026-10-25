import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () => text("createdAt").notNull().default(sql`(CURRENT_TIMESTAMP)`);
const updatedAt = () => text("updatedAt").notNull().default(sql`(CURRENT_TIMESTAMP)`);

export const users = sqliteTable(
  "User",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("passwordHash").notNull(),
    salt: text("salt").notNull(),
    role: text("role").notNull().default("user"),
    isBanned: integer("isBanned", { mode: "boolean" }).notNull().default(false),
    banReason: text("banReason"),
    registeredIp: text("registeredIp"),
    lastLoginIp: text("lastLoginIp"),
    userAgent: text("userAgent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("User_username_key").on(table.username),
    index("User_username_idx").on(table.username),
    index("User_role_idx").on(table.role),
    index("User_isBanned_idx").on(table.isBanned),
  ],
);

export const bannedIps = sqliteTable(
  "BannedIp",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ip: text("ip").notNull(),
    reason: text("reason"),
    bannedAt: text("bannedAt").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("BannedIp_ip_key").on(table.ip),
    index("BannedIp_ip_idx").on(table.ip),
  ],
);

export const menfess = sqliteTable(
  "Menfess",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipient: text("recipient"),
    sender: text("sender"),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    errorMessage: text("errorMessage"),
    retryCount: integer("retryCount").notNull().default(0),
    igMediaId: text("igMediaId"),
    createdAt: createdAt(),
    publishedAt: text("publishedAt"),
    slideCount: integer("slideCount").notNull().default(1),
    userId: integer("userId").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    senderUsername: text("senderUsername"),
    senderIp: text("senderIp"),
    senderDevice: text("senderDevice"),
    senderUserAgent: text("senderUserAgent"),
  },
  (table) => [
    index("Menfess_status_idx").on(table.status),
    index("Menfess_createdAt_idx").on(table.createdAt),
    index("Menfess_userId_idx").on(table.userId),
    index("Menfess_senderIp_idx").on(table.senderIp),
  ],
);

export const igSessions = sqliteTable("IgSession", {
  id: integer("id").primaryKey().default(1),
  sessionData: text("sessionData").notNull(),
  updatedAt: updatedAt(),
});

export const botStatuses = sqliteTable("BotStatus", {
  id: integer("id").primaryKey().default(1),
  isHalted: integer("isHalted", { mode: "boolean" }).notNull().default(false),
  haltReason: text("haltReason"),
  haltedAt: text("haltedAt"),
  updatedAt: updatedAt(),
});

export const usersRelations = relations(users, ({ many }) => ({
  menfess: many(menfess),
}));

export const menfessRelations = relations(menfess, ({ one }) => ({
  user: one(users, {
    fields: [menfess.userId],
    references: [users.id],
  }),
}));

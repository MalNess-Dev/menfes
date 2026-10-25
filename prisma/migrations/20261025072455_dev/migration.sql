-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "registeredIp" TEXT,
    "lastLoginIp" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BannedIp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Menfess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipient" TEXT,
    "sender" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "igMediaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "slideCount" INTEGER NOT NULL DEFAULT 1,
    "userId" INTEGER,
    "senderUsername" TEXT,
    "senderIp" TEXT,
    "senderDevice" TEXT,
    "senderUserAgent" TEXT,
    CONSTRAINT "Menfess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IgSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "sessionData" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BotStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "isHalted" BOOLEAN NOT NULL DEFAULT false,
    "haltReason" TEXT,
    "haltedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "BannedIp_ip_key" ON "BannedIp"("ip");

-- CreateIndex
CREATE INDEX "BannedIp_ip_idx" ON "BannedIp"("ip");

-- CreateIndex
CREATE INDEX "Menfess_status_idx" ON "Menfess"("status");

-- CreateIndex
CREATE INDEX "Menfess_createdAt_idx" ON "Menfess"("createdAt");

-- CreateIndex
CREATE INDEX "Menfess_userId_idx" ON "Menfess"("userId");

-- CreateIndex
CREATE INDEX "Menfess_senderIp_idx" ON "Menfess"("senderIp");

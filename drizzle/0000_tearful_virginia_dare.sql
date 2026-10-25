CREATE TABLE `BannedIp` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`reason` text,
	`bannedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BannedIp_ip_key` ON `BannedIp` (`ip`);--> statement-breakpoint
CREATE INDEX `BannedIp_ip_idx` ON `BannedIp` (`ip`);--> statement-breakpoint
CREATE TABLE `BotStatus` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`isHalted` integer DEFAULT false NOT NULL,
	`haltReason` text,
	`haltedAt` text,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `IgSession` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`sessionData` text NOT NULL,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Menfess` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient` text,
	`sender` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`errorMessage` text,
	`retryCount` integer DEFAULT 0 NOT NULL,
	`igMediaId` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`publishedAt` text,
	`slideCount` integer DEFAULT 1 NOT NULL,
	`userId` integer,
	`senderUsername` text,
	`senderIp` text,
	`senderDevice` text,
	`senderUserAgent` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Menfess_status_idx` ON `Menfess` (`status`);--> statement-breakpoint
CREATE INDEX `Menfess_createdAt_idx` ON `Menfess` (`createdAt`);--> statement-breakpoint
CREATE INDEX `Menfess_userId_idx` ON `Menfess` (`userId`);--> statement-breakpoint
CREATE INDEX `Menfess_senderIp_idx` ON `Menfess` (`senderIp`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL,
	`salt` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`isBanned` integer DEFAULT false NOT NULL,
	`banReason` text,
	`registeredIp` text,
	`lastLoginIp` text,
	`userAgent` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_username_key` ON `User` (`username`);--> statement-breakpoint
CREATE INDEX `User_username_idx` ON `User` (`username`);--> statement-breakpoint
CREATE INDEX `User_role_idx` ON `User` (`role`);--> statement-breakpoint
CREATE INDEX `User_isBanned_idx` ON `User` (`isBanned`);
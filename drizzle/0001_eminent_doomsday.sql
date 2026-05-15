CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`quotaId` int,
	`type` enum('contact','update','completion','note') NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320) NOT NULL,
	`address` text NOT NULL,
	`importantInfo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`group` varchar(100) NOT NULL,
	`quotaNumber` varchar(100) NOT NULL,
	`contactReason` text,
	`lastContactDate` date,
	`returnDate` date,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`generalObservations` text,
	`thayneCheck` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotas_id` PRIMARY KEY(`id`)
);

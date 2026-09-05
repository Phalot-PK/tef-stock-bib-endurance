CREATE TABLE `allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`color` text NOT NULL,
	`bib_confirm` integer NOT NULL,
	`bib_sign` integer NOT NULL,
	`rider` text NOT NULL,
	`club` text NOT NULL,
	`initial_location` text NOT NULL,
	`current_location` text NOT NULL,
	`current_status` text NOT NULL,
	`stock_code` text NOT NULL,
	`stock_color` text NOT NULL,
	`match_status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`event` text NOT NULL,
	`color` text NOT NULL,
	`bib` integer NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`allocation_id` integer NOT NULL,
	`action` text NOT NULL,
	`person` text NOT NULL,
	`from_location` text NOT NULL,
	`to_location` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);

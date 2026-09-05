CREATE INDEX `idx_allocations_location` ON `allocations` (`current_location`);--> statement-breakpoint
CREATE INDEX `idx_allocations_bib` ON `allocations` (`bib_confirm`);--> statement-breakpoint
CREATE INDEX `idx_transactions_allocation_created` ON `transactions` (`allocation_id`,`created_at`);
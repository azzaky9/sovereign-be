-- Wipe existing transaction data since they have arbitrary strings like 'base' which cannot cast to UUID.
TRUNCATE TABLE "disbursements" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "balance_ledgers" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "deposits" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "deposit_wallets" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "user_balances" CASCADE;--> statement-breakpoint

-- Drop old string columns
ALTER TABLE "deposit_wallets" DROP COLUMN "network";--> statement-breakpoint
ALTER TABLE "deposits" DROP COLUMN "network";--> statement-breakpoint

-- Add the new properly typed UUID constraint columns
ALTER TABLE "deposit_wallets" ADD COLUMN "network_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "network_id" uuid NOT NULL;--> statement-breakpoint

-- Re-establish the foreign key relations
ALTER TABLE "deposit_wallets" ADD CONSTRAINT "deposit_wallets_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;
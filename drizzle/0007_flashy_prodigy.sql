ALTER TABLE "deposit_wallets" ALTER COLUMN "private_key" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "deposit_wallets" ALTER COLUMN "private_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deposit_wallets" DROP COLUMN "derivation_index";
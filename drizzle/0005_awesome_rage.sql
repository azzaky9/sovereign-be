-- Wipe existing transaction data since they have arbitrary strings like 'base' which cannot cast to UUID.
TRUNCATE TABLE "disbursements" CASCADE;
TRUNCATE TABLE "balance_ledgers" CASCADE;
TRUNCATE TABLE "deposits" CASCADE;
TRUNCATE TABLE "deposit_wallets" CASCADE;
TRUNCATE TABLE "user_balances" CASCADE;

-- Drop old string columns
ALTER TABLE "deposit_wallets" DROP COLUMN "network";
ALTER TABLE "deposits" DROP COLUMN "network";

-- Add the new properly typed UUID constraint columns
ALTER TABLE "deposit_wallets" ADD COLUMN "network_id" uuid NOT NULL;
ALTER TABLE "deposits" ADD COLUMN "network_id" uuid NOT NULL;

-- Re-establish the foreign key relations
ALTER TABLE "deposit_wallets" ADD CONSTRAINT "deposit_wallets_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;
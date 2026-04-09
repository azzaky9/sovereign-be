CREATE TYPE "public"."network" AS ENUM('ETH', 'BSC', 'POLYGON', 'TRON');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'processing', 'settled', 'failed');--> statement-breakpoint
CREATE TABLE "deposit_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"network" "network" NOT NULL,
	"address" varchar(100) NOT NULL,
	"derivation_index" numeric NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "deposit_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"wallet_id" uuid,
	"tx_hash" varchar(100) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"network" "network" NOT NULL,
	"status" "status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"settled_at" timestamp,
	CONSTRAINT "deposits_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" uuid,
	"to_address" varchar(100) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"tx_hash" varchar(100),
	"type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_wallet_id_deposit_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."deposit_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;
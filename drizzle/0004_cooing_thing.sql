CREATE TYPE "public"."network_mode" AS ENUM('testnet', 'mainnet');--> statement-breakpoint
ALTER TABLE "networks" ADD COLUMN "rpc_url" varchar(255);--> statement-breakpoint
ALTER TABLE "networks" ADD COLUMN "block_explorer" varchar(255);--> statement-breakpoint
ALTER TABLE "networks" ADD COLUMN "chain_id" varchar;--> statement-breakpoint
ALTER TABLE "networks" ADD COLUMN "mode" "network_mode" NOT NULL DEFAULT 'mainnet';
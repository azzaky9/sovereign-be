ALTER TABLE "networks" ADD COLUMN "contract_address" varchar(100) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "networks" ADD COLUMN "decimal" integer NOT NULL DEFAULT 18;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "amount_fee" numeric(20, 8) NOT NULL DEFAULT '0';
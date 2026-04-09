ALTER TABLE "deposit_wallets"
ALTER COLUMN "network" TYPE varchar(50)
USING "network"::text;
--> statement-breakpoint
ALTER TABLE "deposits"
ALTER COLUMN "network" TYPE varchar(50)
USING "network"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."network";
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(10) NOT NULL,
	"network_key" varchar(50) NOT NULL,
	"network_name" varchar(100) NOT NULL,
	"icon_key" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "networks_token_active_idx" ON "networks" USING btree ("token","is_active");

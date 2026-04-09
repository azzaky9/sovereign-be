CREATE TABLE "user_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"balance_idr" numeric(20, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_balances_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "balance_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"deposit_id" uuid,
	"amount_idr" numeric(20, 2) NOT NULL,
	"type" varchar(30) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "balance_ledgers_deposit_id_unique" UNIQUE("deposit_id")
);
--> statement-breakpoint
ALTER TABLE "balance_ledgers" ADD CONSTRAINT "balance_ledgers_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;

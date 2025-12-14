CREATE TABLE "distribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"date_paid" timestamp NOT NULL,
	"ex_date" timestamp,
	"franked_amount" integer DEFAULT 0 NOT NULL,
	"unfranked_amount" integer DEFAULT 0 NOT NULL,
	"tfn_withholding_tax" integer DEFAULT 0 NOT NULL,
	"franking_credits" integer DEFAULT 0 NOT NULL,
	"reinvested" boolean DEFAULT false NOT NULL,
	"reinvestment_shares" integer DEFAULT 0,
	"reinvestment_price" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "distribution" ADD CONSTRAINT "distribution_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE cascade ON UPDATE no action;
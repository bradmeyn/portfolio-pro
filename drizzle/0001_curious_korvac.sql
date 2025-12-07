CREATE TABLE "investment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"current_price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holding" ADD COLUMN "investment_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_investment_id_investment_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "holding" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "holding" DROP COLUMN "average_price";--> statement-breakpoint
ALTER TABLE "holding" DROP COLUMN "units";
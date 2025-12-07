ALTER TABLE "investment" ADD COLUMN "management_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "investment" DROP COLUMN "current_price";
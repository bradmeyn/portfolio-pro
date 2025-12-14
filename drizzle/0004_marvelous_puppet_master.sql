ALTER TABLE "distribution" ADD COLUMN "gross_payment" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "distribution" ADD COLUMN "tax_withheld" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "ex_date";--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "franked_amount";--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "unfranked_amount";--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "tfn_withholding_tax";--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "franking_credits";--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "reinvestment_shares";--> statement-breakpoint
ALTER TABLE "distribution" DROP COLUMN "reinvestment_price";
ALTER TABLE "reviews" DROP CONSTRAINT "score_range";--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "score" SET DATA TYPE real;--> statement-breakpoint
UPDATE "reviews" SET "score" = ROUND(("score" / 20.0)::numeric, 1)::real;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "score_range" CHECK ("reviews"."score" >= 0 AND "reviews"."score" <= 5);
ALTER TABLE "reviews" DROP CONSTRAINT "score_range";--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "score_range" CHECK ("reviews"."score" >= 0 AND "reviews"."score" <= 100);
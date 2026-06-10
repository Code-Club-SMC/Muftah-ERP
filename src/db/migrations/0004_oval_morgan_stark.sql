ALTER TABLE "travel_logs" ADD COLUMN "reimbursed_at" timestamp;--> statement-breakpoint
ALTER TABLE "travel_logs" ADD COLUMN "reimbursed_by" text;--> statement-breakpoint
ALTER TABLE "travel_logs" ADD COLUMN "reimbursed_via" text;--> statement-breakpoint
ALTER TABLE "travel_logs" ADD COLUMN "reimbursed_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "travel_logs" ADD CONSTRAINT "travel_logs_reimbursed_by_user_id_fk" FOREIGN KEY ("reimbursed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
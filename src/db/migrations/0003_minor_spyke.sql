CREATE TABLE "sales_performance_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"year_month" text NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"fulfilled_orders" integer DEFAULT 0 NOT NULL,
	"total_order_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_invoices" integer DEFAULT 0 NOT NULL,
	"total_cartons_sold" integer DEFAULT 0 NOT NULL,
	"total_sales_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_target_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"achievement_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"monthly_rank" integer DEFAULT 0 NOT NULL,
	"commission_record_ids" jsonb DEFAULT '[]'::jsonb,
	"invoice_ids" jsonb DEFAULT '[]'::jsonb,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_performance_logs" ADD CONSTRAINT "sales_performance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_perf_logs_employee_month" ON "sales_performance_logs" USING btree ("employee_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_perf_logs_year_month" ON "sales_performance_logs" USING btree ("year_month");
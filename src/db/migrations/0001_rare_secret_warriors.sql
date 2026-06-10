CREATE TABLE "salary_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"revision_date" date NOT NULL,
	"standard_salary" numeric(12, 2) NOT NULL,
	"allowance_config" jsonb NOT NULL,
	"reason" text NOT NULL,
	"changed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discount_rules" ALTER COLUMN "recipe_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_rules" ALTER COLUMN "quantity_threshold" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "discount_rules" ALTER COLUMN "free_units" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "invoice_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "salary_revision_id" text;--> statement-breakpoint
ALTER TABLE "discount_rules" ADD COLUMN "rule_type" text DEFAULT 'free_units' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_rules" ADD COLUMN "discount_cartons" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_rules" ADD COLUMN "discount_percent" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "discount_rules" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_salary_revisions_employee_date" ON "salary_revisions" USING btree ("employee_id","revision_date");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_salary_revision_id_salary_revisions_id_fk" FOREIGN KEY ("salary_revision_id") REFERENCES "public"."salary_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discount_rules_active" ON "discount_rules" USING btree ("is_active");
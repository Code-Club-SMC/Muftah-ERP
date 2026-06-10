CREATE TABLE "bradford_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"payroll_id" text NOT NULL,
	"payslip_id" text,
	"snapshot_year_month" text NOT NULL,
	"total_absences" integer NOT NULL,
	"total_sick_leaves" integer NOT NULL,
	"total_annual_leaves" integer NOT NULL,
	"total_late_arrivals" integer NOT NULL,
	"total_early_departures" integer NOT NULL,
	"night_shifts_count" integer DEFAULT 0 NOT NULL,
	"bradford_factor" numeric(8, 2) NOT NULL,
	"daily_attendance_json" jsonb NOT NULL,
	"unmarked_days_at_close" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bradford_snapshots" ADD CONSTRAINT "bradford_snapshots_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bradford_snapshots" ADD CONSTRAINT "bradford_snapshots_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bradford_snapshots" ADD CONSTRAINT "bradford_snapshots_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bradford_snapshots_employee_month" ON "bradford_snapshots" USING btree ("employee_id","snapshot_year_month");--> statement-breakpoint
CREATE INDEX "idx_bradford_snapshots_payroll" ON "bradford_snapshots" USING btree ("payroll_id");
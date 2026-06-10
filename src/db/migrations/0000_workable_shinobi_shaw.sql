CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'leave', 'holiday');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'on_leave', 'terminated', 'resigned', 'pending_deletion');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'intern');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('sick', 'annual', 'special');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_shop_name" text,
	"email" text,
	"phone" text,
	"national_id" text,
	"address" text,
	"city" text,
	"state" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_field_options" (
	"id" text PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"placeholder" text,
	"helper_text" text,
	"min_length" integer,
	"max_length" integer,
	"min_number" numeric(12, 2),
	"max_number" numeric(12, 2),
	"min_date" timestamp,
	"max_date" timestamp,
	"regex_pattern" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "expense_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "expense_field_values" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value_text" text,
	"value_number" numeric(12, 2),
	"value_date" timestamp,
	"value_boolean" boolean,
	"value_option_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"category_id" text NOT NULL,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"slip_number" text,
	"remarks" text,
	"wallet_id" text NOT NULL,
	"performed_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source" text NOT NULL,
	"reference_id" text,
	"performed_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advance_installments" (
	"id" text PRIMARY KEY NOT NULL,
	"advance_id" text NOT NULL,
	"payslip_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"installment_no" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"check_in" time,
	"check_out" time,
	"check_in_2" time,
	"check_out_2" time,
	"duty_hours" numeric(5, 2) DEFAULT '0',
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"is_late" boolean DEFAULT false,
	"is_night_shift" boolean DEFAULT false,
	"overtime_status" text DEFAULT 'pending',
	"overtime_remarks" text,
	"early_departure_status" text DEFAULT 'none',
	"check_out_reason" text,
	"is_approved_leave" boolean DEFAULT false,
	"leave_approval_status" text DEFAULT 'none',
	"leave_type" "leave_type",
	"entry_source" text DEFAULT 'manual',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bradford_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"payslip_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"computed_score" numeric(8, 2) NOT NULL,
	"override_score" numeric(8, 2) NOT NULL,
	"reason" text NOT NULL,
	"performed_by" text NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"employee_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"cnic" text,
	"phone" text,
	"address" text,
	"designation" text NOT NULL,
	"department" text,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"joining_date" date NOT NULL,
	"bank_name" text,
	"bank_account_number" text,
	"standard_duty_hours" integer DEFAULT 8 NOT NULL,
	"standard_salary" numeric(12, 2) DEFAULT '0',
	"rest_days" jsonb DEFAULT '[0]'::jsonb NOT NULL,
	"allowance_config" jsonb DEFAULT '[{"id":"houseRent","name":"House Rent","amount":0,"deductions":{"absent":true,"annualLeave":false,"sickLeave":false,"specialLeave":true,"lateArrival":false,"earlyLeaving":false}},{"id":"utilities","name":"Utilities","amount":0,"deductions":{"absent":true,"annualLeave":false,"sickLeave":false,"specialLeave":true,"lateArrival":false,"earlyLeaving":false}},{"id":"conveyance","name":"Conveyance Allowance","amount":0,"deductions":{"absent":true,"annualLeave":true,"sickLeave":false,"specialLeave":true,"lateArrival":false,"earlyLeaving":false}},{"id":"fuel","name":"Fuel Allowance","amount":0,"deductions":{"absent":true,"annualLeave":true,"sickLeave":false,"specialLeave":true,"lateArrival":false,"earlyLeaving":false}},{"id":"mobile","name":"Mobile Allowance","amount":0,"deductions":{"absent":true,"annualLeave":false,"sickLeave":false,"specialLeave":true,"lateArrival":false,"earlyLeaving":false}},{"id":"bikeMaintenance","name":"Bike Maintenance","amount":0,"deductions":{"absent":true,"annualLeave":false,"sickLeave":false,"specialLeave":true,"lateArrival":false,"earlyLeaving":false}},{"id":"technical","name":"Technical Allowance","amount":0,"deductions":{"absent":true,"annualLeave":false,"sickLeave":false,"specialLeave":false,"lateArrival":false,"earlyLeaving":false}},{"id":"special","name":"Special Allowance","amount":0,"deductions":{"absent":false,"annualLeave":false,"sickLeave":false,"specialLeave":false,"lateArrival":false,"earlyLeaving":false}},{"id":"nightShift","name":"Night Shift Allowance","amount":0,"deductions":{"absent":false,"annualLeave":false,"sickLeave":false,"specialLeave":false,"lateArrival":false,"earlyLeaving":false}}]'::jsonb,
	"annual_leave_balance" integer DEFAULT 14,
	"annual_leave_allowance" integer DEFAULT 14,
	"leave_year_start" date,
	"sick_leave_balance" integer DEFAULT 10,
	"is_order_booker" boolean DEFAULT false NOT NULL,
	"is_salesman" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "night_shift_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"rate_per_night" numeric(10, 2) NOT NULL,
	"remarks" text,
	"set_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "night_shift_rates_year_unique" UNIQUE("year")
);
--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" text PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'draft',
	"total_amount" numeric(15, 2) DEFAULT '0',
	"processed_by" text,
	"wallet_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" text PRIMARY KEY NOT NULL,
	"payroll_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"days_present" integer DEFAULT 0,
	"days_absent" integer DEFAULT 0,
	"days_leave" integer DEFAULT 0,
	"total_overtime_hours" numeric(8, 2) DEFAULT '0',
	"night_shifts_count" integer DEFAULT 0,
	"basic_salary" numeric(12, 2) NOT NULL,
	"allowance_breakdown" jsonb DEFAULT '{}'::jsonb,
	"incentive_amount" numeric(12, 2) DEFAULT '0',
	"commission_amount" numeric(12, 2) DEFAULT '0',
	"overtime_amount" numeric(12, 2) DEFAULT '0',
	"night_shift_allowance_amount" numeric(12, 2) DEFAULT '0',
	"bonus_amount" numeric(12, 2) DEFAULT '0',
	"absent_deduction" numeric(12, 2) DEFAULT '0',
	"leave_deduction" numeric(12, 2) DEFAULT '0',
	"advance_deduction" numeric(12, 2) DEFAULT '0',
	"tax_deduction" numeric(12, 2) DEFAULT '0',
	"other_deduction" numeric(12, 2) DEFAULT '0',
	"bradford_factor_score" numeric(8, 2) DEFAULT '0',
	"bradford_factor_override" numeric(8, 2),
	"bradford_factor_period" text,
	"yearly_bradford_score" numeric(8, 2) DEFAULT '0',
	"gross_salary" numeric(12, 2) NOT NULL,
	"total_deductions" numeric(12, 2) NOT NULL,
	"net_salary" numeric(12, 2) NOT NULL,
	"arrears_amount" numeric(12, 2) DEFAULT '0',
	"arrears_from_months" jsonb DEFAULT '[]'::jsonb,
	"payment_source" text,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_advances" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"wallet_id" text,
	"paid_at" timestamp,
	"deducted_in_payslip_id" text,
	"installment_months" integer DEFAULT 1 NOT NULL,
	"installment_amount" numeric(12, 2),
	"installments_paid" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tada_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"rate_per_km" numeric(8, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"remarks" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"set_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"destination" text NOT NULL,
	"round_trip_km" numeric(8, 2) NOT NULL,
	"rate_applied" numeric(8, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"purpose" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"paid_in_payslip_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chemical_lab_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"chemical_id" text NOT NULL,
	"product_name" text NOT NULL,
	"stock_number" text,
	"lot_number" text,
	"analysis_items" jsonb NOT NULL,
	"certified_by" text NOT NULL,
	"certifier_title" text,
	"report_date" timestamp NOT NULL,
	"standard_reference" text,
	"notes" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chemicals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'kg' NOT NULL,
	"cost_per_unit" numeric(10, 2) DEFAULT '0',
	"minimum_stock_level" numeric(10, 2) DEFAULT '0',
	"packaging_type" text,
	"packaging_size" text,
	"last_supplier_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finished_goods_stock" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"quantity_cartons" integer DEFAULT 0 NOT NULL,
	"quantity_containers" integer DEFAULT 0 NOT NULL,
	"weighted_average_cost_per_pack" numeric(10, 4) DEFAULT '0',
	"weighted_average_cost_per_carton" numeric(12, 4) DEFAULT '0',
	"total_inventory_value" numeric(14, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"material_type" text NOT NULL,
	"material_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 3) NOT NULL,
	"reason" text NOT NULL,
	"performed_by_id" text NOT NULL,
	"reference_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_stock" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"chemical_id" text,
	"packaging_material_id" text,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packaging_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'primary' NOT NULL,
	"capacity" numeric(10, 2),
	"capacity_unit" text,
	"weight_per_pack" numeric(10, 3),
	"price_per_kg" numeric(10, 2),
	"associated_sticker_id" text,
	"sticker_cost" numeric(10, 2) DEFAULT '0',
	"cost_per_unit" numeric(10, 2) DEFAULT '0',
	"minimum_stock_level" integer DEFAULT 0,
	"last_supplier_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_materials_used" (
	"id" text PRIMARY KEY NOT NULL,
	"production_run_id" text NOT NULL,
	"material_type" text NOT NULL,
	"material_id" text NOT NULL,
	"quantity_used" numeric(12, 3) NOT NULL,
	"cost_per_unit" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"operator_id" text NOT NULL,
	"initiator_id" text,
	"batches_produced" integer NOT NULL,
	"cartons_produced" integer DEFAULT 0,
	"containers_produced" integer NOT NULL,
	"completed_units" integer DEFAULT 0,
	"loose_units_produced" integer DEFAULT 0,
	"planned_cartons_produced" integer DEFAULT 0,
	"actual_cartons_produced" integer DEFAULT 0,
	"actual_packs_produced" integer DEFAULT 0,
	"actual_loose_units_produced" integer DEFAULT 0,
	"total_chemical_cost" numeric(12, 2) DEFAULT '0',
	"total_packaging_cost" numeric(12, 2) DEFAULT '0',
	"total_production_cost" numeric(12, 2) DEFAULT '0',
	"cost_per_container" numeric(10, 4) DEFAULT '0',
	"actual_cost_per_pack" numeric(10, 4) DEFAULT '0',
	"actual_cost_per_carton" numeric(10, 4) DEFAULT '0',
	"shortfall_units" integer DEFAULT 0,
	"shortfall_reason" text,
	"yield_variance_cartons" integer DEFAULT 0,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_start_date" timestamp,
	"actual_start_date" timestamp,
	"actual_completion_date" timestamp,
	"closed_by" text,
	"reopened_at" timestamp,
	"reopened_by" text,
	"reopen_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_runs_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"chemical_id" text NOT NULL,
	"quantity_per_batch" numeric(10, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_packaging" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"packaging_material_id" text NOT NULL,
	"quantity_per_container" numeric(10, 6) NOT NULL,
	"is_optional" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"batch_size" numeric(10, 2) NOT NULL,
	"batch_unit" text DEFAULT 'liters' NOT NULL,
	"target_units_per_batch" integer DEFAULT 0 NOT NULL,
	"container_type" text NOT NULL,
	"container_packaging_id" text NOT NULL,
	"fill_amount" numeric(10, 3),
	"fill_unit" text,
	"containers_per_carton" integer DEFAULT 0,
	"carton_packaging_id" text,
	"estimated_cost_per_batch" numeric(12, 2),
	"estimated_cost_per_container" numeric(10, 4),
	"estimated_ingredients_cost" numeric(12, 2),
	"estimated_packaging_cost" numeric(12, 2),
	"min_batch_yield" numeric(5, 2),
	"target_shelf_life" integer,
	"minimum_stock_level" integer DEFAULT 0,
	"notes" text,
	"production_instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"from_warehouse_id" text NOT NULL,
	"to_warehouse_id" text NOT NULL,
	"material_type" text NOT NULL,
	"material_id" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"performed_by_id" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"type" text DEFAULT 'storage' NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustment_log" (
	"id" text PRIMARY KEY NOT NULL,
	"carton_id" text NOT NULL,
	"batch_id" text,
	"sku" text,
	"type" text NOT NULL,
	"packs_before" integer NOT NULL,
	"delta" integer NOT NULL,
	"packs_after" integer NOT NULL,
	"reason" text,
	"related_carton_id" text,
	"dispatch_order_id" text,
	"return_record_id" text,
	"reconciliation_id" text,
	"bulk_operation_id" text,
	"performed_by" text NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cartons" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"production_run_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"sku" text,
	"capacity" integer NOT NULL,
	"current_packs" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PARTIAL' NOT NULL,
	"zone" text,
	"hold_reason" text,
	"hold_started_at" timestamp,
	"hold_expires_at" timestamp,
	"hold_started_by" text,
	"pre_hold_status" text,
	"retired_at" timestamp,
	"retired_reason" text,
	"retired_by" text,
	"dispatched_at" timestamp,
	"dispatch_order_id" text,
	"original_capacity" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrity_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"batch_id" text,
	"carton_sum" integer NOT NULL,
	"ledger_total" integer NOT NULL,
	"delta" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "return_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"return_record_id" text NOT NULL,
	"carton_id" text NOT NULL,
	"packs_returned" integer NOT NULL,
	"condition" text NOT NULL,
	"destination_carton_id" text
);
--> statement-breakpoint
CREATE TABLE "return_records" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_order_id" text NOT NULL,
	"returned_by" text NOT NULL,
	"returned_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"carton_id" text NOT NULL,
	"system_count" integer NOT NULL,
	"physical_count" integer DEFAULT 0 NOT NULL,
	"delta" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by" text
);
--> statement-breakpoint
CREATE TABLE "stock_count_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text,
	"sku" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"started_by" text NOT NULL,
	"approved_by" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "app_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"module_key" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'action' NOT NULL,
	"route_pattern" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "app_role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_role_permissions_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "app_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"default_landing_path" text DEFAULT '/dashboard' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"assigned_by_user_id" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_records" (
	"id" text PRIMARY KEY NOT NULL,
	"order_booker_id" text NOT NULL,
	"order_id" text NOT NULL,
	"fulfilled_amount" numeric(12, 2) NOT NULL,
	"applied_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"paid_in_payslip_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"order_booker_id" text,
	"min_amount" numeric(12, 2) NOT NULL,
	"max_amount" numeric(12, 2),
	"rate" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_recovery_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"slip_id" text NOT NULL,
	"assigned_to_id" text,
	"attempt_method" text DEFAULT 'call' NOT NULL,
	"attempt_outcome" text DEFAULT 'no_answer' NOT NULL,
	"amount_promised" numeric(12, 2),
	"promised_date" timestamp,
	"notes" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"quantity_threshold" integer NOT NULL,
	"free_units" integer NOT NULL,
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_export_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"user_email" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text,
	"export_type" text NOT NULL,
	"period_from" timestamp,
	"period_to" timestamp,
	"entry_count" integer DEFAULT 0,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_booker_trips" (
	"id" text PRIMARY KEY NOT NULL,
	"order_booker_id" text NOT NULL,
	"trip_date" timestamp NOT NULL,
	"destination" text NOT NULL,
	"distance_km" numeric(8, 2) DEFAULT '0' NOT NULL,
	"vehicle_type" text DEFAULT 'own_vehicle' NOT NULL,
	"fuel_cost" numeric(12, 2) DEFAULT '0',
	"tada_amount" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"recorded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_bookers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"assigned_area" text,
	"commission_rate" numeric(5, 2) DEFAULT '0',
	"employee_id" text,
	"user_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"recipe_id" text,
	"unit_type" text DEFAULT 'full_carton' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_number" serial NOT NULL,
	"order_booker_id" text NOT NULL,
	"shopkeeper_name" text NOT NULL,
	"shopkeeper_mobile" text,
	"shopkeeper_address" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"trip_id" text,
	"fulfilled_by_salesman_id" text,
	"fulfilled_at" timestamp,
	"fulfilled_amount" numeric(12, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"reference" text,
	"expense_type" text,
	"recorded_by_id" text NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_change_log" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"customer_id" text,
	"old_price" numeric(12, 2) NOT NULL,
	"new_price" numeric(12, 2) NOT NULL,
	"changed_by_id" text NOT NULL,
	"source" text NOT NULL,
	"invoice_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"invoice_price_per_pack" numeric(12, 2) NOT NULL,
	"retail_price_per_pack" numeric(12, 2) NOT NULL,
	"updated_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_prices_recipe_id_unique" UNIQUE("recipe_id")
);
--> statement-breakpoint
CREATE TABLE "salesmen" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"employee_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slip_records" (
	"id" text PRIMARY KEY NOT NULL,
	"slip_number" text NOT NULL,
	"invoice_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"salesman_id" text,
	"amount_due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_recovered" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"recovery_status" text,
	"recovery_assigned_to_id" text,
	"next_follow_up_date" timestamp,
	"last_follow_up_date" timestamp,
	"escalation_level" integer DEFAULT 0,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"reconciled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slip_records_slip_number_unique" UNIQUE("slip_number")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"s_no" serial NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"cnic" text,
	"city" text,
	"state" text,
	"bank_account" text,
	"mobile_number" text,
	"total_sale" numeric(12, 2) DEFAULT '0',
	"payment" numeric(12, 2) DEFAULT '0',
	"credit" numeric(12, 2) DEFAULT '0',
	"weight_sale_kg" numeric(12, 3) DEFAULT '0',
	"expenses" numeric(12, 2) DEFAULT '0',
	"average_per_kg" numeric(12, 2) DEFAULT '0',
	"average_kg_with_expense" numeric(12, 2) DEFAULT '0',
	"expense_average" numeric(12, 2) DEFAULT '0',
	"customer_type" text DEFAULT 'retailer' NOT NULL,
	"salesman_id" text,
	"default_margin" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"pack" text NOT NULL,
	"recipe_id" text,
	"number_of_cartons" integer DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"packs_per_carton" integer DEFAULT 0 NOT NULL,
	"total_weight" numeric(12, 3) DEFAULT '0' NOT NULL,
	"per_carton_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_cartons" integer DEFAULT 0 NOT NULL,
	"hsn_code" text NOT NULL,
	"retail_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"margin" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tp_price" numeric(12, 2),
	"margin_percent" numeric(12, 2),
	"actual_pack_size" integer DEFAULT 0,
	"discount_rule_id" text,
	"free_cartons" integer DEFAULT 0,
	"is_price_override" boolean DEFAULT false,
	"cost_of_goods_sold" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost_of_goods_sold_per_unit" numeric(10, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"s_no" serial NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"customer_id" text NOT NULL,
	"account" text,
	"cash" numeric(12, 2) DEFAULT '0',
	"credit" numeric(12, 2) DEFAULT '0',
	"credit_return_date" timestamp,
	"expenses" numeric(12, 2) DEFAULT '0',
	"expenses_description" text,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"slip_number" text,
	"remarks" text,
	"warehouse_id" text NOT NULL,
	"performed_by_id" text NOT NULL,
	"status" text DEFAULT 'saved' NOT NULL,
	"salesman_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_records" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"material_type" text NOT NULL,
	"chemical_id" text,
	"packaging_material_id" text,
	"quantity" numeric(12, 3) NOT NULL,
	"cost" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"purchase_date" timestamp DEFAULT now() NOT NULL,
	"invoice_number" text,
	"payment_method" text,
	"bank_name" text,
	"transaction_id" text,
	"paid_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"reference" text,
	"method" text,
	"bank_name" text,
	"paid_by" text,
	"wallet_id" text,
	"notes" text,
	"purchase_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_field_options" ADD CONSTRAINT "category_field_options_field_id_category_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."category_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_fields" ADD CONSTRAINT "category_fields_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_field_values" ADD CONSTRAINT "expense_field_values_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_field_values" ADD CONSTRAINT "expense_field_values_field_id_category_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."category_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_field_values" ADD CONSTRAINT "expense_field_values_value_option_id_category_field_options_id_fk" FOREIGN KEY ("value_option_id") REFERENCES "public"."category_field_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_performed_by_id_user_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_performed_by_id_user_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advance_installments" ADD CONSTRAINT "advance_installments_advance_id_salary_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advance_installments" ADD CONSTRAINT "advance_installments_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bradford_audit_log" ADD CONSTRAINT "bradford_audit_log_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bradford_audit_log" ADD CONSTRAINT "bradford_audit_log_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bradford_audit_log" ADD CONSTRAINT "bradford_audit_log_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_shift_rates" ADD CONSTRAINT "night_shift_rates_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_deducted_in_payslip_id_payslips_id_fk" FOREIGN KEY ("deducted_in_payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tada_rates" ADD CONSTRAINT "tada_rates_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_logs" ADD CONSTRAINT "travel_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_logs" ADD CONSTRAINT "travel_logs_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_logs" ADD CONSTRAINT "travel_logs_paid_in_payslip_id_payslips_id_fk" FOREIGN KEY ("paid_in_payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chemical_lab_reports" ADD CONSTRAINT "chemical_lab_reports_chemical_id_chemicals_id_fk" FOREIGN KEY ("chemical_id") REFERENCES "public"."chemicals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chemical_lab_reports" ADD CONSTRAINT "chemical_lab_reports_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chemicals" ADD CONSTRAINT "chemicals_last_supplier_id_suppliers_id_fk" FOREIGN KEY ("last_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_performed_by_id_user_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock" ADD CONSTRAINT "material_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock" ADD CONSTRAINT "material_stock_chemical_id_chemicals_id_fk" FOREIGN KEY ("chemical_id") REFERENCES "public"."chemicals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_stock" ADD CONSTRAINT "material_stock_packaging_material_id_packaging_materials_id_fk" FOREIGN KEY ("packaging_material_id") REFERENCES "public"."packaging_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_materials" ADD CONSTRAINT "packaging_materials_associated_sticker_id_packaging_materials_id_fk" FOREIGN KEY ("associated_sticker_id") REFERENCES "public"."packaging_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_materials" ADD CONSTRAINT "packaging_materials_last_supplier_id_suppliers_id_fk" FOREIGN KEY ("last_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_materials_used" ADD CONSTRAINT "production_materials_used_production_run_id_production_runs_id_fk" FOREIGN KEY ("production_run_id") REFERENCES "public"."production_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_initiator_id_user_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_reopened_by_user_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_chemical_id_chemicals_id_fk" FOREIGN KEY ("chemical_id") REFERENCES "public"."chemicals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_packaging" ADD CONSTRAINT "recipe_packaging_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_packaging" ADD CONSTRAINT "recipe_packaging_packaging_material_id_packaging_materials_id_fk" FOREIGN KEY ("packaging_material_id") REFERENCES "public"."packaging_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_container_packaging_id_packaging_materials_id_fk" FOREIGN KEY ("container_packaging_id") REFERENCES "public"."packaging_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_carton_packaging_id_packaging_materials_id_fk" FOREIGN KEY ("carton_packaging_id") REFERENCES "public"."packaging_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_performed_by_id_user_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_log" ADD CONSTRAINT "adjustment_log_carton_id_cartons_id_fk" FOREIGN KEY ("carton_id") REFERENCES "public"."cartons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_log" ADD CONSTRAINT "adjustment_log_batch_id_production_runs_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_log" ADD CONSTRAINT "adjustment_log_related_carton_id_cartons_id_fk" FOREIGN KEY ("related_carton_id") REFERENCES "public"."cartons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_log" ADD CONSTRAINT "adjustment_log_dispatch_order_id_invoices_id_fk" FOREIGN KEY ("dispatch_order_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_log" ADD CONSTRAINT "adjustment_log_return_record_id_return_records_id_fk" FOREIGN KEY ("return_record_id") REFERENCES "public"."return_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_log" ADD CONSTRAINT "adjustment_log_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartons" ADD CONSTRAINT "cartons_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartons" ADD CONSTRAINT "cartons_production_run_id_production_runs_id_fk" FOREIGN KEY ("production_run_id") REFERENCES "public"."production_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartons" ADD CONSTRAINT "cartons_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartons" ADD CONSTRAINT "cartons_hold_started_by_user_id_fk" FOREIGN KEY ("hold_started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartons" ADD CONSTRAINT "cartons_retired_by_user_id_fk" FOREIGN KEY ("retired_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartons" ADD CONSTRAINT "cartons_dispatch_order_id_invoices_id_fk" FOREIGN KEY ("dispatch_order_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_alerts" ADD CONSTRAINT "integrity_alerts_batch_id_production_runs_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_alerts" ADD CONSTRAINT "integrity_alerts_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_return_record_id_return_records_id_fk" FOREIGN KEY ("return_record_id") REFERENCES "public"."return_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_carton_id_cartons_id_fk" FOREIGN KEY ("carton_id") REFERENCES "public"."cartons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_destination_carton_id_cartons_id_fk" FOREIGN KEY ("destination_carton_id") REFERENCES "public"."cartons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_records" ADD CONSTRAINT "return_records_dispatch_order_id_invoices_id_fk" FOREIGN KEY ("dispatch_order_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_records" ADD CONSTRAINT "return_records_returned_by_user_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_session_id_stock_count_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_count_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_carton_id_cartons_id_fk" FOREIGN KEY ("carton_id") REFERENCES "public"."cartons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_batch_id_production_runs_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_role_permissions" ADD CONSTRAINT "app_role_permissions_role_id_app_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."app_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_role_permissions" ADD CONSTRAINT "app_role_permissions_permission_id_app_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."app_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_app_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."app_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_order_booker_id_order_bookers_id_fk" FOREIGN KEY ("order_booker_id") REFERENCES "public"."order_bookers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_tiers" ADD CONSTRAINT "commission_tiers_order_booker_id_order_bookers_id_fk" FOREIGN KEY ("order_booker_id") REFERENCES "public"."order_bookers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_recovery_attempts" ADD CONSTRAINT "credit_recovery_attempts_slip_id_slip_records_id_fk" FOREIGN KEY ("slip_id") REFERENCES "public"."slip_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_recovery_attempts" ADD CONSTRAINT "credit_recovery_attempts_assigned_to_id_salesmen_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."salesmen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_booker_trips" ADD CONSTRAINT "order_booker_trips_order_booker_id_order_bookers_id_fk" FOREIGN KEY ("order_booker_id") REFERENCES "public"."order_bookers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_booker_trips" ADD CONSTRAINT "order_booker_trips_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_booker_id_order_bookers_id_fk" FOREIGN KEY ("order_booker_id") REFERENCES "public"."order_bookers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfilled_by_salesman_id_salesmen_id_fk" FOREIGN KEY ("fulfilled_by_salesman_id") REFERENCES "public"."salesmen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_log" ADD CONSTRAINT "price_change_log_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_prices" ADD CONSTRAINT "recipe_prices_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_prices" ADD CONSTRAINT "recipe_prices_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_records" ADD CONSTRAINT "slip_records_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_records" ADD CONSTRAINT "slip_records_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_records" ADD CONSTRAINT "slip_records_salesman_id_salesmen_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."salesmen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_records" ADD CONSTRAINT "slip_records_recovery_assigned_to_id_salesmen_id_fk" FOREIGN KEY ("recovery_assigned_to_id") REFERENCES "public"."salesmen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_salesman_id_salesmen_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."salesmen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_discount_rule_id_discount_rules_id_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "public"."discount_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_performed_by_id_user_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_salesman_id_salesmen_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."salesmen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_chemical_id_chemicals_id_fk" FOREIGN KEY ("chemical_id") REFERENCES "public"."chemicals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_packaging_material_id_packaging_materials_id_fk" FOREIGN KEY ("packaging_material_id") REFERENCES "public"."packaging_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_id_purchase_records_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "category_field_options_field_sort_idx" ON "category_field_options" USING btree ("field_id","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "category_field_options_field_value_unique" ON "category_field_options" USING btree ("field_id","value");--> statement-breakpoint
CREATE INDEX "category_fields_category_sort_idx" ON "category_fields" USING btree ("category_id","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "category_fields_category_key_unique" ON "category_fields" USING btree ("category_id","key");--> statement-breakpoint
CREATE INDEX "expense_categories_sort_idx" ON "expense_categories" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "expense_categories_active_idx" ON "expense_categories" USING btree ("is_active","is_archived");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_field_values_expense_field_unique" ON "expense_field_values" USING btree ("expense_id","field_id");--> statement-breakpoint
CREATE INDEX "expense_field_values_field_text_idx" ON "expense_field_values" USING btree ("field_id","value_text");--> statement-breakpoint
CREATE INDEX "expense_field_values_field_number_idx" ON "expense_field_values" USING btree ("field_id","value_number");--> statement-breakpoint
CREATE INDEX "expense_field_values_field_date_idx" ON "expense_field_values" USING btree ("field_id","value_date");--> statement-breakpoint
CREATE INDEX "expense_field_values_field_boolean_idx" ON "expense_field_values" USING btree ("field_id","value_boolean");--> statement-breakpoint
CREATE INDEX "expense_field_values_field_option_idx" ON "expense_field_values" USING btree ("field_id","value_option_id");--> statement-breakpoint
CREATE INDEX "expenses_category_date_idx" ON "expenses" USING btree ("category_id","expense_date","id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_wallet_date_idx" ON "expenses" USING btree ("wallet_id","expense_date");--> statement-breakpoint
CREATE INDEX "attendance_employee_date_idx" ON "attendance" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "lab_report_chemical_idx" ON "chemical_lab_reports" USING btree ("chemical_id");--> statement-breakpoint
CREATE INDEX "lab_report_date_idx" ON "chemical_lab_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "fg_warehouse_recipe_idx" ON "finished_goods_stock" USING btree ("warehouse_id","recipe_id");--> statement-breakpoint
CREATE INDEX "audit_warehouse_idx" ON "inventory_audit_log" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "audit_date_idx" ON "inventory_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_warehouse_idx" ON "material_stock" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "production_runs_updated_at_idx" ON "production_runs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "packaging_recipe_idx" ON "recipe_packaging" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "adj_log_carton_idx" ON "adjustment_log" USING btree ("carton_id");--> statement-breakpoint
CREATE INDEX "adj_log_batch_idx" ON "adjustment_log" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "adj_log_type_idx" ON "adjustment_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "adj_log_bulk_op_idx" ON "adjustment_log" USING btree ("bulk_operation_id");--> statement-breakpoint
CREATE INDEX "adj_log_performed_idx" ON "adjustment_log" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "cartons_recipe_idx" ON "cartons" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "cartons_production_run_idx" ON "cartons" USING btree ("production_run_id");--> statement-breakpoint
CREATE INDEX "cartons_warehouse_idx" ON "cartons" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "cartons_status_idx" ON "cartons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cartons_sku_idx" ON "cartons" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "integrity_alerts_status_idx" ON "integrity_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integrity_alerts_sku_idx" ON "integrity_alerts" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "integrity_alerts_batch_idx" ON "integrity_alerts" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "return_lines_record_idx" ON "return_lines" USING btree ("return_record_id");--> statement-breakpoint
CREATE INDEX "return_lines_carton_idx" ON "return_lines" USING btree ("carton_id");--> statement-breakpoint
CREATE INDEX "stock_count_session_idx" ON "stock_count_lines" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "stock_count_carton_idx" ON "stock_count_lines" USING btree ("carton_id");--> statement-breakpoint
CREATE INDEX "stock_count_session_status_idx" ON "stock_count_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "app_permissions_key_idx" ON "app_permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "app_permissions_module_idx" ON "app_permissions" USING btree ("module_key");--> statement-breakpoint
CREATE INDEX "app_role_permissions_role_idx" ON "app_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "app_role_permissions_permission_idx" ON "app_role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "app_roles_slug_idx" ON "app_roles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "app_roles_archived_idx" ON "app_roles" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "user_role_assignments_role_idx" ON "user_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_role_assignments_assigned_by_idx" ON "user_role_assignments" USING btree ("assigned_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_recovery_attempts_slip_id" ON "credit_recovery_attempts" USING btree ("slip_id");--> statement-breakpoint
CREATE INDEX "idx_discount_rules_customer_recipe" ON "discount_rules" USING btree ("customer_id","recipe_id");--> statement-breakpoint
CREATE INDEX "idx_discount_rules_dates" ON "discount_rules" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "idx_ledger_audit_entity" ON "ledger_export_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_audit_user" ON "ledger_export_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_audit_type" ON "ledger_export_audit_log" USING btree ("export_type");--> statement-breakpoint
CREATE INDEX "idx_ledger_audit_created" ON "ledger_export_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_slip_records_status" ON "slip_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_slip_records_recovery_status" ON "slip_records" USING btree ("recovery_status");--> statement-breakpoint
CREATE INDEX "idx_slip_records_recovery_assigned" ON "slip_records" USING btree ("recovery_assigned_to_id");--> statement-breakpoint
CREATE INDEX "idx_slip_records_next_follow_up" ON "slip_records" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "idx_invoice_items_discount_rule" ON "invoice_items" USING btree ("discount_rule_id");--> statement-breakpoint
CREATE INDEX "purchase_supplier_idx" ON "purchase_records" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_warehouse_idx" ON "purchase_records" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "purchase_date_idx" ON "purchase_records" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "payment_supplier_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "payment_purchase_idx" ON "supplier_payments" USING btree ("purchase_id");
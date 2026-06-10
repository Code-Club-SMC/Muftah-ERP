import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  type AllowanceConfig,
  STANDARD_ALLOWANCES,
} from "@/lib/types/hr-types";

import { user } from "./auth-schema";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// --- ENUMS ---
export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "on_leave",
  "terminated",
  "resigned",
  "pending_deletion",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "intern",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "leave",
  "holiday",
]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "sick",
  "annual",
  "special",
]);

// --- EMPLOYEES ---
export const employees = pgTable("employees", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").references(() => user.id),

  // Identity
  employeeCode: text("employee_code").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  cnic: text("cnic"),
  phone: text("phone"),
  address: text("address"),

  // Job Details
  designation: text("designation").notNull(),
  department: text("department"),
  status: employeeStatusEnum("status").default("active").notNull(),
  employmentType: employmentTypeEnum("employment_type")
    .default("full_time")
    .notNull(),
  joiningDate: date("joining_date").notNull(),

  // Payment Info
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),

  // Base Calculation Fields
  standardDutyHours: integer("standard_duty_hours").default(8).notNull(),
  basicSalary: decimal("basic_salary", {
    precision: 12,
    scale: 2,
  }).default("0"),

  /**
   * Weekly rest days — days of week this employee does NOT work.
   * Stored as an array of integers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
   *
   * Default [0]  → Sunday off only   (most factory/field staff)
   * Common [0,6] → Sat + Sun off     (office staff)
   * Empty  []    → No fixed rest day (rare: security / rotating shifts)
   *
   * Used by the payslip engine to:
   *   1. Exclude rest days from Total Job Days (fixing the 28-day bug).
   *   2. Prevent rest-day attendance entries from inflating/deflating any
   *      summary count (present, absent, unmarked, Bradford Factor).
   *   3. Drive the "Unmarked Days" alarm — rest days are never flagged as missing.
   */
  restDays: jsonb("rest_days")
    .$type<number[]>()
    .default([0])
    .notNull(),

  // JSON configured flexible allowances
  allowanceConfig: jsonb("allowance_config")
    .$type<AllowanceConfig[]>()
    .default(STANDARD_ALLOWANCES),

  // Leave & Attendance Tracking
  annualLeaveBalance: integer("annual_leave_balance").default(14),
  annualLeaveAllowance: integer("annual_leave_allowance").default(14), // total yearly entitlement cap
  leaveYearStart: date("leave_year_start"), // tracks which year current leave balance belongs to
  sickLeaveBalance: integer("sick_leave_balance").default(10),

  // Sales roles
  isOrderBooker: boolean("is_order_booker").default(false).notNull(),
  isSalesman: boolean("is_salesman").default(false).notNull(),

  ...timestamps,
});

// --- SALARY REVISIONS (Historical salary & allowance tracking) ---
export const salaryRevisions = pgTable("salary_revisions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  revisionDate: date("revision_date").notNull(),
  basicSalary: decimal("basic_salary", { precision: 12, scale: 2 }).notNull(),
  allowanceConfig: jsonb("allowance_config").$type<AllowanceConfig[]>().notNull(),
  reason: text("reason").notNull(),
  changedById: text("changed_by_id").references(() => user.id),
  ...timestamps,
}, (table) => ({
  employeeDateIdx: index("idx_salary_revisions_employee_date").on(table.employeeId, table.revisionDate),
}));

// --- ATTENDANCE ---
export const attendance = pgTable(
  "attendance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),

    date: date("date").notNull(),

    // Shift 1 (Standard)
    checkIn: time("check_in"),
    checkOut: time("check_out"),

    // Shift 2 (For Operators/Split Shifts)
    checkIn2: time("check_in_2"),
    checkOut2: time("check_out_2"),

    // Calculated/Manual Overrides
    dutyHours: decimal("duty_hours", { precision: 5, scale: 2 }).default("0"),
    overtimeHours: decimal("overtime_hours", {
      precision: 5,
      scale: 2,
    }).default("0"),

    // Status
    status: attendanceStatusEnum("status").notNull().default("present"),
    isLate: boolean("is_late").default(false),
    isNightShift: boolean("is_night_shift").default(false),

    // Overtime Approval
    overtimeStatus: text("overtime_status").default("pending"),
    overtimeRemarks: text("overtime_remarks"),

    // Early Departure
    earlyDepartureStatus: text("early_departure_status").default("none"),
    checkOutReason: text("check_out_reason"),

    // Leave
    isApprovedLeave: boolean("is_approved_leave").default(false),
    leaveApprovalStatus: text("leave_approval_status").default("none"),
    leaveType: leaveTypeEnum("leave_type"),

    // Data source
    entrySource: text("entry_source").default("manual"),

    notes: text("notes"),

    ...timestamps,
  },
  (table) => ({
    employeeDateIdx: index("attendance_employee_date_idx").on(
      table.employeeId,
      table.date,
    ),
  }),
);

// --- PAYROLLS ---
export const payrolls = pgTable("payrolls", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  month: date("month").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  status: text("status").default("draft"),

  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),

  processedBy: text("processed_by").references(() => user.id),

  walletId: text("wallet_id"),
  paidAt: timestamp("paid_at"),

  ...timestamps,
});

// --- PAYROLL ITEMS (Payslips) ---
export const payslips = pgTable("payslips", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  payrollId: text("payroll_id")
    .notNull()
    .references(() => payrolls.id),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  salaryRevisionId: text("salary_revision_id")
    .references(() => salaryRevisions.id),

  // Attendance Summary
  daysPresent: integer("days_present").default(0),
  daysAbsent: integer("days_absent").default(0),
  daysLeave: integer("days_leave").default(0),
  totalOvertimeHours: decimal("total_overtime_hours", {
    precision: 8,
    scale: 2,
  }).default("0"),
  nightShiftsCount: integer("night_shifts_count").default(0),

  // Earnings
  basicSalary: decimal("basic_salary", { precision: 12, scale: 2 }).notNull(),
  allowanceBreakdown: jsonb("allowance_breakdown")
    .$type<Record<string, number>>()
    .default({}),
  incentiveAmount: decimal("incentive_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  commissionAmount: decimal("commission_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  overtimeAmount: decimal("overtime_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  nightShiftAllowanceAmount: decimal("night_shift_allowance_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  bonusAmount: decimal("bonus_amount", { precision: 12, scale: 2 }).default("0"),

  // Deductions
  absentDeduction: decimal("absent_deduction", {
    precision: 12,
    scale: 2,
  }).default("0"),
  leaveDeduction: decimal("leave_deduction", {
    precision: 12,
    scale: 2,
  }).default("0"),
  advanceDeduction: decimal("advance_deduction", {
    precision: 12,
    scale: 2,
  }).default("0"),
  taxDeduction: decimal("tax_deduction", { precision: 12, scale: 2 }).default("0"),
  otherDeduction: decimal("other_deduction", {
    precision: 12,
    scale: 2,
  }).default("0"),

  // Bradford Factor
  bradfordFactorScore: decimal("bradford_factor_score", {
    precision: 8,
    scale: 2,
  }).default("0"),
  bradfordFactorOverride: decimal("bradford_factor_override", {
    precision: 8,
    scale: 2,
  }),
  bradfordFactorPeriod: text("bradford_factor_period"),
  yearlyBradfordScore: decimal("yearly_bradford_score", {
    precision: 8,
    scale: 2,
  }).default("0"), // cumulative Jan–Dec Bradford score

  // Totals
  grossSalary: decimal("gross_salary", { precision: 12, scale: 2 }).notNull(),
  totalDeductions: decimal("total_deductions", {
    precision: 12,
    scale: 2,
  }).notNull(),
  netSalary: decimal("net_salary", { precision: 12, scale: 2 }).notNull(),

  // Carry-Forward Deficit
  // When deductions exceed earnings, netSalary becomes negative.
  // This field stores the deficit amount that will be carried forward
  // as a priority deduction in the next pay cycle.
  carriedForwardDeficit: decimal("carried_forward_deficit", { precision: 12, scale: 2 }).default("0"),

  // Commission Breakdown Snapshot
  // Frozen at payroll generation time — per-order commission detail.
  // Structure: [{ orderId, orderRef, orderDate, orderValue, rate, amount }]
  commissionBreakdown: jsonb("commission_breakdown").$type<Array<{
    orderId: string;
    orderRef: string;
    orderDate: string;
    orderValue: number;
    rate: number;
    amount: number;
  }>>(),

  // Arrears Roll-Forward
  // When a missed prior-cycle salary is included in this slip, these fields
  // record the total arrears amount and which months they originate from.
  // e.g. arrearsFromMonths = ["2026-02", "2026-01"] means two missed months
  // were rolled into this payslip.
  arrearsAmount: decimal("arrears_amount", { precision: 12, scale: 2 }).default("0"),
  arrearsFromMonths: jsonb("arrears_from_months")
    .$type<string[]>()
    .default([]),

  paymentSource: text("payment_source"),
  remarks: text("remarks"),

  ...timestamps,
});

// --- SALARY ADVANCES ---
export const salaryAdvances = pgTable("salary_advances", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  reason: text("reason").notNull(),

  status: text("status").default("pending").notNull(),
  approvedBy: text("approved_by").references(() => user.id),

  walletId: text("wallet_id"),
  paidAt: timestamp("paid_at"),

  // Legacy single-shot deduction (kept for backward compat)
  deductedInPayslipId: text("deducted_in_payslip_id").references(
    () => payslips.id,
  ),

  // Installment plan
  installmentMonths: integer("installment_months").default(1).notNull(), // 1, 3, 6, or 12
  installmentAmount: decimal("installment_amount", { precision: 12, scale: 2 }), // amount / installmentMonths
  installmentsPaid: integer("installments_paid").default(0).notNull(), // how many deducted so far

  ...timestamps,
});

// --- NIGHT SHIFT RATES ---
export const nightShiftRates = pgTable("night_shift_rates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  year: integer("year").notNull().unique(),
  ratePerNight: decimal("rate_per_night", { precision: 10, scale: 2 }).notNull(),

  remarks: text("remarks"),
  setBy: text("set_by").references(() => user.id),

  ...timestamps,
});

// --- TA/DA RATES ---
export const tadaRates = pgTable("tada_rates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  ratePerKm: decimal("rate_per_km", { precision: 8, scale: 2 }).notNull(),

  effectiveFrom: date("effective_from").notNull(),
  remarks: text("remarks"),
  isActive: boolean("is_active").default(true).notNull(),
  setBy: text("set_by").references(() => user.id),

  ...timestamps,
});

// --- TRAVEL LOGS ---
export const travelLogs = pgTable("travel_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),

  date: date("date").notNull(),
  destination: text("destination").notNull(),
  roundTripKm: decimal("round_trip_km", { precision: 8, scale: 2 }).notNull(),

  rateApplied: decimal("rate_applied", { precision: 8, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),

  purpose: text("purpose"),
  status: text("status").default("pending").notNull(), // "pending" | "approved" | "rejected" | "reimbursed"
  approvedBy: text("approved_by").references(() => user.id),

  // Standalone reimbursement tracking (outside payroll)
  reimbursedAt: timestamp("reimbursed_at"),
  reimbursedBy: text("reimbursed_by").references(() => user.id),
  reimbursedVia: text("reimbursed_via"), // "payroll" | "cash" | "bank_transfer" | "wallet"
  reimbursedAmount: decimal("reimbursed_amount", { precision: 10, scale: 2 }),

  // Payroll linkage (legacy / when reimbursed_via = "payroll")
  paidInPayslipId: text("paid_in_payslip_id").references(() => payslips.id),

  ...timestamps,
});

// --- ADVANCE INSTALLMENTS ---
export const advanceInstallments = pgTable("advance_installments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  advanceId: text("advance_id")
    .notNull()
    .references(() => salaryAdvances.id),

  payslipId: text("payslip_id")
    .notNull()
    .references(() => payslips.id),

  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  installmentNo: integer("installment_no").notNull(), // 1, 2, 3...

  ...timestamps,
});

// --- BRADFORD FACTOR AUDIT LOG ---
export const bradfordAuditLog = pgTable("bradford_audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  payslipId: text("payslip_id")
    .notNull()
    .references(() => payslips.id),

  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),

  computedScore: decimal("computed_score", { precision: 8, scale: 2 }).notNull(),
  overrideScore: decimal("override_score", { precision: 8, scale: 2 }).notNull(),

  reason: text("reason").notNull(),
  performedBy: text("performed_by")
    .notNull()
    .references(() => user.id),

  performedAt: timestamp("performed_at").defaultNow().notNull(),
});

// --- BRADFORD FACTOR SNAPSHOTS (Monthly frozen attendance summary) ---
export const bradfordSnapshots = pgTable("bradford_snapshots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  payrollId: text("payroll_id")
    .notNull()
    .references(() => payrolls.id, { onDelete: "cascade" }),
  payslipId: text("payslip_id")
    .references(() => payslips.id, { onDelete: "set null" }),

  snapshotYearMonth: text("snapshot_year_month").notNull(), // "YYYY-MM"

  // Raw attendance counts (frozen at close)
  totalAbsences: integer("total_absences").notNull(),
  totalSickLeaves: integer("total_sick_leaves").notNull(),
  totalAnnualLeaves: integer("total_annual_leaves").notNull(),
  totalLateArrivals: integer("total_late_arrivals").notNull(),
  totalEarlyDepartures: integer("total_early_departures").notNull(),
  nightShiftsCount: integer("night_shifts_count").default(0).notNull(),

  // Computed Bradford factor at close
  bradfordFactor: decimal("bradford_factor", { precision: 8, scale: 2 }).notNull(),

  // Attendance detail JSON (array of daily records for audit)
  dailyAttendanceJson: jsonb("daily_attendance_json").$type<{
    date: string;
    status: string;
    isLate: boolean;
    earlyDepartureStatus: string;
    leaveType: string | null;
  }[]>().notNull(),

  // Roll-forward info
  unmarkedDaysAtClose: integer("unmarked_days_at_close").default(0).notNull(),
  remarks: text("remarks"),

  ...timestamps,
}, (table) => ({
  employeeMonthIdx: index("idx_bradford_snapshots_employee_month").on(table.employeeId, table.snapshotYearMonth),
  payrollIdx: index("idx_bradford_snapshots_payroll").on(table.payrollId),
}));

// --- RELATIONS ---
export const employeeRelations = relations(employees, ({ one, many }) => ({
  user: one(user, {
    fields: [employees.userId],
    references: [user.id],
  }),
  attendance: many(attendance),
  payslips: many(payslips),
  salaryRevisions: many(salaryRevisions),
}));

export const salaryRevisionRelations = relations(salaryRevisions, ({ one }) => ({
  employee: one(employees, {
    fields: [salaryRevisions.employeeId],
    references: [employees.id],
  }),
  changedBy: one(user, {
    fields: [salaryRevisions.changedById],
    references: [user.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(employees, {
    fields: [attendance.employeeId],
    references: [employees.id],
  }),
}));

export const payrollRelations = relations(payrolls, ({ many, one }) => ({
  payslips: many(payslips),
  processor: one(user, {
    fields: [payrolls.processedBy],
    references: [user.id],
  }),
}));

export const payslipRelations = relations(payslips, ({ one }) => ({
  payroll: one(payrolls, {
    fields: [payslips.payrollId],
    references: [payrolls.id],
  }),
  employee: one(employees, {
    fields: [payslips.employeeId],
    references: [employees.id],
  }),
  salaryRevision: one(salaryRevisions, {
    fields: [payslips.salaryRevisionId],
    references: [salaryRevisions.id],
  }),
}));

export const salaryAdvanceRelations = relations(salaryAdvances, ({ one, many }) => ({
  employee: one(employees, {
    fields: [salaryAdvances.employeeId],
    references: [employees.id],
  }),
  payslip: one(payslips, {
    fields: [salaryAdvances.deductedInPayslipId],
    references: [payslips.id],
  }),
  approver: one(user, {
    fields: [salaryAdvances.approvedBy],
    references: [user.id],
  }),
  installments: many(advanceInstallments),
}));

export const advanceInstallmentRelations = relations(advanceInstallments, ({ one }) => ({
  advance: one(salaryAdvances, {
    fields: [advanceInstallments.advanceId],
    references: [salaryAdvances.id],
  }),
  payslip: one(payslips, {
    fields: [advanceInstallments.payslipId],
    references: [payslips.id],
  }),
}));

export const bradfordSnapshotRelations = relations(bradfordSnapshots, ({ one }) => ({
  employee: one(employees, {
    fields: [bradfordSnapshots.employeeId],
    references: [employees.id],
  }),
  payroll: one(payrolls, {
    fields: [bradfordSnapshots.payrollId],
    references: [payrolls.id],
  }),
  payslip: one(payslips, {
    fields: [bradfordSnapshots.payslipId],
    references: [payslips.id],
  }),
}));

export const nightShiftRateRelations = relations(nightShiftRates, ({ one }) => ({
  setter: one(user, {
    fields: [nightShiftRates.setBy],
    references: [user.id],
  }),
}));

export const tadaRateRelations = relations(tadaRates, ({ one }) => ({
  setter: one(user, {
    fields: [tadaRates.setBy],
    references: [user.id],
  }),
}));

export const travelLogRelations = relations(travelLogs, ({ one }) => ({
  employee: one(employees, {
    fields: [travelLogs.employeeId],
    references: [employees.id],
  }),
  approver: one(user, {
    fields: [travelLogs.approvedBy],
    references: [user.id],
  }),
  payslip: one(payslips, {
    fields: [travelLogs.paidInPayslipId],
    references: [payslips.id],
  }),
}));

export const bradfordAuditLogRelations = relations(bradfordAuditLog, ({ one }) => ({
  payslip: one(payslips, {
    fields: [bradfordAuditLog.payslipId],
    references: [payslips.id],
  }),
  employee: one(employees, {
    fields: [bradfordAuditLog.employeeId],
    references: [employees.id],
  }),
  performer: one(user, {
    fields: [bradfordAuditLog.performedBy],
    references: [user.id],
  }),
}));
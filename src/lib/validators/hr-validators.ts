import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const deductionsSchema = z.object({
  absent: z.boolean(),
  annualLeave: z.boolean(),
  sickLeave: z.boolean(),
  specialLeave: z.boolean(),
  lateArrival: z.boolean(),
  earlyLeaving: z.boolean(),
});

const allowanceConfigSchema = z.object({
  id: z.string().min(1, "Allowance ID is required"),
  name: z.string().min(1, "Allowance name cannot be empty"),
  amount: z.number().nonnegative("Amount must be 0 or greater"),
  deductions: deductionsSchema,
  lateEarlyBasis: z.enum(["hourly", "perDay"]).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  employeeCode: z.string().min(1, "Employee Code is required"),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().min(1, "Department is required"),
  joiningDate: z.string().min(1, "Joining Date is required"),

  status: z.enum(["active", "on_leave", "terminated", "resigned"]),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]),

  phone: z.string(),
  cnic: z.string(),
  address: z.string(),
  bankName: z.string(),
  bankAccountNumber: z.string(),

  standardDutyHours: z
    .number()
    .int("Duty hours must be a whole number")
    .min(1, "Must be at least 1 hour")
    .max(24, "Cannot exceed 24 hours"),

  basicSalary: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Must be a valid positive number",
    }),

  isOrderBooker: z.boolean(),
  isSalesman: z.boolean(),

  /**
   * Days of week this employee does NOT work.
   * 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
   */
  restDays: z.array(z.number().int().min(0).max(6)),
  allowanceConfig: z.array(allowanceConfigSchema),
});

export const updateEmployeeSchema = createEmployeeSchema.extend({
  id: z.string().min(1, "Employee ID is required"),
});

export const deleteEmployeeSchema = z.object({
  id: z.string().min(1, "Employee ID is required"),
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const upsertAttendanceSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    date: z.string().min(1, "Date is required"),
    status: z.enum(["present", "absent", "leave", "holiday"]),

    // casual and unpaid removed — use annual or special instead
    leaveType: z
      .enum(["sick", "annual", "special"])
      .nullable()
      .optional(),

    checkIn: z.string().nullable(),
    checkOut: z.string().nullable(),
    checkIn2: z.string().nullable(),
    checkOut2: z.string().nullable(),
    dutyHours: z.string().nullable(),
    overtimeHours: z.string().nullable(),
    isLate: z.boolean().nullable(),
    isNightShift: z.boolean().nullable(),

    isApprovedLeave: z.boolean().nullable(),

    leaveApprovalStatus: z
      .enum(["none", "pending", "approved", "rejected"])
      .nullable()
      .optional()
      .default("none"),

    overtimeRemarks: z.string().nullable(),
    overtimeStatus: z.enum(["pending", "approved", "rejected"]).nullable(),

    earlyDepartureStatus: z
      .enum(["none", "pending", "approved", "rejected"])
      .nullable()
      .optional(),

    entrySource: z.enum(["biometric", "manual"]).default("manual"),
    notes: z.string().nullable(),
  })
  .refine(
    (data) => {
      const ot = parseFloat(data.overtimeHours || "0");
      if (ot > 0 && !data.overtimeRemarks?.trim()) return false;
      return true;
    },
    {
      message:
        "Overtime reason is required when overtime hours are greater than 0",
      path: ["overtimeRemarks"],
    },
  );

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpsertAttendanceInput = z.infer<typeof upsertAttendanceSchema>;
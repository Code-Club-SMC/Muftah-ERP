import { parseISO, eachDayOfInterval, format } from "date-fns";
import { type AllowanceConfig } from "@/lib/types/hr-types";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AttendanceRecord = {
  date: string;
  status: "present" | "absent" | "leave" | "holiday" | "not_employed";
  dutyHours: string | null;
  overtimeHours: string | null;
  isNightShift: boolean;
  /**
   * true  → approved paid leave (no deduction)
   * false → unpaid / unapproved leave (conveyance deducted per existing rule)
   */
  isApprovedLeave?: boolean;
  /**
   * Type of leave — used for Bradford Factor and leave balance deduction.
   * sick | annual | special  (casual removed from UI; kept in type for backward compat)
   */
  leaveType?: string | null;
  /**
   * Only count overtime when the admin has explicitly approved it.
   * pending | approved | rejected
   */
  overtimeStatus?: string;
  isLate?: boolean;
  earlyDepartureStatus?: string; // none, pending, approved, rejected
};

export type EmployeeData = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  cnic: string | null;
  designation: string;
  joiningDate?: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  basicSalary: string;
  allowanceConfig: AllowanceConfig[];
  standardDutyHours?: number; // fallback to 8 if absent
  /**
   * Days of the week treated as non-working rest days.
   * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
   * Default: [0] (Sunday only)
   */
  restDays?: number[];
};

export type DeductionConfig = {
  manualDeductions: Array<{
    description: string;
    amount: number;
  }>;
  deductConveyanceOnLeave: boolean; // kept for backward compat, now only applies to unapproved leave
};

export type PayslipCalculation = {
  // Employee Info
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  cnic: string;
  bankName: string;
  bankAccountNumber: string;

  // Period
  payrollMonth: string;
  startDate: string;
  endDate: string;

  // Attendance Summary
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number; // approved paid leaves
  daysUnapprovedLeave: number; // unpaid / unapproved (kept for internal calcs; hidden from UI)
  daysSickLeave: number;
  daysCasualLeave: number; // kept for backward compat; hidden from UI
  daysAnnualLeave: number;
  daysSpecialLeave: number;
  daysNotEmployed: number; // Days outside of joining/cutoff
  unmarkedDays: number; // dynamically computed missing days on working days only
  totalOvertimeHours: number;
  totalUndertimeHours: number;
  nightShiftsCount: number;
  bradfordFactorScore: number;
  bradfordFactorPeriod: string;

  // Earnings
  basicSalary: number;
  allowanceBreakdown: Record<string, number>;

  overtimeAmount: number;
  nightShiftAllowanceAmount: number;
  incentiveAmount: number;
  commissionAmount: number;
  bonusAmount: number;

  // Deductions
  notEmployedDeduction: number; // Money deducted for pre-joining or post-cutoff
  absentDeduction: number;
  leaveDeduction: number;
  advanceDeduction: number;
  taxDeduction: number;
  manualDeductions: Array<{ description: string; amount: number }>;
  otherDeduction: number;

  // Original Standard Snapshot
  standardBreakdown: Record<string, number>;

  calculationMeta: {
    calendarDaysInMonth: number;
    perDayBasic: number;
    perHourBasic: number;
    overtimeMultiplier: number;
    overtimeRatePerHour: number;
    standardDutyHours: number;
    restDays: number[]; // surfaced for transparency / debugging
  };

  // Totals
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  paymentSource: string | null;

  // Meta
  remarks: string;

  // Arrears helpers (populated by server fn)
  missedLastMonth?: boolean;
  lastMonthStandardSalary?: string;

  // Yearly Bradford (calendar year Jan–Dec, populated by server fn)
  yearlyBradfordScore?: number;

  // Annual leave (populated by server fn)
  annualLeaveRemaining?: number;
  annualLeaveAllowance?: number;
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns the day-of-week numbers (0=Sun … 6=Sat) for every day in
 * the given interval that is NOT a configured rest day and NOT an
 * admin-marked holiday.
 *
 * This is the single source of truth for "how many days does this
 * employee actually owe work in this pay cycle?"
 */
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  records: AttendanceRecord[],
  restDays: number[] = [0], // 0 = Sunday by default
): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const allDaysInCycle = eachDayOfInterval({ start, end });

  // 1. Strip out configured rest days (Sunday, Saturday, etc.)
  const nonRestDays = allDaysInCycle.filter(
    (d) => !restDays.includes(d.getDay()),
  );

  // 2. Strip any days explicitly marked as 'holiday' by admin / system
  const holidayDates = new Set(
    records
      .filter((r) => r.status === "holiday")
      .map((r) => r.date),
  );
  const trueWorkingDays = nonRestDays.filter(
    (d) => !holidayDates.has(format(d, "yyyy-MM-dd")),
  );

  return Math.max(1, trueWorkingDays.length); // Guard against division-by-zero
}

/**
 * Builds a Set of ISO date strings that are rest days within the given range.
 * Used to filter attendance records so rest-day entries never distort
 * the summary counts or the unmarked-days alarm.
 */
export function buildRestDayDateSet(
  startDate: string,
  endDate: string,
  restDays: number[],
): Set<string> {
  if (restDays.length === 0) return new Set();
  const allDays = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
  return new Set(
    allDays
      .filter((d) => restDays.includes(d.getDay()))
      .map((d) => format(d, "yyyy-MM-dd")),
  );
}

export function getCalendarDaysInPayPeriodMonth(
  totalWorkingDays: number,
): number {
  return totalWorkingDays;
}

function getAllowanceAmount(config: AllowanceConfig[], id: string): number {
  return config.find((a) => a.id === id)?.amount || 0;
}

// ============================================================================
// DEDUCTION CALCULATION
// ============================================================================

/**
 * Deduction rules:
 *
 * 1. ABSENT (no notice): full-day deduction — Basic + all allowances except Fuel & Special.
 * 2. APPROVED LEAVE: NO deduction at all.
 * 3. UNAPPROVED / UNPAID LEAVE: Deduct Conveyance only.
 * 4. UNDERTIME (present but short hours): hour-based deduction from Basic only.
 *
 * NOTE: records passed here must already be filtered to working days only
 * (no rest-day entries, no holiday entries) by the caller.
 */
export function calculateAbsentDeductions(
  employee: EmployeeData,
  attendanceRecords: AttendanceRecord[],
  calendarDaysInMonth: number,
): {
  absentDeduction: number;
  leaveDeduction: number;
  notEmployedDeduction: number;
  totalUndertimeHours: number;
  adjustedAllowances: Record<string, number>;
} {
  const standardDutyHours = employee.standardDutyHours || 8;
  const config = employee.allowanceConfig || [];

  const basicSalary = parseFloat(employee.basicSalary || "0");
  const perDayBasic = basicSalary / calendarDaysInMonth;
  const perHourBasic = perDayBasic / standardDutyHours;

  let totalAbsentDeduction = 0;
  let totalLeaveDeduction = 0;
  let totalNotEmployedDeduction = 0;
  let totalUndertimeHours = 0;

  const adjustments: Record<string, number> = {};
  adjustments["basicSalary"] = 0;
  for (const a of config) adjustments[a.id] = 0;

  const applyOccasionDeduction = (
    fraction: number,
    occasion:
      | "absent"
      | "not_employed"
      | "annualLeave"
      | "sickLeave"
      | "specialLeave"
      | "lateArrival"
      | "earlyLeaving",
    deductionTarget: "absent" | "leave" | "not_employed" = "absent",
  ) => {
    let subTotal = 0;

    if (occasion !== "lateArrival" && occasion !== "earlyLeaving") {
      const basicDeduction = perDayBasic * fraction;
      adjustments["basicSalary"] += basicDeduction;
      subTotal += basicDeduction;
    }

    for (const allowance of config) {
      const shouldDeduct = occasion === "not_employed" 
        ? true // Always prorate all allowances if the employee is not employed (pre-joining or post-cutoff)
        : (allowance.deductions?.[occasion] ?? false);
      if (shouldDeduct) {
        let amt = 0;
        if (occasion === "lateArrival" || occasion === "earlyLeaving") {
          const perHourRate =
            allowance.amount / (calendarDaysInMonth * standardDutyHours);
          amt = perHourRate * fraction;
        } else {
          amt = (allowance.amount / calendarDaysInMonth) * fraction;
        }
        adjustments[allowance.id] = (adjustments[allowance.id] || 0) + amt;
        subTotal += amt;
      }
    }

    if (deductionTarget === "leave") {
      totalLeaveDeduction += subTotal;
    } else if (deductionTarget === "not_employed") {
      totalNotEmployedDeduction += subTotal;
    } else {
      totalAbsentDeduction += subTotal;
    }
  };

  for (const record of attendanceRecords) {
    const recordDate = parseISO(record.date);
    const dayOfWeek = recordDate.getDay();
    const isRestDay = (employee.restDays ?? [0]).includes(dayOfWeek);

    // Completely skip deductions for rest days to ensure no false penalisation
    if (isRestDay) continue;

    const dutyHours = parseFloat(record.dutyHours || "0");

    if (record.status === "absent") {
      applyOccasionDeduction(1, "absent", "absent");
    } else if (record.status === "not_employed") {
      // For not_employed, we deduct exactly identical to "absent" (all standard wages)
      applyOccasionDeduction(1, "not_employed", "not_employed");
    } else if (record.status === "leave") {
      if (record.leaveType === "special") {
        applyOccasionDeduction(1, "specialLeave", "leave");
      } else if (record.leaveType === "sick") {
        applyOccasionDeduction(1, "sickLeave", "leave");
      } else if (record.leaveType === "annual") {
        if (!record.isApprovedLeave) {
          applyOccasionDeduction(1, "annualLeave", "leave");
        }
      } else if (!record.isApprovedLeave) {
        applyOccasionDeduction(1, "annualLeave", "leave");
      }
    } else if (
      record.status === "present" &&
      dutyHours < standardDutyHours
    ) {
      const shortHours = standardDutyHours - dutyHours;
      totalUndertimeHours += shortHours;

      const basicDeduction = perHourBasic * shortHours;
      adjustments["basicSalary"] =
        (adjustments["basicSalary"] || 0) + basicDeduction;
      totalAbsentDeduction += basicDeduction;

      if (record.isLate) {
        applyOccasionDeduction(shortHours, "lateArrival");
      } else if (
        record.earlyDepartureStatus &&
        record.earlyDepartureStatus !== "none"
      ) {
        applyOccasionDeduction(shortHours, "earlyLeaving");
      }
    }
  }

  const adjustedAllowances: Record<string, number> = {};
  adjustedAllowances["basicSalary"] = Math.max(
    0,
    Math.round(basicSalary - adjustments["basicSalary"]),
  );
  for (const allowance of config) {
    adjustedAllowances[allowance.id] = Math.max(
      0,
      Math.round(allowance.amount - (adjustments[allowance.id] || 0)),
    );
  }

  return {
    absentDeduction: Math.round(totalAbsentDeduction),
    leaveDeduction: Math.round(totalLeaveDeduction),
    notEmployedDeduction: Math.round(totalNotEmployedDeduction),
    totalUndertimeHours: +totalUndertimeHours.toFixed(2),
    adjustedAllowances,
  };
}

// ============================================================================
// OVERTIME
// ============================================================================

/**
 * Only count overtime hours where overtimeStatus === "approved".
 */
export function sumApprovedOvertimeHours(records: AttendanceRecord[]): number {
  return records.reduce((sum, r) => {
    if (r.overtimeStatus !== "approved") return sum;
    return sum + parseFloat(r.overtimeHours || "0");
  }, 0);
}

export function calculateOvertimePay(
  basicSalary: number,
  standardDutyHours: number,
  calendarDaysInMonth: number,
  overtimeHours: number,
  multiplier: number = 1.0,
): number {
  const perDayBasic = basicSalary / calendarDaysInMonth;
  const perHourBasic = perDayBasic / standardDutyHours;
  return Math.round(perHourBasic * multiplier * overtimeHours);
}

// ============================================================================
// BRADFORD FACTOR
// ============================================================================

/**
 * Bradford Factor: B = S² × D
 *
 * S = number of separate absence SPELLS (consecutive absents = 1 spell)
 * D = total absent-equivalent days
 *
 * What counts:
 *   - absent                   → full day, full spell counting
 *   - sick leave               → counts toward D
 *   - unpaid / special leave   → counts toward D
 *   - approved paid leaves     → excluded
 *
 * Rest days are excluded from Bradford (they are passed in pre-filtered).
 */
export function calculateBradfordFactor(
  attendanceRecords: AttendanceRecord[],
): number {
  let spells = 0;
  let totalAbsentDays = 0;
  let inSpell = false;

  const sorted = [...attendanceRecords].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  for (const record of sorted) {
    const isBradfordEvent =
      record.status === "absent" ||
      (record.status === "leave" &&
        (record.leaveType === "sick" ||
          record.leaveType === "special" ||
          record.leaveType === "unpaid" ||
          !record.isApprovedLeave));

    if (isBradfordEvent) {
      totalAbsentDays += 1;
      if (!inSpell) {
        spells++;
        inSpell = true;
      }
    } else {
      inSpell = false;
    }
  }

  return Math.round(Math.pow(spells, 2) * totalAbsentDays);
}

/**
 * Yearly Bradford Factor: same S² × D formula but evaluated across
 * ALL attendance records from Jan 1 to Dec 31 of a given calendar year.
 *
 * Pass the full year's attendance to get the cumulative score.
 * Auto-resets on Jan 1 each year because the previous year's records
 * are no longer included in the query window.
 */
export function calculateYearlyBradfordFactor(
  allYearRecords: AttendanceRecord[],
): number {
  return calculateBradfordFactor(allYearRecords);
}

// ============================================================================
// MAIN PAYSLIP CALCULATOR
// ============================================================================

export function calculatePayslip(
  employee: EmployeeData,
  attendanceRecords: AttendanceRecord[],
  payrollPeriod: { month: string; startDate: string; endDate: string },
  deductionConfig: DeductionConfig = {
    manualDeductions: [],
    deductConveyanceOnLeave: true,
  },
  additionalAmounts: {
    overtimeAmount?: number;
    nightShiftAllowance?: number;
    incentiveAmount?: number;
    commissionAmount?: number;
    bonusAmount?: number;
    advanceDeduction?: number;
    taxDeduction?: number;
    overtimeMultiplier?: number;
  } = {},
  earlyCutoffDate?: string,
): PayslipCalculation {
  const stdDutyHours = employee.standardDutyHours || 8;
  const config = employee.allowanceConfig || [];
  const basicSalaryStd = parseFloat(employee.basicSalary || "0");
  const restDays = employee.restDays ?? [0];

  let joinedAtDate: string | null = null;
  if (employee.joiningDate) {
    const d = parseISO(employee.joiningDate);
    if (!isNaN(d.getTime())) {
      joinedAtDate = format(d, "yyyy-MM-dd");
    }
  }

  // 1. Build a set of rest-day dates in this cycle
  const restDayDateSet = buildRestDayDateSet(
    payrollPeriod.startDate,
    payrollPeriod.endDate,
    restDays,
  );

  // 2. Evaluation window
  const evaluationStartDate = joinedAtDate && joinedAtDate > payrollPeriod.startDate 
    ? joinedAtDate 
    : payrollPeriod.startDate;
  const evaluationEndDate = earlyCutoffDate ? earlyCutoffDate : payrollPeriod.endDate;

  // 3. Full Cycle Denominator
  const fullCycleWorkingDays = calculateWorkingDays(
    payrollPeriod.startDate,
    payrollPeriod.endDate,
    attendanceRecords,
    restDays,
  );
  const calendarDaysInMonth = getCalendarDaysInPayPeriodMonth(fullCycleWorkingDays);

  // 5. Build WorkingDayRecords (including virtual not_employed for future & past)
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const workingDayRecords = attendanceRecords.filter(
    (r) => !restDayDateSet.has(r.date) && r.status !== "holiday",
  ).map(r => {
    // If a record exists but is dated after the cutoff (or after today in full-cycle mode), treat as not_employed
    const effectiveCutoff = earlyCutoffDate ?? todayStr;
    if (r.date > effectiveCutoff) {
      return { ...r, status: "not_employed" as const };
    }
    if (joinedAtDate && r.date < joinedAtDate) {
      return { ...r, status: "not_employed" as const };
    }
    return r;
  });

  // Inject virtual records for entirely missing future or pre-joining days
  const start = parseISO(payrollPeriod.startDate);
  const end = parseISO(payrollPeriod.endDate);
  const cycleRange = eachDayOfInterval({ start, end });
  const existingDates = new Set(attendanceRecords.map(r => r.date));
  for (const day of cycleRange) {
    const dateStr = format(day, "yyyy-MM-dd");
    if (!restDayDateSet.has(dateStr) && !existingDates.has(dateStr)) {
      // Future = after earlyCutoffDate (if set), OR after today (if no cutoff set)
      const isFuture = earlyCutoffDate 
        ? dateStr > earlyCutoffDate 
        : dateStr > todayStr;
      const isPreJoining = joinedAtDate && dateStr < joinedAtDate;
      if (isFuture || isPreJoining) {
        workingDayRecords.push({
          date: dateStr,
          status: "not_employed",
          dutyHours: null,
          overtimeHours: null,
          isNightShift: false
        });
      }
    }
  }

  // 6. Attendance Summary
  // Unmarked only counts gaps in the window (<= cutoff && >= joined)
  // evaluationWindowWorkingDays is the number of working days the employee was *expected* to work.
  const evaluationWindowWorkingDays = calculateWorkingDays(
    evaluationStartDate,
    evaluationEndDate,
    attendanceRecords,
    restDays,
  );
  const pastRecords = workingDayRecords.filter(r => r.date <= evaluationEndDate && r.date >= evaluationStartDate);
  const accountedPastDays = pastRecords.filter(r => ["present", "absent", "leave", "not_employed"].includes(r.status)).length;
  const unmarkedDays = Math.max(0, evaluationWindowWorkingDays - accountedPastDays);

  const daysPresent = workingDayRecords.filter(r => r.status === "present").length;
  const daysAbsent = workingDayRecords.filter(r => r.status === "absent").length;
  const daysLeave = workingDayRecords.filter(r => r.status === "leave" && r.isApprovedLeave).length;
  const daysUnapprovedLeave = workingDayRecords.filter(r => r.status === "leave" && !r.isApprovedLeave).length;
  const daysSickLeave = workingDayRecords.filter(r => r.status === "leave" && r.leaveType === "sick").length;
  const daysCasualLeave = workingDayRecords.filter(r => r.status === "leave" && r.leaveType === "casual").length;
  const daysAnnualLeave = workingDayRecords.filter(r => r.status === "leave" && r.leaveType === "annual").length;
  const daysSpecialLeave = workingDayRecords.filter(r => r.status === "leave" && r.leaveType === "special").length;
  const daysNotEmployed = workingDayRecords.filter(r => r.status === "not_employed").length;

  const validEvaluationRecords = workingDayRecords.filter(r => r.date >= evaluationStartDate && r.date <= evaluationEndDate);
  const totalOvertimeHours = sumApprovedOvertimeHours(validEvaluationRecords);
  const nightShiftsCount = validEvaluationRecords.filter(r => r.isNightShift).length;
  const bradfordFactorScore = calculateBradfordFactor(validEvaluationRecords);

  // 7. Deductions
  const {
    absentDeduction,
    leaveDeduction,
    notEmployedDeduction,
    totalUndertimeHours,
    adjustedAllowances,
  } = calculateAbsentDeductions(employee, workingDayRecords, calendarDaysInMonth);

  // ── 5. Overtime ───────────────────────────────────────────────────────────
  const overtimeMultiplier = additionalAmounts.overtimeMultiplier || 1.0;
  const overtimeAmount =
    additionalAmounts.overtimeAmount ??
    calculateOvertimePay(
      basicSalaryStd,
      stdDutyHours,
      calendarDaysInMonth,
      totalOvertimeHours,
      overtimeMultiplier,
    );

  // ── 6. Night shift ────────────────────────────────────────────────────────
  let nightShiftAllowanceAmount = additionalAmounts.nightShiftAllowance || 0;
  if (nightShiftAllowanceAmount === 0 && nightShiftsCount > 0) {
    const nightShiftRate = getAllowanceAmount(config, "nightShift");
    nightShiftAllowanceAmount = nightShiftRate * nightShiftsCount;
  }

  const incentiveAmount = additionalAmounts.incentiveAmount || 0;
  const commissionAmount = additionalAmounts.commissionAmount || 0;
  const bonusAmount = additionalAmounts.bonusAmount || 0;

  // ── 7. Gross ──────────────────────────────────────────────────────────────
  let sumOfAllowances = 0;
  for (const key of Object.keys(adjustedAllowances)) {
    if (key !== "nightShift") sumOfAllowances += adjustedAllowances[key];
  }
  const grossSalary =
    sumOfAllowances +
    overtimeAmount +
    nightShiftAllowanceAmount +
    incentiveAmount +
    commissionAmount +
    bonusAmount;

  // ── 8. Flat deductions ────────────────────────────────────────────────────
  const manualDeductionsTotal = deductionConfig.manualDeductions.reduce(
    (s, d) => s + d.amount,
    0,
  );
  const advanceDeduction = additionalAmounts.advanceDeduction || 0;
  const taxDeduction = additionalAmounts.taxDeduction || 0;
  const otherDeduction = manualDeductionsTotal;

  const totalDeductions = advanceDeduction + taxDeduction + otherDeduction;
  const netSalary = grossSalary - totalDeductions; // Allow negative for carry-forward

  // ── 9. Standard breakdown snapshot ───────────────────────────────────────
  const standardBreakdown: Record<string, number> = {};
  standardBreakdown["basicSalary"] = basicSalaryStd;
  for (const a of config) standardBreakdown[a.id] = a.amount;

  const perDayBasic = basicSalaryStd / calendarDaysInMonth;
  const perHourBasic = perDayBasic / stdDutyHours;

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    designation: employee.designation,
    cnic: employee.cnic || "N/A",
    bankName: employee.bankName || "N/A",
    bankAccountNumber: employee.bankAccountNumber || "N/A",

    payrollMonth: format(parseISO(payrollPeriod.month), "MMM-yy"),
    startDate: payrollPeriod.startDate,
    endDate: payrollPeriod.endDate,

    totalWorkingDays: fullCycleWorkingDays,
    daysPresent,
    daysAbsent,
    daysLeave,
    daysUnapprovedLeave,
    daysSickLeave,
    daysCasualLeave,
    daysAnnualLeave,
    daysSpecialLeave,
    daysNotEmployed,
    unmarkedDays,
    totalOvertimeHours: +totalOvertimeHours.toFixed(2),
    totalUndertimeHours,
    nightShiftsCount,
    bradfordFactorScore,
    bradfordFactorPeriod: `${format(parseISO(evaluationStartDate), "d MMM yyyy")} to ${format(parseISO(evaluationEndDate), "d MMM yyyy")}`,

    basicSalary: adjustedAllowances["basicSalary"] || 0,
    allowanceBreakdown: adjustedAllowances,

    overtimeAmount,
    nightShiftAllowanceAmount,
    incentiveAmount,
    commissionAmount,
    bonusAmount,

    notEmployedDeduction: Math.round(notEmployedDeduction),
    absentDeduction: Math.round(absentDeduction),
    leaveDeduction: Math.round(leaveDeduction),
    advanceDeduction: Math.round(advanceDeduction),
    taxDeduction: Math.round(taxDeduction),
    manualDeductions: deductionConfig.manualDeductions,
    otherDeduction: Math.round(otherDeduction),

    grossSalary: Math.round(grossSalary),
    totalDeductions: Math.round(totalDeductions),
    netSalary: Math.round(netSalary),
    paymentSource: null,

    standardBreakdown,
    calculationMeta: {
      calendarDaysInMonth,
      perDayBasic: +perDayBasic.toFixed(4),
      perHourBasic: +perHourBasic.toFixed(4),
      overtimeMultiplier,
      overtimeRatePerHour: +(perHourBasic * overtimeMultiplier).toFixed(4),
      standardDutyHours: stdDutyHours,
      restDays,
    },

    remarks: "",
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validatePayslip(payslip: PayslipCalculation): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (payslip.netSalary < 0) {
    errors.push("Net salary is negative. Deductions exceed earnings.");
  }
  if (payslip.grossSalary === 0) {
    warnings.push("Gross salary is zero. Employee may be on unpaid leave.");
  }

  const totalDays =
    payslip.daysPresent +
    payslip.daysAbsent +
    payslip.daysLeave +
    payslip.daysUnapprovedLeave;

  if (totalDays > payslip.totalWorkingDays) {
    errors.push("Total attendance days exceed working days in period.");
  }

  return { isValid: errors.length === 0, warnings, errors };
}
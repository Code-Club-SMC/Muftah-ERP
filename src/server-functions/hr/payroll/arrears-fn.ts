import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { employees, payrolls, payslips } from "@/db/schemas/hr-schema";
import { requireHrViewMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { eq, and, lt, inArray, sql, ne } from "drizzle-orm";
import { format, subMonths, parseISO } from "date-fns";
import { getCycleFromMonthKey, getCycleForPayoutMonth } from "@/lib/payroll-cycle";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type MissedCycleEntry = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  /** YYYY-MM key of the missed payout month */
  missedPayoutMonth: string;
  /** Human label e.g. "February 2026" */
  missedMonthLabel: string;
  /** The employee's basic salary — used as arrears estimate */
  basicSalary: number;
};

// ──────────────────────────────────────────────────────────────────────────────
// getArrearsMissedCyclesFn
// Returns every active employee × every CLOSED cycle where no payslip exists.
// A cycle is "closed" if its payoutDate has already passed (including today).
//
// Edge cases handled:
//  - Employee joined after the missed cycle end → excluded (not eligible)
//  - Already has an arrears entry in a later payslip → excluded (settled)
//  - The current active cycle is NEVER reported as missed (it's still open)
// ──────────────────────────────────────────────────────────────────────────────

export const getArrearsMissedCyclesFn = createServerFn()
  .middleware([requireHrViewMiddleware])
  .inputValidator(
    z.object({
      /** How many months back to look. Defaults to 12 — covers 1 full year. */
      lookbackMonths: z.number().int().min(1).max(36).default(12),
    }),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // ── 1. Build the list of closed cycles to audit ───────────────────────
    // Walk backwards month-by-month. Only include months whose payoutDate
    // (the 25th) is strictly before today — meaning the cycle is fully closed.
    const closedCycles: Array<{ payoutMonthKey: string; label: string; cycleEnd: string }> = [];

    for (let i = 1; i <= data.lookbackMonths; i++) {
      const d = subMonths(today, i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const cycle = getCycleForPayoutMonth(year, month);

      // Only include cycles whose payout date has already passed
      if (cycle.payoutDate < todayStr) {
        closedCycles.push({
          payoutMonthKey: cycle.payoutMonthKey,
          label: cycle.slipLabel,
          cycleEnd: cycle.cycleEnd,
        });
      }
    }

    if (closedCycles.length === 0) return { missed: [] };

    // ── 2. Fetch all active employees ─────────────────────────────────────
    const activeEmployees = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        designation: employees.designation,
        joiningDate: employees.joiningDate,
        basicSalary: employees.basicSalary,
      })
      .from(employees)
      .where(eq(employees.status, "active"));

    if (activeEmployees.length === 0) return { missed: [] };

    // ── 3. Fetch payrolls for all audited months in one query ─────────────
    const payoutMonthDates = closedCycles.map((c) => `${c.payoutMonthKey}-01`);
    const existingPayrolls = await db
      .select({ id: payrolls.id, month: payrolls.month })
      .from(payrolls)
      .where(inArray(payrolls.month, payoutMonthDates));

    // Map payoutMonthKey → payrollId
    const payrollByMonth: Record<string, string> = {};
    for (const p of existingPayrolls) {
      // p.month is stored as YYYY-MM-DD; trim to YYYY-MM
      const key = p.month.substring(0, 7);
      payrollByMonth[key] = p.id;
    }

    // ── 4. Fetch all payslips for those payrolls in one batch ──────────────
    const relevantPayrollIds = Object.values(payrollByMonth);
    const existingPayslips =
      relevantPayrollIds.length > 0
        ? await db
            .select({ employeeId: payslips.employeeId, payrollId: payslips.payrollId })
            .from(payslips)
            .where(inArray(payslips.payrollId, relevantPayrollIds))
        : [];

    // Build a Set of "payrollId|employeeId" for O(1) lookup
    const payslipSet = new Set(existingPayslips.map((p) => `${p.payrollId}|${p.employeeId}`));

    // ── 5. Fetch arrears already settled in future payslips ───────────────
    // An arrears entry is "already settled" if a later payslip records
    // the missed month in its arrearsFromMonths JSON array.
    // We fetch all payslips with non-empty arrears arrays.
    const settledArrears = await db
      .select({
        employeeId: payslips.employeeId,
        arrearsFromMonths: payslips.arrearsFromMonths,
      })
      .from(payslips)
      .where(
        // arrearsFromMonths not empty  →  json_array_length > 0
        sql`json_array_length(${payslips.arrearsFromMonths}::json) > 0`,
      );

    // Build a Set of "employeeId|missedMonthKey" that are already settled
    const settledSet = new Set<string>();
    for (const row of settledArrears) {
      const months = (row.arrearsFromMonths as string[] | null) ?? [];
      for (const m of months) {
        settledSet.add(`${row.employeeId}|${m}`);
      }
    }

    // ── 6. Determine missed entries ───────────────────────────────────────
    const missed: MissedCycleEntry[] = [];

    for (const cycle of closedCycles) {
      const payrollId = payrollByMonth[cycle.payoutMonthKey];

      for (const emp of activeEmployees) {
        // Guard 1: Employee must have joined before the cycle closed
        if (emp.joiningDate > cycle.cycleEnd) continue;

        // Guard 2: Payslip already exists in this payroll
        if (payrollId && payslipSet.has(`${payrollId}|${emp.id}`)) continue;

        // Guard 3: Arrears for this month already rolled into a later payslip
        if (settledSet.has(`${emp.id}|${cycle.payoutMonthKey}`)) continue;

        missed.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          designation: emp.designation,
          missedPayoutMonth: cycle.payoutMonthKey,
          missedMonthLabel: cycle.label,
          basicSalary: parseFloat(emp.basicSalary || "0"),
        });
      }
    }

    // Sort: most recent missed month first
    missed.sort((a, b) => b.missedPayoutMonth.localeCompare(a.missedPayoutMonth));

    return { missed };
  });

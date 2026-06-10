/**
 * Bradford Factor Snapshot Server Functions
 * Freezes monthly attendance summaries when payroll is closed.
 */

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { bradfordSnapshots, attendance, payrolls, payslips } from "@/db/schemas/hr-schema";
import { requireHrManageMiddleware } from "@/lib/middlewares";
import { eq, and, gte, lte } from "drizzle-orm";
import { calculateYearlyBradfordFactor, type AttendanceRecord } from "@/lib/payroll-calculator";

/**
 * Auto-snapshot Bradford data for all employees in a payroll.
 * Called when payroll status changes to "closed".
 */
export async function snapshotBradfordForPayroll(payrollId: string) {
  const payroll = await db.query.payrolls.findFirst({
    where: eq(payrolls.id, payrollId),
  });
  if (!payroll) throw new Error(`Payroll ${payrollId} not found`);

  const yearMonth = payroll.month.substring(0, 7); // "YYYY-MM"

  // Find all payslips for this payroll
  const payrollPayslips = await db.query.payslips.findMany({
    where: eq(payslips.payrollId, payrollId),
  });

  if (payrollPayslips.length === 0) {
    throw new Error(`No payslips found for payroll ${payrollId}`);
  }

  const snapshots = [];

  for (const payslip of payrollPayslips) {
    const employeeId = payslip.employeeId;

    // Get full-month attendance for this payroll period
    const periodAttendance = await db.query.attendance.findMany({
      where: and(
        eq(attendance.employeeId, employeeId),
        gte(attendance.date, payroll.startDate),
        lte(attendance.date, payroll.endDate),
      ),
    });

    // Counts
    const totalAbsences = periodAttendance.filter((a) => a.status === "absent").length;
    const totalSickLeaves = periodAttendance.filter(
      (a) => a.status === "leave" && a.leaveType === "sick" && a.isApprovedLeave,
    ).length;
    const totalAnnualLeaves = periodAttendance.filter(
      (a) => a.status === "leave" && a.leaveType === "annual" && a.isApprovedLeave,
    ).length;
    const totalLateArrivals = periodAttendance.filter((a) => a.isLate).length;
    const totalEarlyDepartures = periodAttendance.filter(
      (a) => a.earlyDepartureStatus === "early",
    ).length;
    const nightShiftsCount = periodAttendance.filter((a) => a.isNightShift).length;

    // Yearly Bradford (Jan 1 - Dec 31 of the payroll year)
    const payrollYear = new Date(payroll.month).getFullYear();
    const yearStart = `${payrollYear}-01-01`;
    const yearEnd = `${payrollYear}-12-31`;
    const yearAttendanceRaw = await db.query.attendance.findMany({
      where: and(
        eq(attendance.employeeId, employeeId),
        gte(attendance.date, yearStart),
        lte(attendance.date, yearEnd),
      ),
    });

    const yearAttendanceFormatted: AttendanceRecord[] = yearAttendanceRaw.map((r) => ({
      date: r.date,
      status: r.status as any,
      dutyHours: r.dutyHours,
      overtimeHours: r.overtimeHours,
      isNightShift: r.isNightShift || false,
      isApprovedLeave: r.isApprovedLeave ?? false,
      leaveType: r.leaveType ?? null,
      overtimeStatus: r.overtimeStatus ?? "pending",
      isLate: r.isLate ?? false,
      earlyDepartureStatus: r.earlyDepartureStatus ?? "none",
    }));

    const bradfordFactor = calculateYearlyBradfordFactor(yearAttendanceFormatted);

    const dailyAttendanceJson = periodAttendance.map((a) => ({
      date: a.date,
      status: a.status,
      isLate: a.isLate ?? false,
      earlyDepartureStatus: a.earlyDepartureStatus ?? "none",
      leaveType: a.leaveType ?? null,
    }));

    snapshots.push({
      employeeId,
      payrollId,
      payslipId: payslip.id,
      snapshotYearMonth: yearMonth,
      totalAbsences,
      totalSickLeaves,
      totalAnnualLeaves,
      totalLateArrivals,
      totalEarlyDepartures,
      nightShiftsCount,
      bradfordFactor: bradfordFactor.toString(),
      dailyAttendanceJson,
      unmarkedDaysAtClose: payslip.daysAbsent || 0,
      remarks: `Auto-snapshot on payroll close. Payslip Bradford: ${payslip.bradfordFactorScore || "N/A"}`,
    });
  }

  // Delete any existing snapshots for this payroll (idempotent)
  await db
    .delete(bradfordSnapshots)
    .where(eq(bradfordSnapshots.payrollId, payrollId));

  // Insert all snapshots
  if (snapshots.length > 0) {
    await db.insert(bradfordSnapshots).values(snapshots);
  }

  return { snapshotted: snapshots.length, payrollId };
}

/**
 * Server function: Trigger Bradford snapshot for a payroll
 */
export const snapshotBradfordForPayrollFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator((input: any) =>
    ({ payrollId: input.payrollId } as { payrollId: string }),
  )
  .handler(async ({ data }) => {
    return snapshotBradfordForPayroll(data.payrollId);
  });

/**
 * Get Bradford snapshot history for an employee
 */
export const getBradfordSnapshotHistoryFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator((input: any) =>
    ({ employeeId: input.employeeId } as { employeeId: string }),
  )
  .handler(async ({ data }) => {
    return db.query.bradfordSnapshots.findMany({
      where: eq(bradfordSnapshots.employeeId, data.employeeId),
      orderBy: [bradfordSnapshots.snapshotYearMonth],
      with: {
        payroll: { columns: { month: true, status: true } },
      },
    });
  });

/**
 * Get a single Bradford snapshot by ID
 */
export const getBradfordSnapshotByIdFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator((input: any) =>
    ({ id: input.id } as { id: string }),
  )
  .handler(async ({ data }) => {
    const snapshot = await db.query.bradfordSnapshots.findFirst({
      where: eq(bradfordSnapshots.id, data.id),
      with: {
        employee: { columns: { id: true, firstName: true, lastName: true } },
        payroll: { columns: { month: true, status: true } },
        payslip: { columns: { id: true, bradfordFactorScore: true } },
      },
    });
    if (!snapshot) throw new Error("Snapshot not found");
    return snapshot;
  });

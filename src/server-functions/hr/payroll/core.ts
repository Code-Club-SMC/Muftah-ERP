import { db } from "@/db";
import {
  employees,
  payslips,
  salaryAdvances,
  advanceInstallments,
  nightShiftRates,
  travelLogs,
} from "@/db/schemas/hr-schema";
import { orderBookerTrips, commissionRecords, orderBookers } from "@/db/schemas/sales-erp-schema";
import { wallets, transactions } from "@/db/schemas/finance-schema";
import { eq, and, inArray, gte, lte, sql, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  calculatePayslip,
  calculateYearlyBradfordFactor,
  type DeductionConfig,
  type AttendanceRecord,
  type EmployeeData,
} from "@/lib/payroll-calculator";
import { getSalaryAtDate } from "./salary-revisions-fn";

export type AdvanceProcessRecord = {
  id: string;
  installmentAmount: number;
  installmentNo: number;
  totalInstallments: number;
  remainingBalance: number;
  isFullySettled: boolean;
};

/**
 * Shared logic to fetch and calculate advance deductions for an employee.
 * Hardened to handle legacy null installmentAmounts by calculating on-the-fly.
 */
export async function calculateEnrichedAdvanceDeductions(employeeId: string) {
  const pendingAdvances = await db.query.salaryAdvances.findMany({
    where: and(
      eq(salaryAdvances.employeeId, employeeId),
      eq(salaryAdvances.status, "approved"),
    ),
  });

  // Only advances that still have installments remaining
  const activeAdvances = pendingAdvances.filter(
    (a) => a.installmentsPaid < a.installmentMonths,
  );

  let totalDeduction = 0;
  const processedRecords: AdvanceProcessRecord[] = [];

  for (const adv of activeAdvances) {
    const totalAmount = parseFloat(adv.amount);
    const months = adv.installmentMonths || 1;
    const paidCount = adv.installmentsPaid || 0;

    // Use stored installmentAmount, or calculate as fallback if null/legacy
    const instAmt = adv.installmentAmount
      ? parseFloat(adv.installmentAmount)
      : +(totalAmount / months).toFixed(2);

    const currentInstallmentNo = paidCount + 1;
    const remainingAfterThis = Math.max(0, totalAmount - instAmt * currentInstallmentNo);

    totalDeduction += instAmt;
    processedRecords.push({
      id: adv.id,
      installmentAmount: instAmt,
      installmentNo: currentInstallmentNo,
      totalInstallments: months,
      remainingBalance: remainingAfterThis,
      isFullySettled: currentInstallmentNo >= months,
    });
  }

  return { totalDeduction, processedRecords };
}

export type GeneratePayslipInput = {
  employeeId: string;
  payrollId: string;
  payrollPeriod: {
    month: string;
    startDate: string;
    endDate: string;
  };
  deductionConfig?: DeductionConfig;
  additionalAmounts?: {
    overtimeAmount?: number;
    nightShiftAllowance?: number;
    incentiveAmount?: number;
    bonusAmount?: number;
    advanceDeduction?: number;
    taxDeduction?: number;
    overtimeMultiplier?: number;
  };
  /**
   * Arrears Roll-Forward -- missed prior-cycle salaries to include in this slip.
   *
   * Each entry in arrearsFromMonths is a YYYY-MM payout-month key that was missed.
   * arrearsAmount is the total PKR to add on top of this cycle's net salary.
   * The months are stored in the payslip so future detection queries skip them.
   *
   * Runtime validation rules:
   *  - All months must be valid YYYY-MM strings strictly in the past
   *  - Max 12 months per payslip (prevents accidental mass-rollup)
   *  - arrearsAmount must be > 0 when arrearsFromMonths is non-empty
   */
  arrears?: {
    arrearsAmount: number;
    arrearsFromMonths: string[];
  };
  /**
   * ID of the wallet to debit net salary from.
   * If provided, wallet balance is validated and debited inside the same
   * DB transaction as the payslip insert -- so insufficient balance rolls
   * back the entire operation.
   * If omitted, payslip is saved without any wallet debit (for previewing
   * or when deduction happens at a later payroll-run step).
   */
  walletId?: string;
  autoDeductAdvances?: boolean;
  autoUpdateLeaveBalances?: boolean;
  autoFetchNightShiftRate?: boolean;
  autoFetchTada?: boolean;
  earlyCutoffDate?: string;
  ignorePastUnmarkedDays?: boolean;
};

export async function generateEmployeePayslipCore(
  input: GeneratePayslipInput,
  performedById: string,
) {
  const {
    employeeId,
    payrollId,
    payrollPeriod,
    deductionConfig,
    additionalAmounts = {},
    arrears,
    walletId,
    autoDeductAdvances = true,
    autoUpdateLeaveBalances = true,
    autoFetchNightShiftRate = true,
    autoFetchTada = true,
    earlyCutoffDate,
    ignorePastUnmarkedDays = false,
  } = input;

  // -- 0. Validate arrears (fail-fast before any DB work) --------------------
  const arrearsAmt = arrears?.arrearsAmount ?? 0;
  const arrearsMonths = arrears?.arrearsFromMonths ?? [];

  if (arrearsMonths.length > 0) {
    if (arrearsAmt <= 0) {
      throw new Error("arrearsAmount must be > 0 when arrearsFromMonths is provided.");
    }
    if (arrearsMonths.length > 12) {
      throw new Error("Cannot roll forward more than 12 missed months in a single payslip.");
    }
    const todayKey = payrollPeriod.month.substring(0, 7); // YYYY-MM of current cycle
    const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/;
    for (const m of arrearsMonths) {
      if (!monthRe.test(m)) {
        throw new Error(`Invalid arrears month key: "${m}". Must be YYYY-MM format.`);
      }
      if (m >= todayKey) {
        throw new Error(
          `Arrears month "${m}" is not in the past. Only closed cycles can be rolled forward.`,
        );
      }
    }
  }

  // -- 1. Employee + Historical Salary -------------------------------------
  const employeeData = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });
  if (!employeeData) throw new Error(`Employee ${employeeId} not found`);

  // Fetch the salary revision active for this payroll period
  const salaryRevision = await getSalaryAtDate(employeeId, payrollPeriod.startDate);
  if (!salaryRevision) {
    throw new Error(`No salary configuration found for employee ${employeeId} at ${payrollPeriod.startDate}`);
  }

  // Merge historical salary onto employee data for the calculator
  const employeeWithHistoricalSalary = {
    ...employeeData,
    basicSalary: salaryRevision.basicSalary,
    allowanceConfig: salaryRevision.allowanceConfig,
  };

  // -- 2. Attendance ---------------------------------------------------------
  const rawAttendance = await db.query.attendance.findMany({
    where: (table, { and, gte, lte, eq }) =>
      and(
        eq(table.employeeId, employeeId),
        gte(table.date, payrollPeriod.startDate),
        lte(table.date, payrollPeriod.endDate),
      ),
  });

  const formattedAttendance: AttendanceRecord[] = rawAttendance.map((r) => ({
    date: r.date,
    status: r.status,
    dutyHours: r.dutyHours,
    overtimeHours: r.overtimeHours,
    isNightShift: r.isNightShift || false,
    isApprovedLeave: r.isApprovedLeave ?? false,
    leaveType: r.leaveType ?? null,
    overtimeStatus: r.overtimeStatus ?? "pending",
    isLate: r.isLate ?? false,
    earlyDepartureStatus: r.earlyDepartureStatus ?? "none",
  }));

  // -- 3. Salary advances (installment-aware) --------------------------------
  let advanceDeduction: number;
  let advanceIdsToProcess: AdvanceProcessRecord[] = [];

  if (autoDeductAdvances && additionalAmounts.advanceDeduction === undefined) {
    const { totalDeduction, processedRecords } = await calculateEnrichedAdvanceDeductions(employeeId);
    advanceDeduction = totalDeduction;
    advanceIdsToProcess = processedRecords;
  } else {
    advanceDeduction = additionalAmounts.advanceDeduction ?? 0;
  }

  // -- 4. Night shift rate ---------------------------------------------------
  let nightShiftAllowance = additionalAmounts.nightShiftAllowance;
  if (autoFetchNightShiftRate && nightShiftAllowance === undefined) {
    const nightShifts = formattedAttendance.filter((r) => r.isNightShift);
    if (nightShifts.length > 0) {
      const payrollYear = new Date(payrollPeriod.month).getFullYear();
      const rateConfig = await db.query.nightShiftRates.findFirst({
        where: eq(nightShiftRates.year, payrollYear),
      });
      nightShiftAllowance = (rateConfig ? parseFloat(rateConfig.ratePerNight) : 0) * nightShifts.length;
    } else {
      nightShiftAllowance = 0;
    }
  }

  // -- 5. TA/DA from travel logs ---------------------------------------------
  let tadaAmount = 0;
  if (autoFetchTada) {
    const approvedTrips = await db.query.travelLogs.findMany({
      where: and(
        eq(travelLogs.employeeId, employeeId),
        eq(travelLogs.status, "approved"),
        isNull(travelLogs.reimbursedAt), // Skip already-reimbursed logs
        and(
          sql`${travelLogs.date} >= ${payrollPeriod.startDate}`,
          sql`${travelLogs.date} <= ${payrollPeriod.endDate}`,
        ),
      ),
    });
    tadaAmount = approvedTrips.reduce(
      (sum, t) => sum + parseFloat(t.totalAmount || "0"),
      0,
    );
  }

  // -- 5.5 Order booker TA + commission --------------------------------------
  let dynamicTA = 0;
  let orderBookerCommission = 0;
  let commissionIdsToPay: string[] = [];
  let commissionBreakdownSnapshot: Array<{
    orderId: string;
    orderRef: string;
    orderDate: string;
    orderValue: number;
    rate: number;
    amount: number;
  }> = [];

  // Find linked order booker for this employee
  const linkedOrderBooker = await db.query.orderBookers.findFirst({
    where: eq(orderBookers.employeeId, employeeId),
  });

  if (linkedOrderBooker) {
    // Sum trip TADA + fuel costs within payroll period
    const trips = await db.query.orderBookerTrips.findMany({
      where: and(
        eq(orderBookerTrips.orderBookerId, linkedOrderBooker.id),
        gte(orderBookerTrips.tripDate, new Date(payrollPeriod.startDate)),
        lte(orderBookerTrips.tripDate, new Date(payrollPeriod.endDate)),
      ),
    });
    dynamicTA = trips.reduce((sum, trip) => {
      const tada = parseFloat(trip.tadaAmount || "0");
      const fuel = parseFloat(trip.fuelCost || "0");
      return sum + tada + fuel;
    }, 0);

    // Sum accrued commission records within payroll period
    const commissions = await db.query.commissionRecords.findMany({
      where: and(
        eq(commissionRecords.orderBookerId, linkedOrderBooker.id),
        eq(commissionRecords.status, "accrued"),
        gte(commissionRecords.calculatedAt, new Date(payrollPeriod.startDate)),
        lte(commissionRecords.calculatedAt, new Date(payrollPeriod.endDate)),
      ),
      with: {
        order: {
          columns: { id: true, billNumber: true, createdAt: true, fulfilledAmount: true },
        },
      },
    });
    orderBookerCommission = commissions.reduce(
      (sum, rec) => sum + parseFloat(rec.commissionAmount || "0"),
      0,
    );
    commissionIdsToPay = commissions.map((c) => c.id);

    // Build commission breakdown snapshot for payslip
    commissionBreakdownSnapshot = commissions.map((rec) => ({
      orderId: rec.orderId,
      orderRef: `ORD-${rec.order?.billNumber || rec.orderId.substring(0, 8)}`,
      orderDate: rec.order?.createdAt ? new Date(rec.order.createdAt).toISOString().split("T")[0] : "",
      orderValue: parseFloat(rec.order?.fulfilledAmount || rec.fulfilledAmount || "0"),
      rate: parseFloat(rec.appliedRate || "0"),
      amount: parseFloat(rec.commissionAmount || "0"),
    }));
  }

  // -- 6. Calculate payslip --------------------------------------------------
  const mergedAdditional = {
    ...additionalAmounts,
    advanceDeduction,
    nightShiftAllowance: nightShiftAllowance ?? additionalAmounts.nightShiftAllowance,
    incentiveAmount:
      (additionalAmounts.incentiveAmount || 0) + tadaAmount + dynamicTA,
    commissionAmount: orderBookerCommission,
  };

  const payslipCalc = calculatePayslip(
    employeeWithHistoricalSalary as unknown as EmployeeData,
    formattedAttendance,
    payrollPeriod,
    deductionConfig,
    mergedAdditional,
    earlyCutoffDate,
  );

  // -- 6.1 Strict validation for missing attendance --------------------------
  // Salesmen and order bookers are excluded from attendance tracking
  const isSalesOrOB = employeeData.isSalesman || employeeData.isOrderBooker;
  if (payslipCalc.unmarkedDays > 0 && !ignorePastUnmarkedDays && !isSalesOrOB) {
    const err = new Error(`PAST_UNMARKED_DAYS:${payslipCalc.unmarkedDays}`);
    err.name = "ValidationError";
    throw err;
  }

  // -- 6.5 Yearly Bradford Factor (Jan 1 - Dec 31 of the payroll year) -------
  const payrollYear = new Date(payrollPeriod.month).getFullYear();
  const yearStart = `${payrollYear}-01-01`;
  const yearEnd = `${payrollYear}-12-31`;
  const yearAttendanceRaw = await db.query.attendance.findMany({
    where: (table, { and, eq, gte, lte }) =>
      and(
        eq(table.employeeId, employeeId),
        gte(table.date, yearStart),
        lte(table.date, yearEnd),
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
  const yearlyBradfordScore = calculateYearlyBradfordFactor(yearAttendanceFormatted);

  // -- 6.6 Fetch carried-forward deficit from previous payslip ----------------
  const previousPayslip = await db.query.payslips.findFirst({
    where: eq(payslips.employeeId, employeeId),
    orderBy: (payslips, { desc }) => [desc(payslips.createdAt)],
  });
  const previousDeficit = previousPayslip 
    ? parseFloat(previousPayslip.carriedForwardDeficit || "0")
    : 0;

  // Add previous deficit to deductions
  if (previousDeficit > 0) {
    payslipCalc.totalDeductions += previousDeficit;
    payslipCalc.netSalary -= previousDeficit;
  }

  // -- 7. Validate wallet balance BEFORE writing anything --------------------
  // Include arrears so the wallet covers the FULL amount the employee is owed.
  // If netSalary is negative, wallet validation is skipped (no debit needed).
  const totalNetWithArrears = payslipCalc.netSalary + arrearsAmt;
  const carriedForwardDeficit = payslipCalc.netSalary < 0 ? Math.abs(payslipCalc.netSalary) : 0;

  let walletName: string | null = null;
  if (walletId && totalNetWithArrears > 0) {
    const [wallet] = await db
      .select({ id: wallets.id, name: wallets.name, balance: wallets.balance })
      .from(wallets)
      .where(eq(wallets.id, walletId));

    if (!wallet) throw new Error("Selected wallet not found.");

    const available = parseFloat(wallet.balance || "0");
    const required = totalNetWithArrears;

    if (available < required) {
      const arrearsNote =
        arrearsAmt > 0
          ? ` (includes PKR ${Math.round(arrearsAmt).toLocaleString()} arrears for ${arrearsMonths.join(", ")})`
          : "";
      throw new Error(
        `Insufficient balance in "${wallet.name}"${arrearsNote}. ` +
        `Available: PKR ${Math.round(available).toLocaleString()}, ` +
        `Required: PKR ${Math.round(required).toLocaleString()}.`,
      );
    }
    walletName = wallet.name;
  }

  // -- 8. Atomic transaction: delete old -> save payslip -> debit wallet -----
  const savedPayslip = await db.transaction(async (tx) => {
    // 8a. Delete existing payslip for this payroll+employee (idempotent regeneration)
    await tx
      .delete(payslips)
      .where(
        and(
          eq(payslips.payrollId, payrollId),
          eq(payslips.employeeId, employeeId),
        ),
      );

    // 8b. Insert new payslip
    const [slip] = await tx
      .insert(payslips)
      .values({
        payrollId,
        employeeId: employeeData.id,
        salaryRevisionId: salaryRevision.id === "current" ? null : salaryRevision.id,

        daysPresent: payslipCalc.daysPresent,
        daysAbsent: payslipCalc.daysAbsent,
        daysLeave: payslipCalc.daysLeave,
        totalOvertimeHours: payslipCalc.totalOvertimeHours.toString(),
        nightShiftsCount: payslipCalc.nightShiftsCount,

        bradfordFactorScore: payslipCalc.bradfordFactorScore.toString(),
        bradfordFactorPeriod: payslipCalc.bradfordFactorPeriod,
        yearlyBradfordScore: yearlyBradfordScore.toString(),

        basicSalary: payslipCalc.basicSalary.toString(),
        allowanceBreakdown: payslipCalc.allowanceBreakdown,
        overtimeAmount: payslipCalc.overtimeAmount.toString(),
        nightShiftAllowanceAmount: payslipCalc.nightShiftAllowanceAmount.toString(),
        incentiveAmount: payslipCalc.incentiveAmount.toString(),
        commissionAmount: payslipCalc.commissionAmount.toString(),
        commissionBreakdown: commissionBreakdownSnapshot.length > 0 ? commissionBreakdownSnapshot : null,
        bonusAmount: payslipCalc.bonusAmount.toString(),

        // Combine notEmployedDeduction into absentDeduction to avoid schema migration,
        // but log it in remarks for transparency.
        absentDeduction: (payslipCalc.absentDeduction + (payslipCalc.notEmployedDeduction || 0)).toString(),
        leaveDeduction: payslipCalc.leaveDeduction.toString(),
        advanceDeduction: payslipCalc.advanceDeduction.toString(),
        taxDeduction: payslipCalc.taxDeduction.toString(),
        otherDeduction: payslipCalc.otherDeduction.toString(),

        grossSalary: payslipCalc.grossSalary.toString(),
        totalDeductions: payslipCalc.totalDeductions.toString(),
        // Net = calculator net + rolled-forward arrears from missed cycles
        netSalary: totalNetWithArrears.toString(),

        // Carry-forward deficit (when deductions exceed earnings)
        carriedForwardDeficit: carriedForwardDeficit.toString(),

        // Arrears audit trail -- stored permanently so future missed-cycle
        // detection queries skip these months for this employee.
        arrearsAmount: arrearsAmt.toString(),
        arrearsFromMonths: arrearsMonths.length > 0 ? arrearsMonths : [],

        // Store wallet name as historical text record -- survives wallet deletion
        paymentSource: walletName,
        remarks: [
          payslipCalc.remarks,
          salaryRevision.id === "current"
            ? `Basic Salary: PKR ${Math.round(parseFloat(salaryRevision.basicSalary as string)).toLocaleString()} (legacy, no revision record)`
            : `Salary revision #${salaryRevision.id.substring(0, 8)} effective ${salaryRevision.revisionDate}: PKR ${Math.round(parseFloat(salaryRevision.basicSalary as string)).toLocaleString()}`,
          `Allowances: ${(salaryRevision.allowanceConfig || []).map((a: any) => `${a.name} PKR ${Math.round(a.amount).toLocaleString()}`).join(", ") || "None"}`,
          previousDeficit > 0
            ? `Carried Forward Deficit from previous cycle: PKR ${Math.round(previousDeficit).toLocaleString()}`
            : null,
          carriedForwardDeficit > 0
            ? `DEFICIT: PKR ${Math.round(carriedForwardDeficit).toLocaleString()} will be carried forward to next cycle`
            : null,
          payslipCalc.daysNotEmployed > 0 
            ? `Prorated by PKR ${Math.round(payslipCalc.notEmployedDeduction).toLocaleString()} for ${payslipCalc.daysNotEmployed} pre-joining/cutoff day(s).` 
            : null,
          arrearsMonths.length > 0
            ? `Includes arrears of PKR ${Math.round(arrearsAmt).toLocaleString()} for: ${arrearsMonths.join(", ")}.`
            : null,
          advanceIdsToProcess.length > 0
            ? advanceIdsToProcess.map(a => 
                `Advance Recovery (Inst. ${a.installmentNo}/${a.totalInstallments}) - Remaining: PKR ${Math.round(a.remainingBalance).toLocaleString()}`
              ).join(" | ")
            : null,
        ].filter(Boolean).join(" | ") || null,
      })
      .returning();

    // 8c. Debit wallet -- full amount including arrears (same transaction -- rolls back on any failure)
    if (walletId && walletName) {
      await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${totalNetWithArrears}` })
        .where(eq(wallets.id, walletId));

      await tx.insert(transactions).values({
        id: createId(),
        walletId,
        type: "debit",
        amount: totalNetWithArrears.toString(),
        source: arrearsAmt > 0 ? "Payroll (with Arrears)" : "Payroll",
        referenceId: slip.id,
        performedById,
      });
    }

    // 8d. Record advance installments and track progress
    if (advanceIdsToProcess.length > 0) {
      for (const adv of advanceIdsToProcess) {
        // Insert an installment record
        await tx.insert(advanceInstallments).values({
          id: createId(),
          advanceId: adv.id,
          payslipId: slip.id,
          amount: adv.installmentAmount.toString(),
          installmentNo: adv.installmentNo,
        });

        // Increment installments paid
        if (adv.isFullySettled) {
          await tx
            .update(salaryAdvances)
            .set({ status: "settled", installmentsPaid: adv.installmentNo })
            .where(eq(salaryAdvances.id, adv.id));
        } else {
          await tx
            .update(salaryAdvances)
            .set({ installmentsPaid: adv.installmentNo })
            .where(eq(salaryAdvances.id, adv.id));
        }
      }
    }

    // 8e. Pay out accrued commission records for linked order booker
    if (linkedOrderBooker && commissionIdsToPay.length > 0) {
      await tx
        .update(commissionRecords)
        .set({
          status: "paid",
          paidInPayslipId: slip.id,
          updatedAt: new Date(),
        })
        .where(inArray(commissionRecords.id, commissionIdsToPay));
    }

    return slip;
  });

  // -- 9. Update leave balances (outside transaction -- non-critical) ---------
  if (autoUpdateLeaveBalances) {
    const currentYear = new Date().getFullYear();
    const leaveYearStartYear = employeeData.leaveYearStart
      ? new Date(employeeData.leaveYearStart).getFullYear()
      : null;

    // Auto-reset annual leave balance when a new calendar year is detected
    const shouldResetLeave = leaveYearStartYear === null || leaveYearStartYear < currentYear;
    const allowance = employeeData.annualLeaveAllowance ?? 14;
    const currentBalance = shouldResetLeave
      ? allowance // fresh year -- start from full allowance
      : (employeeData.annualLeaveBalance ?? allowance);

    const leaveTaken = rawAttendance.filter(
      (r) => r.status === "leave" && r.isApprovedLeave,
    );
    const annualTaken = leaveTaken.filter((r) => r.leaveType === "annual").length;
    const sickTaken = leaveTaken.filter((r) => r.leaveType === "sick").length;

    const updatePayload: Record<string, any> = {
      sickLeaveBalance: Math.max(0, (employeeData.sickLeaveBalance ?? 10) - sickTaken),
    };

    if (shouldResetLeave) {
      updatePayload.annualLeaveBalance = Math.max(0, allowance - annualTaken);
      updatePayload.leaveYearStart = `${currentYear}-01-01`;
    } else if (annualTaken > 0) {
      updatePayload.annualLeaveBalance = Math.max(0, currentBalance - annualTaken);
    }

    await db
      .update(employees)
      .set(updatePayload)
      .where(eq(employees.id, employeeId));
  }

  return {
    ...savedPayslip,
    calculation: payslipCalc,
    arrearsAmount: arrearsAmt,
    arrearsFromMonths: arrearsMonths,
    totalNetWithArrears,
    walletDebited: walletId
      ? { walletId, walletName, amount: totalNetWithArrears }
      : null,
  };
}

/**
 * Simulate payslip generation WITHOUT writing to database.
 * Returns the same calculation output as generateEmployeePayslipCore
 * but performs no inserts, updates, or wallet debits.
 */
export async function simulateEmployeePayslipCore(
  input: GeneratePayslipInput,
) {
  const {
    employeeId,
    payrollPeriod,
    deductionConfig,
    additionalAmounts = {},
    arrears,
    autoDeductAdvances = true,
    autoFetchNightShiftRate = true,
    autoFetchTada = true,
    earlyCutoffDate,
    ignorePastUnmarkedDays = false,
  } = input;

  // -- 0. Validate arrears (fail-fast before any DB work) --------------------
  const arrearsAmt = arrears?.arrearsAmount ?? 0;
  const arrearsMonths = arrears?.arrearsFromMonths ?? [];

  if (arrearsMonths.length > 0) {
    if (arrearsAmt <= 0) {
      throw new Error("arrearsAmount must be > 0 when arrearsFromMonths is provided.");
    }
    if (arrearsMonths.length > 12) {
      throw new Error("Cannot roll forward more than 12 missed months in a single payslip.");
    }
    const todayKey = payrollPeriod.month.substring(0, 7);
    const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/;
    for (const m of arrearsMonths) {
      if (!monthRe.test(m)) {
        throw new Error(`Invalid arrears month key: "${m}". Must be YYYY-MM format.`);
      }
      if (m >= todayKey) {
        throw new Error(
          `Arrears month "${m}" is not in the past. Only closed cycles can be rolled forward.`,
        );
      }
    }
  }

  // -- 1. Employee + Historical Salary -------------------------------------
  const employeeData = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });
  if (!employeeData) throw new Error(`Employee ${employeeId} not found`);

  const salaryRevision = await getSalaryAtDate(employeeId, payrollPeriod.startDate);
  if (!salaryRevision) {
    throw new Error(`No salary configuration found for employee ${employeeId} at ${payrollPeriod.startDate}`);
  }

  const employeeWithHistoricalSalary = {
    ...employeeData,
    basicSalary: salaryRevision.basicSalary,
    allowanceConfig: salaryRevision.allowanceConfig,
  };

  // -- 2. Attendance ---------------------------------------------------------
  const rawAttendance = await db.query.attendance.findMany({
    where: (table, { and, gte, lte, eq }) =>
      and(
        eq(table.employeeId, employeeId),
        gte(table.date, payrollPeriod.startDate),
        lte(table.date, payrollPeriod.endDate),
      ),
  });

  const formattedAttendance: AttendanceRecord[] = rawAttendance.map((r) => ({
    date: r.date,
    status: r.status,
    dutyHours: r.dutyHours,
    overtimeHours: r.overtimeHours,
    isNightShift: r.isNightShift || false,
    isApprovedLeave: r.isApprovedLeave ?? false,
    leaveType: r.leaveType ?? null,
    overtimeStatus: r.overtimeStatus ?? "pending",
    isLate: r.isLate ?? false,
    earlyDepartureStatus: r.earlyDepartureStatus ?? "none",
  }));

  // -- 3. Salary advances (installment-aware) --------------------------------
  let advanceDeduction: number;
  let advanceIdsToProcess: AdvanceProcessRecord[] = [];

  if (autoDeductAdvances && additionalAmounts.advanceDeduction === undefined) {
    const { totalDeduction, processedRecords } = await calculateEnrichedAdvanceDeductions(employeeId);
    advanceDeduction = totalDeduction;
    advanceIdsToProcess = processedRecords;
  } else {
    advanceDeduction = additionalAmounts.advanceDeduction ?? 0;
  }

  // -- 4. Night shift rate ---------------------------------------------------
  let nightShiftAllowance = additionalAmounts.nightShiftAllowance;
  if (autoFetchNightShiftRate && nightShiftAllowance === undefined) {
    const nightShifts = formattedAttendance.filter((r) => r.isNightShift);
    if (nightShifts.length > 0) {
      const payrollYear = new Date(payrollPeriod.month).getFullYear();
      const rateConfig = await db.query.nightShiftRates.findFirst({
        where: eq(nightShiftRates.year, payrollYear),
      });
      nightShiftAllowance = (rateConfig ? parseFloat(rateConfig.ratePerNight) : 0) * nightShifts.length;
    } else {
      nightShiftAllowance = 0;
    }
  }

  // -- 5. TA/DA from travel logs ---------------------------------------------
  let tadaAmount = 0;
  if (autoFetchTada) {
    const approvedTrips = await db.query.travelLogs.findMany({
      where: and(
        eq(travelLogs.employeeId, employeeId),
        eq(travelLogs.status, "approved"),
        isNull(travelLogs.reimbursedAt),
        and(
          sql`${travelLogs.date} >= ${payrollPeriod.startDate}`,
          sql`${travelLogs.date} <= ${payrollPeriod.endDate}`,
        ),
      ),
    });
    tadaAmount = approvedTrips.reduce(
      (sum, t) => sum + parseFloat(t.totalAmount || "0"),
      0,
    );
  }

  // -- 5.5 Order booker TA + commission --------------------------------------
  let dynamicTA = 0;
  let orderBookerCommission = 0;
  let commissionBreakdownSnapshot: Array<{
    orderId: string;
    orderRef: string;
    orderDate: string;
    orderValue: number;
    rate: number;
    amount: number;
  }> = [];

  const linkedOrderBooker = await db.query.orderBookers.findFirst({
    where: eq(orderBookers.employeeId, employeeId),
  });

  if (linkedOrderBooker) {
    const trips = await db.query.orderBookerTrips.findMany({
      where: and(
        eq(orderBookerTrips.orderBookerId, linkedOrderBooker.id),
        gte(orderBookerTrips.tripDate, new Date(payrollPeriod.startDate)),
        lte(orderBookerTrips.tripDate, new Date(payrollPeriod.endDate)),
      ),
    });
    dynamicTA = trips.reduce((sum, trip) => {
      const tada = parseFloat(trip.tadaAmount || "0");
      const fuel = parseFloat(trip.fuelCost || "0");
      return sum + tada + fuel;
    }, 0);

    const commissions = await db.query.commissionRecords.findMany({
      where: and(
        eq(commissionRecords.orderBookerId, linkedOrderBooker.id),
        eq(commissionRecords.status, "accrued"),
        gte(commissionRecords.calculatedAt, new Date(payrollPeriod.startDate)),
        lte(commissionRecords.calculatedAt, new Date(payrollPeriod.endDate)),
      ),
      with: {
        order: {
          columns: { id: true, billNumber: true, createdAt: true, fulfilledAmount: true },
        },
      },
    });
    orderBookerCommission = commissions.reduce(
      (sum, rec) => sum + parseFloat(rec.commissionAmount || "0"),
      0,
    );

    commissionBreakdownSnapshot = commissions.map((rec) => ({
      orderId: rec.orderId,
      orderRef: `ORD-${rec.order?.billNumber || rec.orderId.substring(0, 8)}`,
      orderDate: rec.order?.createdAt ? new Date(rec.order.createdAt).toISOString().split("T")[0] : "",
      orderValue: parseFloat(rec.order?.fulfilledAmount || rec.fulfilledAmount || "0"),
      rate: parseFloat(rec.appliedRate || "0"),
      amount: parseFloat(rec.commissionAmount || "0"),
    }));
  }

  // -- 6. Calculate payslip --------------------------------------------------
  const mergedAdditional = {
    ...additionalAmounts,
    advanceDeduction,
    nightShiftAllowance: nightShiftAllowance ?? additionalAmounts.nightShiftAllowance,
    incentiveAmount:
      (additionalAmounts.incentiveAmount || 0) + tadaAmount + dynamicTA,
    commissionAmount: orderBookerCommission,
  };

  const payslipCalc = calculatePayslip(
    employeeWithHistoricalSalary as unknown as EmployeeData,
    formattedAttendance,
    payrollPeriod,
    deductionConfig,
    mergedAdditional,
    earlyCutoffDate,
  );

  // -- 6.1 Strict validation for missing attendance --------------------------
  const isSalesOrOB = employeeData.isSalesman || employeeData.isOrderBooker;
  if (payslipCalc.unmarkedDays > 0 && !ignorePastUnmarkedDays && !isSalesOrOB) {
    const err = new Error(`PAST_UNMARKED_DAYS:${payslipCalc.unmarkedDays}`);
    err.name = "ValidationError";
    throw err;
  }

  // -- 6.5 Yearly Bradford Factor --------------------------------------------
  const payrollYear = new Date(payrollPeriod.month).getFullYear();
  const yearStart = `${payrollYear}-01-01`;
  const yearEnd = `${payrollYear}-12-31`;
  const yearAttendanceRaw = await db.query.attendance.findMany({
    where: (table, { and, eq, gte, lte }) =>
      and(
        eq(table.employeeId, employeeId),
        gte(table.date, yearStart),
        lte(table.date, yearEnd),
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
  const yearlyBradfordScore = calculateYearlyBradfordFactor(yearAttendanceFormatted);

  // -- 6.6 Fetch carried-forward deficit from previous payslip ----------------
  const previousPayslip = await db.query.payslips.findFirst({
    where: eq(payslips.employeeId, employeeId),
    orderBy: (payslips, { desc }) => [desc(payslips.createdAt)],
  });
  const previousDeficit = previousPayslip 
    ? parseFloat(previousPayslip.carriedForwardDeficit || "0")
    : 0;

  if (previousDeficit > 0) {
    payslipCalc.totalDeductions += previousDeficit;
    payslipCalc.netSalary -= previousDeficit;
  }

  const totalNetWithArrears = payslipCalc.netSalary + arrearsAmt;
  const carriedForwardDeficit = payslipCalc.netSalary < 0 ? Math.abs(payslipCalc.netSalary) : 0;

  // -- Return simulation result (NO DB WRITES) --------------------------------
  return {
    employee: {
      id: employeeData.id,
      employeeCode: employeeData.employeeCode,
      firstName: employeeData.firstName,
      lastName: employeeData.lastName,
      designation: employeeData.designation,
      cnic: employeeData.cnic,
      bankName: employeeData.bankName,
      bankAccountNumber: employeeData.bankAccountNumber,
    },
    calculation: payslipCalc,
    yearlyBradfordScore,
    arrearsAmount: arrearsAmt,
    arrearsFromMonths: arrearsMonths,
    totalNetWithArrears,
    carriedForwardDeficit,
    previousDeficit,
    commissionBreakdown: commissionBreakdownSnapshot,
    advanceProcessRecords: advanceIdsToProcess,
    salaryRevision: {
      id: salaryRevision.id,
      revisionDate: salaryRevision.revisionDate,
      basicSalary: salaryRevision.basicSalary,
    },
  };
}
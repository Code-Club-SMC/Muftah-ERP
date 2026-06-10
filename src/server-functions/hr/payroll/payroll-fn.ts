import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { payrolls, employees, payslips, salaryAdvances } from "@/db/schemas/hr-schema";
import { wallets, transactions } from "@/db/schemas/finance-schema";
import {
  requireHrManageMiddleware,
  requireHrViewMiddleware,
} from "@/lib/middlewares";
import { z } from "zod";
import { eq, sql, inArray } from "drizzle-orm";
import { format, parseISO, startOfMonth, subMonths, addDays } from "date-fns";
import { generateEmployeePayslipCore, simulateEmployeePayslipCore } from "./core";
import { snapshotBradfordForPayroll } from "./bradford-snapshot-fn";
import { rebuildSalesPerformanceLog } from "./sales-performance-fn";
import { createId } from "@paralleldrive/cuid2";

// ── Status Workflow Validation ────────────────────────────────────────────────
type PayrollStatus = "draft" | "approved" | "paid";

function validateStatusTransition(
  currentStatus: PayrollStatus,
  action: "edit" | "delete" | "approve" | "reject" | "pay" | "generate",
): void {
  const errors: Record<string, string> = {
    "draft-edit": "Draft payroll can be edited",
    "draft-delete": "Draft payroll can be deleted",
    "draft-approve": "Draft payroll can be approved",
    "draft-generate": "Cannot generate payslips for draft payroll. Approve first.",
    "draft-reject": "Draft payroll cannot be rejected",
    "draft-pay": "Draft payroll must be approved before payment",
    "approved-edit": "Approved payroll is locked for editing",
    "approved-delete": "Approved payroll cannot be deleted",
    "approved-approve": "Payroll is already approved",
    "approved-generate": "Approved payroll can generate payslips",
    "approved-reject": "Approved payroll can be rejected back to draft",
    "approved-pay": "Approved payroll can be marked as paid",
    "paid-edit": "Paid payroll is fully immutable",
    "paid-delete": "Paid payroll is fully immutable",
    "paid-approve": "Paid payroll is fully immutable",
    "paid-generate": "Paid payroll is fully immutable",
    "paid-reject": "Paid payroll is fully immutable",
    "paid-pay": "Payroll is already marked as paid",
  };

  const key = `${currentStatus}-${action}`;
  const isAllowed = !errors[key]?.includes("cannot") && !errors[key]?.includes("immutable") && !errors[key]?.includes("locked");
  
  if (!isAllowed) {
    throw new Error(errors[key] || `Invalid status transition: ${currentStatus} → ${action}`);
  }
}

const createPayrollSchema = z.object({
  month: z.string(), // YYYY-MM-DD
  employeeIds: z.array(z.string()).optional(),
  processedBy: z.string(),
});

export const createPayrollFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(createPayrollSchema)
  .handler(async ({ data }) => {
    const { month, processedBy } = data;

    // Calculate payroll period
    // Default: Previous month 16th to Current month 15th
    // e.g. If creating for Dec 2025: Period is Nov 16 - Dec 15.
    const monthDate = parseISO(month);
    const prevMonth = subMonths(monthDate, 1);

    const startDate = format(
      addDays(startOfMonth(prevMonth), 15),
      "yyyy-MM-dd",
    );
    const endDate = format(addDays(startOfMonth(monthDate), 14), "yyyy-MM-dd");

    // Check if payroll already exists for this month
    const existing = await db.query.payrolls.findFirst({
      where: eq(payrolls.month, month),
    });
    if (existing) {
      throw new Error(`Payroll for ${format(monthDate, "MMMM yyyy")} already exists (status: ${existing.status})`);
    }

    // 1. Create payroll record (draft status - no payslips generated yet)
    const [payroll] = await db
      .insert(payrolls)
      .values({
        month,
        startDate,
        endDate,
        status: "draft",
        totalAmount: "0",
        processedBy,
      })
      .returning();

    return {
      payroll,
      message: `Payroll for ${format(monthDate, "MMMM yyyy")} created in draft status. Approve to generate payslips.`,
    };
  });

/**
 * Generate payslips for an approved payroll.
 * Can only be called when payroll status is "approved".
 */
export const generatePayslipsFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(z.object({ payrollId: z.string() }))
  .handler(async ({ data }) => {
    const payroll = await db.query.payrolls.findFirst({
      where: eq(payrolls.id, data.payrollId),
    });
    if (!payroll) throw new Error("Payroll not found");

    validateStatusTransition(payroll.status as PayrollStatus, "generate");

    const monthDate = parseISO(payroll.month);

    // Identify employees to process
    const employeesToProcess = await db.query.employees.findMany({
      where: eq(employees.status, "active"),
    });

    // Generate Payslips in Parallel
    const payslipPromises = employeesToProcess.map(async (employee) => {
      try {
        return await generateEmployeePayslipCore(
          {
            employeeId: employee.id,
            payrollId: payroll.id,
            payrollPeriod: {
              month: payroll.month,
              startDate: payroll.startDate,
              endDate: payroll.endDate,
            },
          },
          payroll.processedBy || "system",
        );
      } catch (error) {
        console.error(
          `Failed to generate payslip for employee ${employee.id}:`,
          error,
        );
        return null;
      }
    });

    const results = await Promise.all(payslipPromises);
    const successfulPayslips = results.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );

    // Update Payroll Total
    const totalAmount = successfulPayslips.reduce(
      (sum, p) => sum + parseFloat(p.netSalary.toString()),
      0,
    );

    await db
      .update(payrolls)
      .set({ totalAmount: totalAmount.toString() })
      .where(eq(payrolls.id, payroll.id));

    // Rebuild sales performance logs for order bookers / salesmen (non-blocking)
    const yearMonth = format(monthDate, "yyyy-MM");
    for (const emp of employeesToProcess) {
      if (emp.isOrderBooker || emp.isSalesman) {
        try {
          await rebuildSalesPerformanceLog(emp.id, yearMonth);
        } catch (err) {
          console.error(`Performance log failed for ${emp.id}:`, err);
        }
      }
    }

    return {
      totalEmployees: employeesToProcess.length,
      generatedCount: successfulPayslips.length,
      failedCount: employeesToProcess.length - successfulPayslips.length,
      totalAmount: totalAmount.toString(),
      message: `Generated ${successfulPayslips.length} payslips.`,
    };
  });

/**
 * Get payroll by ID
 */
export const getPayrollByIdFn = createServerFn()
  .middleware([requireHrViewMiddleware])
  .inputValidator(z.object({ payrollId: z.string() }))
  .handler(async ({ data }) => {
    return await db.query.payrolls.findFirst({
      where: eq(payrolls.id, data.payrollId),
      with: {
        payslips: {
          with: {
            employee: {
              columns: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                cnic: true,
                bankName: true,
                bankAccountNumber: true,
              },
            },
          },
        },
        processor: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });

/**
 * List all payrolls
 */
export const listPayrollsFn = createServerFn()
  .middleware([requireHrViewMiddleware])
  .inputValidator(z.object({ limit: z.number().optional().default(50) }))
  .handler(async ({ data }) => {
    return await db.query.payrolls.findMany({
      with: {
        processor: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: (payrolls, { desc }) => [desc(payrolls.month)],
      limit: data.limit,
    });
  });

/**
 * Approve payroll
 */
export const approvePayrollFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(z.object({ payrollId: z.string() }))
  .handler(async ({ data }) => {
    // Fetch current payroll to validate status
    const current = await db.query.payrolls.findFirst({
      where: eq(payrolls.id, data.payrollId),
    });
    if (!current) throw new Error("Payroll not found");

    validateStatusTransition(current.status as PayrollStatus, "approve");

    const [updated] = await db
      .update(payrolls)
      .set({ status: "approved" })
      .where(eq(payrolls.id, data.payrollId))
      .returning();

    // Snapshot Bradford Factor data when payroll is approved (calculations frozen)
    try {
      await snapshotBradfordForPayroll(data.payrollId);
    } catch (err) {
      console.error("Bradford snapshot failed for payroll", data.payrollId, err);
      // Non-blocking: approval succeeds even if snapshot fails
    }

    return updated;
  });


export const rejectPayrollFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(z.object({ payrollId: z.string() }))
  .handler(async ({ data }) => {
    const current = await db.query.payrolls.findFirst({
      where: eq(payrolls.id, data.payrollId),
    });
    if (!current) throw new Error("Payroll not found");

    validateStatusTransition(current.status as PayrollStatus, "reject");

    const [updated] = await db
      .update(payrolls)
      .set({ status: "draft" })
      .where(eq(payrolls.id, data.payrollId))
      .returning();

    return updated;
  });

/**
 * Mark payroll as paid — debits from a finance wallet and logs a ledger transaction.
 */
export const markPayrollAsPaidFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(
    z.object({
      payrollId: z.string(),
      walletId: z.string().min(1, "Please select a payment wallet"),
    }),
  )
  .handler(async ({ data, context }) => {
    return await db.transaction(async (tx) => {
      // 1. Get the payroll details
      const payroll = await tx.query.payrolls.findFirst({
        where: eq(payrolls.id, data.payrollId),
      });

      if (!payroll) throw new Error("Payroll not found");

      validateStatusTransition(payroll.status as PayrollStatus, "pay");

      const payrollAmount = parseFloat(payroll.totalAmount || "0");

      // 2. Fetch wallet and validate balance
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, data.walletId));

      if (!wallet) throw new Error("Selected wallet not found");

      const currentBalance = parseFloat(wallet.balance || "0");
      if (currentBalance < payrollAmount) {
        throw new Error(
          `Insufficient balance in "${wallet.name}". Available: PKR ${currentBalance.toLocaleString()}, Required: PKR ${payrollAmount.toLocaleString()}`,
        );
      }

      // 3. Debit the wallet
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${payrollAmount}`,
        })
        .where(eq(wallets.id, data.walletId));

      // 4. Create ledger transaction
      await tx.insert(transactions).values({
        id: createId(),
        walletId: data.walletId,
        type: "debit",
        amount: payrollAmount.toString(),
        source: `Payroll - ${format(parseISO(payroll.month), "MMM yyyy")}`,
        referenceId: data.payrollId,
        performedById: context.session.user.id,
      });

      // 5. Update the payroll record
      const [updated] = await tx
        .update(payrolls)
        .set({
          status: "paid",
          walletId: data.walletId,
          paidAt: new Date(),
        })
        .where(eq(payrolls.id, data.payrollId))
        .returning();

      return updated;
    });
  });

/**
 * Delete a payroll and all its payslips.
 * Also resets any salary advances that were deducted via this payroll's payslips
 * so they can be recovered in the next payroll cycle.
 */
export const deletePayrollFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(z.object({ payrollId: z.string() }))
  .handler(async ({ data }) => {
    // Validate status before deletion
    const current = await db.query.payrolls.findFirst({
      where: eq(payrolls.id, data.payrollId),
    });
    if (!current) throw new Error("Payroll not found");

    validateStatusTransition(current.status as PayrollStatus, "delete");

    return await db.transaction(async (tx) => {
      // 1. Get all payslip IDs for this payroll
      const payslipList = await tx.query.payslips.findMany({
        where: eq(payslips.payrollId, data.payrollId),
        columns: { id: true },
      });
      const payslipIds = payslipList.map((p) => p.id);

      // 2. Reset salary advances that were deducted via these payslips.
      //    Move them back to 'approved' so they'll be re-deducted in the next cycle.
      if (payslipIds.length > 0) {
        await tx
          .update(salaryAdvances)
          .set({ status: "approved", deductedInPayslipId: null })
          .where(inArray(salaryAdvances.deductedInPayslipId, payslipIds));
      }

      // 3. Delete payslips
      await tx.delete(payslips).where(eq(payslips.payrollId, data.payrollId));

      // 4. Delete the payroll
      const [deleted] = await tx
        .delete(payrolls)
        .where(eq(payrolls.id, data.payrollId))
        .returning();

      return deleted;
    });
  });

/**
 * Simulate payroll generation WITHOUT writing to database.
 * Returns preview of all payslips for review before confirmation.
 */
export const simulatePayrollFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator(
    z.object({
      payrollId: z.string().optional(), // If provided, use existing payroll period
      month: z.string().optional(), // If no payrollId, create virtual period
      employeeIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    let startDate: string;
    let endDate: string;
    let month: string;

    if (data.payrollId) {
      const payroll = await db.query.payrolls.findFirst({
        where: eq(payrolls.id, data.payrollId),
      });
      if (!payroll) throw new Error("Payroll not found");
      startDate = payroll.startDate;
      endDate = payroll.endDate;
      month = payroll.month;
    } else if (data.month) {
      month = data.month;
      const monthDate = parseISO(month);
      const prevMonth = subMonths(monthDate, 1);
      startDate = format(addDays(startOfMonth(prevMonth), 15), "yyyy-MM-dd");
      endDate = format(addDays(startOfMonth(monthDate), 14), "yyyy-MM-dd");
    } else {
      throw new Error("Either payrollId or month must be provided");
    }

    // Identify employees to simulate
    let employeesToProcess;
    if (data.employeeIds && data.employeeIds.length > 0) {
      const ids = data.employeeIds;
      employeesToProcess = await db.query.employees.findMany({
        where: (employees, { inArray }) => inArray(employees.id, ids),
      });
    } else {
      employeesToProcess = await db.query.employees.findMany({
        where: eq(employees.status, "active"),
      });
    }

    // Simulate payslips in parallel
    const simulationPromises = employeesToProcess.map(async (employee) => {
      try {
        return await simulateEmployeePayslipCore({
          employeeId: employee.id,
          payrollId: data.payrollId || "simulation",
          payrollPeriod: { month, startDate, endDate },
        });
      } catch (error) {
        console.error(`Simulation failed for employee ${employee.id}:`, error);
        return {
          error: error instanceof Error ? error.message : "Unknown error",
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        };
      }
    });

    const results = await Promise.all(simulationPromises);
    const successful = results.filter((r): r is Exclude<typeof r, { error: string }> => !("error" in r));
    const failed = results.filter((r): r is { error: string; employeeId: string; employeeName: string } => "error" in r);

    const totalNet = successful.reduce(
      (sum, r) => sum + (r.totalNetWithArrears || 0),
      0,
    );
    const totalDeficit = successful.reduce(
      (sum, r) => sum + (r.carriedForwardDeficit || 0),
      0,
    );

    return {
      month,
      startDate,
      endDate,
      totalEmployees: employeesToProcess.length,
      successfulCount: successful.length,
      failedCount: failed.length,
      totalNetSalary: totalNet,
      totalCarriedForwardDeficit: totalDeficit,
      simulations: successful,
      errors: failed,
    };
  });

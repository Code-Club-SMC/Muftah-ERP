/**
 * Salary Revision Server Functions
 * Tracks historical changes to employee salary and allowance configuration
 */

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { employees, salaryRevisions } from "@/db/schemas/hr-schema";
import { requireHrViewMiddleware, requireHrManageMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { eq, and, lte, desc } from "drizzle-orm";

/**
 * Get the active salary revision for an employee at a specific date.
 * Returns the most recent revision where revisionDate <= targetDate.
 */
export async function getSalaryAtDate(employeeId: string, date: string) {
  const revisions = await db.query.salaryRevisions.findMany({
    where: and(
      eq(salaryRevisions.employeeId, employeeId),
      lte(salaryRevisions.revisionDate, date),
    ),
    orderBy: [desc(salaryRevisions.revisionDate)],
    limit: 1,
  });

  if (revisions.length > 0) {
    return revisions[0];
  }

  // Fallback: return current employee record (backward compatibility during migration)
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) return null;

  return {
    id: "current",
    employeeId: employee.id,
    revisionDate: employee.joiningDate,
    basicSalary: employee.basicSalary,
    allowanceConfig: employee.allowanceConfig,
    reason: "Current salary (pre-revision tracking)",
    changedById: null,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

/**
 * Create a new salary revision (called when salary/allowances change)
 */
export const createSalaryRevisionFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      employeeId: z.string().min(1),
      revisionDate: z.string().min(1),
      basicSalary: z.string().min(1),
      allowanceConfig: z.array(z.object({
        id: z.string(),
        name: z.string(),
        amount: z.number(),
        deductions: z.object({
          absent: z.boolean(),
          annualLeave: z.boolean(),
          sickLeave: z.boolean(),
          specialLeave: z.boolean(),
          lateArrival: z.boolean(),
          earlyLeaving: z.boolean(),
        }),
      })),
      reason: z.string().min(1, "Reason is required"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [revision] = await db
      .insert(salaryRevisions)
      .values({
        employeeId: data.employeeId,
        revisionDate: data.revisionDate,
        basicSalary: data.basicSalary,
        allowanceConfig: data.allowanceConfig,
        reason: data.reason,
        changedById: context.session.user.id,
      })
      .returning();

    return revision;
  });

/**
 * Get salary revision history for an employee
 */
export const getSalaryRevisionHistoryFn = createServerFn()
  .middleware([requireHrViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      employeeId: z.string().min(1),
      limit: z.number().int().positive().default(50),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    return await db.query.salaryRevisions.findMany({
      where: eq(salaryRevisions.employeeId, data.employeeId),
      orderBy: [desc(salaryRevisions.revisionDate)],
      limit: data.limit,
      with: {
        changedBy: { columns: { id: true, name: true } },
      },
    });
  });

/**
 * Recalculate affected payslips after retroactive salary correction
 */
export const recalculateAffectedPayslipsFn = createServerFn()
  .middleware([requireHrManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      employeeId: z.string().min(1),
      fromDate: z.string().min(1),
      payrollIds: z.array(z.string()).min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    // This is a placeholder for the recalculation logic
    // In practice, this would iterate through the specified payrolls,
    // regenerate payslips using the corrected salary, and return a diff report
    // Implementation would call generateEmployeePayslipCore for each affected payroll
    return {
      message: `Recalculation requested for ${data.payrollIds.length} payrolls from ${data.fromDate}`,
      employeeId: data.employeeId,
      affectedPayrolls: data.payrollIds,
    };
  });

/**
 * Sales Performance Log Server Functions
 * Tracks monthly sales metrics for order bookers and salesmen.
 * Called after commission calculation and/or invoice creation.
 */

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import {
  salesPerformanceLogs,
  commissionRecords,
  orderBookers,
  salesmen,
  orders,
} from "@/db/schemas/sales-erp-schema";
import { invoices } from "@/db/schemas/sales-schema";
import { employees } from "@/db/schemas/hr-schema";
import { requireHrViewMiddleware, requireSalesManageMiddleware } from "@/lib/middlewares";
import { eq, and, gte, lte, desc } from "drizzle-orm";

/**
 * Rebuild sales performance log for an employee for a given month.
 * Called after commission calculation or invoice batch processing.
 */
export async function rebuildSalesPerformanceLog(
  employeeId: string,
  yearMonth: string, // "YYYY-MM"
) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });
  if (!employee) throw new Error(`Employee ${employeeId} not found`);

  // Determine if order booker, salesman, or both
  const linkedOrderBooker = await db.query.orderBookers.findFirst({
    where: eq(orderBookers.employeeId, employeeId),
  });
  const linkedSalesman = await db.query.salesmen.findFirst({
    where: eq(salesmen.employeeId, employeeId),
  });

  const monthStart = `${yearMonth}-01`;
  const monthEndDate = new Date(`${yearMonth}-31T23:59:59`);

  let totalOrders = 0;
  let fulfilledOrders = 0;
  let totalOrderValue = 0;
  let totalCommission = 0;
  let commissionIds: string[] = [];

  let totalInvoices = 0;
  let totalCartonsSold = 0;
  let totalSalesValue = 0;
  let invoiceIds: string[] = [];

  // Order Booker metrics
  if (linkedOrderBooker) {
    const obId = linkedOrderBooker.id;

    const commissions = await db.query.commissionRecords.findMany({
      where: and(
        eq(commissionRecords.orderBookerId, obId),
        gte(commissionRecords.calculatedAt, new Date(monthStart)),
        lte(commissionRecords.calculatedAt, monthEndDate),
      ),
    });

    totalCommission = commissions.reduce((s, c) => s + parseFloat(c.commissionAmount || "0"), 0);
    commissionIds = commissions.map((c) => c.id);

    const obOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.orderBookerId, obId),
        gte(orders.createdAt, new Date(monthStart)),
        lte(orders.createdAt, monthEndDate),
      ),
    });

    totalOrders = obOrders.length;
    fulfilledOrders = obOrders.filter((o) => o.status === "fulfilled").length;
    totalOrderValue = obOrders.reduce((s, o) => s + parseFloat(o.fulfilledAmount || "0"), 0);
  }

  // Salesman metrics
  if (linkedSalesman) {
    const smId = linkedSalesman.id;

    const smInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.salesmanId, smId),
        gte(invoices.createdAt, new Date(monthStart)),
        lte(invoices.createdAt, monthEndDate),
      ),
    });

    totalInvoices = smInvoices.length;
    totalSalesValue = smInvoices.reduce((s, inv) => s + parseFloat(inv.totalPrice || "0"), 0);
    invoiceIds = smInvoices.map((inv) => inv.id);

    // Cartons sold (sum of quantities if available)
    // Note: invoice items not directly linked here; this is a simplified metric.
    // In production, you'd join invoice_items and sum carton quantities.
    totalCartonsSold = smInvoices.length; // Placeholder: use invoice count as proxy
  }

  // Compute achievement rate (sales vs target)
  // Target is simplified to a hardcoded or fetched value per employee.
  // In production, you'd have a monthly_target field on employees or a separate targets table.
  const targetValue = 500000; // PKR 5 lac placeholder
  const achievementRate = targetValue > 0 ? (totalSalesValue / targetValue) * 100 : 0;

  // Compute rank (placeholder — in production, compute across all employees in same role)
  const monthlyRank = 0;

  // Upsert performance log
  await db
    .insert(salesPerformanceLogs)
    .values({
      employeeId,
      yearMonth,
      totalOrders,
      fulfilledOrders,
      totalOrderValue: totalOrderValue.toString(),
      totalCommission: totalCommission.toString(),
      totalInvoices,
      totalCartonsSold,
      totalSalesValue: totalSalesValue.toString(),
      totalTargetValue: targetValue.toString(),
      achievementRate: achievementRate.toFixed(2),
      monthlyRank,
      commissionRecordIds: commissionIds,
      invoiceIds,
      remarks: `Auto-logged ${new Date().toISOString()}`,
    })
    .onConflictDoUpdate({
      target: [salesPerformanceLogs.employeeId, salesPerformanceLogs.yearMonth],
      set: {
        totalOrders,
        fulfilledOrders,
        totalOrderValue: totalOrderValue.toString(),
        totalCommission: totalCommission.toString(),
        totalInvoices,
        totalCartonsSold,
        totalSalesValue: totalSalesValue.toString(),
        totalTargetValue: targetValue.toString(),
        achievementRate: achievementRate.toFixed(2),
        monthlyRank,
        commissionRecordIds: commissionIds,
        invoiceIds,
        updatedAt: new Date(),
      },
    });

  return { employeeId, yearMonth, totalCommission, totalSalesValue };
}

/**
 * Server function: Rebuild performance log for an employee in a month
 */
export const rebuildSalesPerformanceLogFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) =>
    ({ employeeId: input.employeeId, yearMonth: input.yearMonth } as {
      employeeId: string;
      yearMonth: string;
    }),
  )
  .handler(async ({ data }) => {
    return rebuildSalesPerformanceLog(data.employeeId, data.yearMonth);
  });

/**
 * Get performance logs for an employee
 */
export const getSalesPerformanceLogsFn = createServerFn()
  .middleware([requireHrViewMiddleware])
  .inputValidator((input: any) =>
    ({ employeeId: input.employeeId, limit: input.limit ?? 24 } as {
      employeeId: string;
      limit: number;
    }),
  )
  .handler(async ({ data }) => {
    return db.query.salesPerformanceLogs.findMany({
      where: eq(salesPerformanceLogs.employeeId, data.employeeId),
      orderBy: [desc(salesPerformanceLogs.yearMonth)],
      limit: data.limit,
    });
  });

/**
 * Get top performers for a given month
 */
export const getTopPerformersFn = createServerFn()
  .middleware([requireHrViewMiddleware])
  .inputValidator((input: any) =>
    ({ yearMonth: input.yearMonth, role: input.role } as {
      yearMonth: string;
      role: "order_booker" | "salesman" | "all";
    }),
  )
  .handler(async ({ data }) => {
    const logs = await db.query.salesPerformanceLogs.findMany({
      where: eq(salesPerformanceLogs.yearMonth, data.yearMonth),
      orderBy: [desc(salesPerformanceLogs.totalSalesValue)],
      with: {
        employee: { columns: { id: true, firstName: true, lastName: true, designation: true } },
      },
    });

    // Filter by role if needed (simplified — in production, filter via employee flags)
    return logs;
  });

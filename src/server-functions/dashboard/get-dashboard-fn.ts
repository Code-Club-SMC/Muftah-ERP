import { createServerFn } from "@tanstack/react-start";
import { requireDashboardViewMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { db } from "@/db";
import { invoices } from "@/db/schemas/sales-schema";
import {
  productionRuns,
  materialStock,
  finishedGoodsStock,
  chemicals,
  packagingMaterials,
  recipes,
  productionMaterialsUsed,
} from "@/db/schemas/inventory-schema";
import { payslips, payrolls, employees } from "@/db/schemas/hr-schema";
import { expenses } from "@/db/schemas/finance-schema";
import { sql, and, gte, lte, eq, desc, inArray } from "drizzle-orm";
import {
  format,
  startOfMonth,
} from "date-fns";

function toFloat(value: string | number | null | undefined): number {
  const n = parseFloat(String(value ?? "0"));
  return isNaN(n) ? 0 : n;
}

async function getPayrollCostForIds(payrollIds: string[]): Promise<number> {
  if (payrollIds.length === 0) return 0;
  const result = await db
    .select({ total: sql<string>`coalesce(sum(${payslips.netSalary}), 0)` })
    .from(payslips)
    .where(inArray(payslips.payrollId, payrollIds));
  return toFloat(result[0]?.total);
}

export const getDashboardStatsFn = createServerFn()
  .middleware([requireDashboardViewMiddleware])
  .inputValidator(
    z.object({
      startDate: z.string().datetime().or(z.string().date()),
      endDate: z.string().datetime().or(z.string().date()),
    }),
  )
  .handler(async ({ data }) => {
    const { startDate, endDate } = data;

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    // ── Run all top-level KPI queries in parallel ─────────────────────────
    const [
      revenueRow,
      productionRow,
      chemicalStockRow,
      packagingStockRow,
      finishedGoodsRow,
      // FIX #1: Sum actual material consumption cost from completed runs
      materialConsumptionRow,
      expensesRow,
      payrollsInRange,
      empCountRow,
    ] = await Promise.all([
      // 1. Revenue
      db
        .select({
          total: sql<string>`coalesce(sum(${invoices.totalPrice}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(and(gte(invoices.createdAt, rangeStart), lte(invoices.createdAt, rangeEnd)))
        .then((r) => r[0]),

      // 2. Production — FIX #3: cartons only from COMPLETED runs
      db
        .select({
          activeCount: sql<number>`count(*) filter (where ${productionRuns.status} = 'in_progress')`,
          completedCount: sql<number>`count(*) filter (where ${productionRuns.status} = 'completed')`,
          // Only sum cartons from completed runs — scheduled runs should NOT count
          totalCartons: sql<string>`coalesce(sum(${productionRuns.cartonsProduced}) filter (where ${productionRuns.status} = 'completed'), 0)`,
        })
        .from(productionRuns)
        .where(and(gte(productionRuns.createdAt, rangeStart), lte(productionRuns.createdAt, rangeEnd)))
        .then((r) => r[0]),

      // 3a. Chemical stock value
      db
        .select({ value: sql<string>`coalesce(sum(${materialStock.quantity}::numeric * ${chemicals.costPerUnit}::numeric), 0)` })
        .from(materialStock)
        .leftJoin(chemicals, eq(materialStock.chemicalId, chemicals.id))
        .where(sql`${materialStock.chemicalId} is not null`)
        .then((r) => r[0]),

      // 3b. Packaging stock value
      db
        .select({ value: sql<string>`coalesce(sum(${materialStock.quantity}::numeric * ${packagingMaterials.costPerUnit}::numeric), 0)` })
        .from(materialStock)
        .leftJoin(packagingMaterials, eq(materialStock.packagingMaterialId, packagingMaterials.id))
        .where(sql`${materialStock.packagingMaterialId} is not null`)
        .then((r) => r[0]),

      // 3c. Finished goods stock value — uses WAC per pack
      db
        .select({
          value: sql<string>`coalesce(sum(
            (
              ${finishedGoodsStock.quantityCartons} * coalesce(${recipes.containersPerCarton}, 0)
              + ${finishedGoodsStock.quantityContainers}
            )::numeric * coalesce(nullif(trim(${finishedGoodsStock.weightedAverageCostPerPack}::text), '')::numeric, 0)
          ), 0)`,
        })
        .from(finishedGoodsStock)
        .leftJoin(recipes, eq(finishedGoodsStock.recipeId, recipes.id))
        .then((r) => r[0]),

      // FIX #1: Actual material consumption from productionMaterialsUsed for completed runs
      // This gives us real chemical + packaging costs that were consumed, not just estimates
      db
        .select({
          totalMaterialCost: sql<string>`coalesce(sum(${productionMaterialsUsed.totalCost}), 0)`,
        })
        .from(productionMaterialsUsed)
        .innerJoin(productionRuns, eq(productionMaterialsUsed.productionRunId, productionRuns.id))
        .where(
          and(
            eq(productionRuns.status, "completed"),
            gte(productionRuns.actualCompletionDate, rangeStart),
            lte(productionRuns.actualCompletionDate, rangeEnd),
          ),
        )
        .then((r) => r[0]),

      // 5. Non-payroll expenses
      db
        .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(gte(expenses.createdAt, rangeStart), lte(expenses.createdAt, rangeEnd)))
        .then((r) => r[0]),

      // 4. Payrolls in range
      db.query.payrolls.findMany({
        where: and(gte(payrolls.createdAt, rangeStart), lte(payrolls.createdAt, rangeEnd)),
        columns: { id: true },
      }),

      // 8. Active employees
      db
        .select({ count: sql<number>`count(*)` })
        .from(employees)
        .where(eq(employees.status, "active"))
        .then((r) => r[0]),
    ]);

    const totalRevenue = toFloat(revenueRow?.total);
    const invoiceCount = revenueRow?.count ?? 0;
    const activeProductionRuns = productionRow?.activeCount ?? 0;
    const completedProductionRuns = productionRow?.completedCount ?? 0;
    const totalCartonsProduced = toFloat(productionRow?.totalCartons);
    const rawStockValue = toFloat(chemicalStockRow?.value) + toFloat(packagingStockRow?.value);
    const finishedStockValue = toFloat(finishedGoodsRow?.value);
    const totalStockValue = rawStockValue + finishedStockValue;
    const materialConsumptionCost = toFloat(materialConsumptionRow?.totalMaterialCost);
    const operationalExpenses = toFloat(expensesRow?.total);
    // FIX #1: Operational Burn = non-payroll expenses + actual material consumption cost
    const totalExpenses = operationalExpenses + materialConsumptionCost;
    const totalPayrollCost = await getPayrollCostForIds(payrollsInRange.map((p) => p.id));
    const activeEmployees = empCountRow?.count ?? 0;

    // ── Chart: single GROUP BY query per source — filtered by date range ──
    // Calculate the chart window: from rangeStart to rangeEnd, grouped by month

    const chartWindowStart = rangeStart;

    const [chartRevenue, chartExpenses, chartPayrolls, chartMaterialCosts] = await Promise.all([
      // Revenue by month
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${invoices.createdAt}), 'YYYY-MM-01')`,
          total: sql<string>`coalesce(sum(${invoices.totalPrice}), 0)`,
        })
        .from(invoices)
        .where(and(gte(invoices.createdAt, chartWindowStart), lte(invoices.createdAt, rangeEnd)))
        .groupBy(sql`date_trunc('month', ${invoices.createdAt})`)
        .orderBy(sql`date_trunc('month', ${invoices.createdAt})`),

      // Expenses by month (non-payroll only — material costs added via payroll query below)
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${expenses.createdAt}), 'YYYY-MM-01')`,
          total: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(and(gte(expenses.createdAt, chartWindowStart), lte(expenses.createdAt, rangeEnd)))
        .groupBy(sql`date_trunc('month', ${expenses.createdAt})`)
        .orderBy(sql`date_trunc('month', ${expenses.createdAt})`),

      // Payslips by month (payroll cost)
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${payrolls.createdAt}), 'YYYY-MM-01')`,
          total: sql<string>`coalesce(sum(${payslips.netSalary}::numeric), 0)`,
        })
        .from(payslips)
        .innerJoin(payrolls, eq(payslips.payrollId, payrolls.id))
        .where(and(gte(payrolls.createdAt, chartWindowStart), lte(payrolls.createdAt, rangeEnd)))
        .groupBy(sql`date_trunc('month', ${payrolls.createdAt})`)
        .orderBy(sql`date_trunc('month', ${payrolls.createdAt})`),

      // Material consumption cost by month (for chart expense series)
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${productionRuns.actualCompletionDate}), 'YYYY-MM-01')`,
          total: sql<string>`coalesce(sum(${productionMaterialsUsed.totalCost}), 0)`,
        })
        .from(productionMaterialsUsed)
        .innerJoin(productionRuns, eq(productionMaterialsUsed.productionRunId, productionRuns.id))
        .where(
          and(
            eq(productionRuns.status, "completed"),
            gte(productionRuns.actualCompletionDate, chartWindowStart),
            lte(productionRuns.actualCompletionDate, rangeEnd),
          ),
        )
        .groupBy(sql`date_trunc('month', ${productionRuns.actualCompletionDate})`)
        .orderBy(sql`date_trunc('month', ${productionRuns.actualCompletionDate})`),
    ]);

    // Build lookup maps for O(1) merge
    const revenueByMonth = new Map(chartRevenue.map((r) => [r.month, toFloat(r.total)]));
    const expensesByMonth = new Map(chartExpenses.map((r) => [r.month, toFloat(r.total)]));
    const payrollByMonth = new Map(chartPayrolls.map((r) => [r.month, toFloat(r.total)]));
    const materialCostByMonth = new Map(chartMaterialCosts.map((r) => [r.month, toFloat(r.total)]));

    // Generate month keys from chartWindowStart to rangeEnd
    // Use endOfMonth to ensure we capture the full range
    const chartWindowEnd = startOfMonth(rangeEnd);
    const monthsDiff = (chartWindowEnd.getFullYear() - chartWindowStart.getFullYear()) * 12 + (chartWindowEnd.getMonth() - chartWindowStart.getMonth());
    const monthCount = Math.max(1, monthsDiff + 1);
    
    const revenueExpenseChart = Array.from({ length: monthCount }, (_, i) => {
      const mDate = new Date(chartWindowStart.getFullYear(), chartWindowStart.getMonth() + i, 1);
      const key = format(mDate, "yyyy-MM-01");
      const label = format(mDate, "01 MMM");
      const rev = revenueByMonth.get(key) ?? 0;
      const exp = (expensesByMonth.get(key) ?? 0) + (payrollByMonth.get(key) ?? 0) + (materialCostByMonth.get(key) ?? 0);
      const payroll = payrollByMonth.get(key) ?? 0;
      return { month: label, revenue: rev, expenses: exp, payroll };
    });

    // ── FIX #4: Recent activity — only 5 most recent ──────────────────────
    const recentRuns = await db.query.productionRuns.findMany({
      with: {
        recipe: { with: { product: true } },
        operator: true,
      },
      orderBy: [desc(productionRuns.updatedAt)],
      limit: 5,
    });

    const recentActivity = recentRuns.map((run) => ({
      id: run.id,
      batchId: run.batchId,
      productName: run.recipe?.product?.name ?? "Unknown Product",
      recipeName: run.recipe?.name ?? "Unknown Recipe",
      cartonsProduced: run.cartonsProduced ?? 0,
      containersProduced: run.containersProduced ?? 0,
      status: run.status,
      operatorName: (run.operator as { name?: string } | null)?.name ?? "Unassigned",
      date: run.updatedAt,
      totalProductionCost: toFloat(run.totalProductionCost),
    }));

    return {
      totalRevenue,
      invoiceCount,
      activeProductionRuns,
      completedProductionRuns,
      totalCartonsProduced,
      rawStockValue,
      finishedStockValue,
      totalStockValue,
      totalPayrollCost,
      totalExpenses,
      // Breakdown for transparency
      operationalExpenses,
      materialConsumptionCost,
      totalCost: totalPayrollCost + totalExpenses,
      netProfit: totalRevenue - totalPayrollCost - totalExpenses,
      activeEmployees,
      revenueExpenseChart,
      recentActivity,
      period: {
        startStr: format(rangeStart, "yyyy-MM-dd"),
        endStr: format(rangeEnd, "yyyy-MM-dd"),
      },
    };
  });

// ── Paginated production runs for the dedicated logs page ─────────────────────
export const getProductionRunsFn = createServerFn()
  .middleware([requireDashboardViewMiddleware])
  .inputValidator(
    z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().default(15),
      status: z.enum(["all", "scheduled", "in_progress", "completed", "cancelled"]).default("all"),
    }),
  )
  .handler(async ({ data }) => {
    const offset = (data.page - 1) * data.limit;

    const whereClause =
      data.status !== "all"
        ? eq(productionRuns.status, data.status)
        : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(productionRuns)
      .where(whereClause);

    const runs = await db.query.productionRuns.findMany({
      where: whereClause,
      with: {
        recipe: { with: { product: true } },
        operator: true,
      },
      orderBy: [desc(productionRuns.updatedAt)],
      limit: data.limit,
      offset,
    });

    return {
      data: runs,
      total,
      pageCount: Math.ceil(total / data.limit),
      page: data.page,
    };
  });

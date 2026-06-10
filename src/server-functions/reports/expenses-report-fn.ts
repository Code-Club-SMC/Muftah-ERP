import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { requireReportsViewMiddleware } from "@/lib/middlewares";
import { expenses, expenseCategories, wallets } from "@/db/schemas/finance-schema";
import { productionRuns, recipes, products, warehouses } from "@/db/schemas/inventory-schema";
import { z } from "zod";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { parseISO, isValid, endOfDay } from "date-fns";

export const getExpensesReportFn = createServerFn()
  .middleware([requireReportsViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const conditions = [];

    if (data.dateFrom) {
      const from = parseISO(data.dateFrom);
      if (isValid(from)) conditions.push(gte(expenses.expenseDate, from));
    }
    if (data.dateTo) {
      const to = parseISO(data.dateTo);
      if (isValid(to)) conditions.push(lte(expenses.expenseDate, endOfDay(to)));
    }

    // Finance expenses
    const financeRows = await db
      .select({
        expenseId: expenses.id,
        expenseDate: expenses.expenseDate,
        description: expenses.description,
        amount: expenses.amount,
        slipNumber: expenses.slipNumber,
        remarks: expenses.remarks,
        categoryName: expenseCategories.name,
        walletName: wallets.name,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(wallets, eq(expenses.walletId, wallets.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));

    const totalFinanceExpenses = financeRows.reduce((s, r) => s + Number(r.amount), 0);

    // Production costs (filter by actualStartDate with fallback to createdAt)
    const prodConditions = [];
    if (data.dateFrom) {
      const from = parseISO(data.dateFrom);
      if (isValid(from)) {
        prodConditions.push(
          gte(sql`COALESCE(${productionRuns.actualStartDate}, ${productionRuns.createdAt})`, from),
        );
      }
    }
    if (data.dateTo) {
      const to = parseISO(data.dateTo);
      if (isValid(to)) {
        prodConditions.push(
          lte(sql`COALESCE(${productionRuns.actualStartDate}, ${productionRuns.createdAt})`, endOfDay(to)),
        );
      }
    }

    const productionRows = await db
      .select({
        runId: productionRuns.id,
        batchId: productionRuns.batchId,
        actualCompletionDate: productionRuns.actualCompletionDate,
        status: productionRuns.status,
        totalChemicalCost: productionRuns.totalChemicalCost,
        totalPackagingCost: productionRuns.totalPackagingCost,
        totalProductionCost: productionRuns.totalProductionCost,
        costPerContainer: productionRuns.costPerContainer,
        actualCostPerPack: productionRuns.actualCostPerPack,
        actualCostPerCarton: productionRuns.actualCostPerCarton,
        plannedCartonsProduced: productionRuns.plannedCartonsProduced,
        actualCartonsProduced: productionRuns.actualCartonsProduced,
        actualPacksProduced: productionRuns.actualPacksProduced,
        yieldVarianceCartons: productionRuns.yieldVarianceCartons,
        containersProduced: productionRuns.containersProduced,
        productName: products.name,
        recipeName: recipes.name,
        warehouseName: warehouses.name,
      })
      .from(productionRuns)
      .innerJoin(recipes, eq(productionRuns.recipeId, recipes.id))
      .innerJoin(products, eq(recipes.productId, products.id))
      .innerJoin(warehouses, eq(productionRuns.warehouseId, warehouses.id))
      .where(and(...prodConditions))
      .orderBy(desc(productionRuns.actualCompletionDate));

    const totalProductionCosts = productionRows.reduce(
      (s, r) => s + Number(r.totalProductionCost),
      0,
    );

    return {
      financeExpenses: financeRows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
      productionCosts: productionRows.map((r) => ({
        ...r,
        totalChemicalCost: Number(r.totalChemicalCost),
        totalPackagingCost: Number(r.totalPackagingCost),
        totalProductionCost: Number(r.totalProductionCost),
        costPerContainer: Number(r.costPerContainer),
        actualCostPerPack: Number(r.actualCostPerPack || "0"),
        actualCostPerCarton: Number(r.actualCostPerCarton || "0"),
        plannedCartonsProduced: r.plannedCartonsProduced ?? 0,
        actualCartonsProduced: r.actualCartonsProduced ?? 0,
        actualPacksProduced: r.actualPacksProduced ?? 0,
        yieldVarianceCartons: r.yieldVarianceCartons ?? ((r.plannedCartonsProduced ?? 0) - (r.actualCartonsProduced ?? 0)),
      })),
      summary: {
        totalFinanceExpenses,
        totalProductionCosts,
        grandTotal: totalFinanceExpenses + totalProductionCosts,
        financeCount: financeRows.length,
        productionCount: productionRows.length,
      },
    };
  });

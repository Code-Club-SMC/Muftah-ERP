import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { requireManufacturingViewMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { products, recipes } from "@/db/schemas/inventory-schema";
import { invoices, invoiceItems, customers } from "@/db/schemas/sales-schema";

export type ProductProfitLossResult = {
  product: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  recipes: Array<{
    id: string;
    name: string;
    estimatedCostPerContainer: string | null;
    containersPerCarton: number | null;
    fillAmount: string | null;
    fillUnit: string | null;
    revenue: number;
    cogs: number;
    profit: number;
    invoiceCount: number;
    cartonsSold: number;
    unitsSold: number;
    marginPercent: number;
    invoices: Array<{
      invoiceId: string;
      date: Date;
      slipNumber: string | null;
      customerName: string | null;
      status: string | null;
      revenue: number;
      cogs: number;
      profit: number;
    }>;
  }>;
  globalSummary: {
    totalRevenue: number;
    totalCogs: number;
    netProfit: number;
    overallMargin: number;
    totalInvoices: number;
    totalCartons: number;
    totalUnits: number;
  };
  dateFrom: string;
  dateTo: string;
};

const getProductProfitLossParams = z.object({
  productId: z.string(),
  dateFrom: z.string(), // ISO date string YYYY-MM-DD
  dateTo: z.string(),   // ISO date string YYYY-MM-DD
});

export const getProductProfitLossFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator((input: any) => getProductProfitLossParams.parse(input))
  .handler(async ({ data }) => {
    const { productId, dateFrom, dateTo } = data;

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    // Adjust to end of day for inclusive upper bound
    toDate.setHours(23, 59, 59, 999);

    // 1. Product info
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    if (!product) throw new Error("Product not found");

    // 2. All recipes for this product
    const productRecipes = await db.query.recipes.findMany({
      where: eq(recipes.productId, productId),
      columns: {
        id: true,
        name: true,
        estimatedCostPerContainer: true,
        containersPerCarton: true,
        fillAmount: true,
        fillUnit: true,
      },
    });

    const recipeIds = productRecipes.map((r) => r.id);

    if (recipeIds.length === 0) {
      return {
        product,
        recipes: [],
        globalSummary: {
          totalRevenue: 0,
          totalCogs: 0,
          netProfit: 0,
          overallMargin: 0,
          totalInvoices: 0,
          totalCartons: 0,
          totalUnits: 0,
        },
        dateFrom,
        dateTo,
      };
    }

    // 3. Per-recipe aggregates
    const recipeAggregates = await db
      .select({
        recipeId: invoiceItems.recipeId,
        revenue: sql<number>`COALESCE(SUM(${invoiceItems.amount}), 0)`,
        cogs: sql<number>`COALESCE(SUM(${invoiceItems.costOfGoodsSold}), 0)`,
        invoiceCount: sql<number>`COUNT(DISTINCT ${invoiceItems.invoiceId})`,
        cartonsSold: sql<number>`COALESCE(SUM(${invoiceItems.numberOfCartons}), 0)`,
        unitsSold: sql<number>`COALESCE(SUM(${invoiceItems.quantity}), 0)`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(
        and(
          inArray(invoices.status, ["paid", "partially_paid"]),
          inArray(invoiceItems.recipeId, recipeIds),
          gte(invoices.date, fromDate),
          lte(invoices.date, toDate),
        ),
      )
      .groupBy(invoiceItems.recipeId);

    // Build a map for fast lookup
    const aggregateMap = new Map(
      recipeAggregates.map((row) => [
        row.recipeId,
        {
          revenue: Number(row.revenue),
          cogs: Number(row.cogs),
          profit: Number(row.revenue) - Number(row.cogs),
          invoiceCount: Number(row.invoiceCount),
          cartonsSold: Number(row.cartonsSold),
          unitsSold: Number(row.unitsSold),
        },
      ]),
    );

    // 4. Per-recipe invoice details
    const recipeInvoiceDetails: Record<
      string,
      {
        invoiceId: string;
        date: Date;
        slipNumber: string | null;
        customerName: string;
        status: string;
        revenue: number;
        cogs: number;
        profit: number;
      }[]
    > = {};

    for (const recipeId of recipeIds) {
      const details = await db
        .select({
          invoiceId: invoices.id,
          date: invoices.date,
          slipNumber: invoices.slipNumber,
          customerName: customers.name,
          status: invoices.status,
          revenue: sql<number>`COALESCE(SUM(${invoiceItems.amount}), 0)`,
          cogs: sql<number>`COALESCE(SUM(${invoiceItems.costOfGoodsSold}), 0)`,
        })
        .from(invoices)
        .innerJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
        .innerJoin(customers, eq(invoices.customerId, customers.id))
        .where(
          and(
            eq(invoiceItems.recipeId, recipeId),
            inArray(invoices.status, ["paid", "partially_paid"]),
            gte(invoices.date, fromDate),
            lte(invoices.date, toDate),
          ),
        )
        .groupBy(
          invoices.id,
          invoices.date,
          invoices.slipNumber,
          customers.name,
          invoices.status,
        )
        .orderBy(sql`${invoices.date} DESC`);

      recipeInvoiceDetails[recipeId] = details.map((row) => ({
        invoiceId: row.invoiceId,
        date: row.date,
        slipNumber: row.slipNumber,
        customerName: row.customerName,
        status: row.status,
        revenue: Number(row.revenue),
        cogs: Number(row.cogs),
        profit: Number(row.revenue) - Number(row.cogs),
      }));
    }

    // 5. Compose recipe results
    const recipeResults = productRecipes.map((recipe) => {
      const agg = aggregateMap.get(recipe.id) || {
        revenue: 0,
        cogs: 0,
        profit: 0,
        invoiceCount: 0,
        cartonsSold: 0,
        unitsSold: 0,
      };
      return {
        ...recipe,
        ...agg,
        marginPercent: agg.revenue > 0 ? ((agg.profit / agg.revenue) * 100) : 0,
        invoices: recipeInvoiceDetails[recipe.id] || [],
      };
    });

    // 6. Global summary
    const totalRevenue = recipeResults.reduce((s, r) => s + r.revenue, 0);
    const totalCogs = recipeResults.reduce((s, r) => s + r.cogs, 0);
    const netProfit = totalRevenue - totalCogs;
    const overallMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const totalInvoices = recipeResults.reduce((s, r) => s + r.invoiceCount, 0);
    const totalCartons = recipeResults.reduce((s, r) => s + r.cartonsSold, 0);
    const totalUnits = recipeResults.reduce((s, r) => s + r.unitsSold, 0);

    return {
      product,
      recipes: recipeResults,
      globalSummary: {
        totalRevenue,
        totalCogs,
        netProfit,
        overallMargin,
        totalInvoices,
        totalCartons,
        totalUnits,
      },
      dateFrom: fromDate.toISOString(),
      dateTo: toDate.toISOString(),
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { requireManufacturingViewMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";
import { products, recipes, finishedGoodsStock, productionRuns, warehouses } from "@/db/schemas/inventory-schema";
import { invoices, invoiceItems } from "@/db/schemas/sales-schema";
import {
  priceChangeLog,
  orders,
  orderItems,
  orderBookers,
} from "@/db/schemas/sales-erp-schema";
import { subMonths, startOfMonth } from "date-fns";

const getProductDetailParams = z.object({ id: z.string() });

export const getProductDetailFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator((input: any) => getProductDetailParams.parse(input))
  .handler(async ({ data }) => {
    const productId = data.id;

    // 1. Product info
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    if (!product) throw new Error("Product not found");

    // 2. All recipes with full nested data
    const productRecipes = await db.query.recipes.findMany({
      where: eq(recipes.productId, productId),
      with: {
        containerPackaging: true,
        cartonPackaging: true,
        ingredients: { with: { chemical: true } },
        packaging: { with: { packagingMaterial: true } },
      },
    });

    const recipeIds = productRecipes.map((r) => r.id);
    const twelveMonthsAgo = subMonths(startOfMonth(new Date()), 11);

    // 3-10. Parallelize all independent product-scoped queries
    const [
      monthlySalesResult,
      productionHistory,
      stockResult,
      priceChanges,
      productOrders,
    ] = await Promise.all([
      // 3. Monthly sales (last 12 months)
      recipeIds.length > 0
        ? db
            .select({
              month: sql<string>`TO_CHAR(${invoices.date}, 'YYYY-MM')`,
              cartons: sql<number>`COALESCE(SUM(${invoiceItems.numberOfCartons}), 0)`,
              units: sql<number>`COALESCE(SUM(${invoiceItems.quantity}), 0)`,
              revenue: sql<number>`COALESCE(SUM(${invoiceItems.amount}), 0)`,
            })
            .from(invoiceItems)
            .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
            .where(
              and(
                inArray(invoices.status, ["saved", "paid", "partially_paid"]),
                inArray(invoiceItems.recipeId, recipeIds),
                gte(invoices.date, twelveMonthsAgo),
              ),
            )
            .groupBy(sql`TO_CHAR(${invoices.date}, 'YYYY-MM')`)
            .orderBy(sql`TO_CHAR(${invoices.date}, 'YYYY-MM')`)
        : Promise.resolve([]),

      // 4. Production history
      recipeIds.length > 0
        ? db.query.productionRuns.findMany({
            where: inArray(productionRuns.recipeId, recipeIds),
            orderBy: [desc(productionRuns.createdAt)],
            with: {
              recipe: { columns: { name: true, batchSize: true, batchUnit: true } },
              warehouse: { columns: { name: true } },
              operator: { columns: { name: true } },
            },
            limit: 50,
          })
        : Promise.resolve([]),

      // 5. Finished goods stock per warehouse
      recipeIds.length > 0
        ? db
            .select({
              warehouseName: warehouses.name,
              cartons: sql<number>`COALESCE(SUM(${finishedGoodsStock.quantityCartons}), 0)`,
              containers: sql<number>`COALESCE(SUM(${finishedGoodsStock.quantityContainers}), 0)`,
            })
            .from(finishedGoodsStock)
            .innerJoin(warehouses, eq(finishedGoodsStock.warehouseId, warehouses.id))
            .where(inArray(finishedGoodsStock.recipeId, recipeIds))
            .groupBy(warehouses.id, warehouses.name)
        : Promise.resolve([]),

      // 6. Price change log
      db.query.priceChangeLog.findMany({
        where: eq(priceChangeLog.productId, productId),
        orderBy: [desc(priceChangeLog.createdAt)],
        with: {
          changedBy: { columns: { name: true } },
          customer: { columns: { name: true } },
        },
        limit: 50,
      }),

      // 7. Orders containing this product
      db
        .select({
          orderId: orders.id,
          billNumber: orders.billNumber,
          shopkeeperName: orders.shopkeeperName,
          status: orders.status,
          createdAt: orders.createdAt,
          quantity: orderItems.quantity,
          rate: orderItems.rate,
          amount: orderItems.amount,
          unitType: orderItems.unitType,
          orderBookerName: orderBookers.name,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(orderBookers, eq(orders.orderBookerId, orderBookers.id))
        .where(eq(orderItems.productId, productId))
        .orderBy(desc(orders.createdAt))
        .limit(50),

    ]);

    const monthlySales = monthlySalesResult.map((row) => ({
      month: row.month,
      cartons: Number(row.cartons),
      units: Number(row.units),
      revenue: Number(row.revenue),
    }));

    const stockByWarehouse = stockResult.map((s: any) => ({
      warehouseName: s.warehouseName,
      cartons: Number(s.cartons),
      containers: Number(s.containers),
    }));

    return {
      product,
      recipes: productRecipes,
      monthlySales,
      productionHistory,
      stockByWarehouse,
      priceChanges,
      orders: productOrders,
      promos: [],
      discountRules: [],
    };
  });

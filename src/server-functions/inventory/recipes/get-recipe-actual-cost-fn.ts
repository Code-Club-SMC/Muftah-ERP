import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { finishedGoodsStock, recipes, warehouses } from "@/db/schemas/inventory-schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireSalesViewMiddleware } from "@/lib/middlewares";

export const getRecipeActualCostFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      recipeId: z.string().min(1),
      warehouseId: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    // 1. Try to find stock with WAC
    let stock = null;
    if (data.warehouseId) {
      stock = await db.query.finishedGoodsStock.findFirst({
        where: and(
          eq(finishedGoodsStock.recipeId, data.recipeId),
          eq(finishedGoodsStock.warehouseId, data.warehouseId),
        ),
      });
    }

    // If no specific warehouse, try any warehouse with stock
    if (!stock) {
      stock = await db.query.finishedGoodsStock.findFirst({
        where: eq(finishedGoodsStock.recipeId, data.recipeId),
      });
    }

    if (stock && Number(stock.weightedAverageCostPerPack) > 0) {
      return {
        costPerPack: Number(stock.weightedAverageCostPerPack),
        costPerCarton: Number(stock.weightedAverageCostPerCarton),
        stockQuantityCartons: stock.quantityCartons,
        stockQuantityContainers: stock.quantityContainers,
        source: "wac" as const,
      };
    }

    // 2. Fallback to estimated cost from recipe
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, data.recipeId),
      columns: {
        estimatedCostPerContainer: true,
        containersPerCarton: true,
      },
    });

    const costPerPack = Number(recipe?.estimatedCostPerContainer || 0);
    const containersPerCarton = recipe?.containersPerCarton || 1;

    return {
      costPerPack,
      costPerCarton: costPerPack * containersPerCarton,
      stockQuantityCartons: stock?.quantityCartons ?? 0,
      stockQuantityContainers: stock?.quantityContainers ?? 0,
      source: "estimated" as const,
    };
  });

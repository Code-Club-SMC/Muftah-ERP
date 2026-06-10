import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { requireManufacturingRunManageMiddleware } from "@/lib/middlewares";
import {
  productionRuns,
  recipes,
  packagingMaterials,
} from "@/db/schemas/inventory-schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const createProductionRunSchema = z.object({
  recipeId: z.string().min(1, "Recipe is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  batchesProduced: z.number().int().min(1).default(1),
  scheduledStartDate: z.date().optional(),
  notes: z.string().optional(),
  operatorId: z.string().min(1, "Operator is required"),
});

export const createProductionRunFn = createServerFn()
  .middleware([requireManufacturingRunManageMiddleware])
  .inputValidator(createProductionRunSchema)
  .handler(async ({ data, context }) => {
    return await db.transaction(async (tx) => {
      // 1. Get the recipe with all details
      const [recipe] = await tx
        .select()
        .from(recipes)
        .where(eq(recipes.id, data.recipeId));

      if (!recipe) {
        throw new Error("Recipe not found");
      }

      // 2. Get packaging materials
      const [containerPkg] = await tx
        .select()
        .from(packagingMaterials)
        .where(eq(packagingMaterials.id, recipe.containerPackagingId));

      if (!containerPkg) {
        throw new Error("Container packaging not found");
      }

      // 3. Calculate production output
      let totalContainers = 0;

      if (recipe.targetUnitsPerBatch && recipe.targetUnitsPerBatch > 0) {
        const containersPerBatch = recipe.targetUnitsPerBatch;
        totalContainers = containersPerBatch * data.batchesProduced;
      } else {
        // Fallback calculation if targetUnitsPerBatch is missing
        const batchSize = parseFloat(recipe.batchSize.toString());

        // Calculate containers produced from batch
        const containerSize = `${containerPkg.capacity}${containerPkg.capacityUnit || ""}`;
        const sizeMatch = containerSize.match(/(\d+\.?\d*)/);
        const sizeValue = sizeMatch ? parseFloat(sizeMatch[1]) : 1;
        const sizeUnit = containerSize
          .replace(sizeValue.toString(), "")
          .toLowerCase();

        let containerSizeInBatchUnit = sizeValue;
        if (recipe.batchUnit === "liters") {
          if (sizeUnit.includes("ml")) {
            containerSizeInBatchUnit = sizeValue / 1000;
          }
        } else if (recipe.batchUnit === "kg") {
          if (sizeUnit.includes("g") && !sizeUnit.includes("kg")) {
            containerSizeInBatchUnit = sizeValue / 1000;
          }
        }

        const containersPerBatch = Math.floor(
          batchSize / containerSizeInBatchUnit,
        );
        totalContainers = containersPerBatch * data.batchesProduced;
      }

      // Calculate cartons
      let totalCartons = 0;
      let looseContainers = 0;

      if (recipe.containersPerCarton && recipe.containersPerCarton > 0) {
        totalCartons = Math.ceil(totalContainers / recipe.containersPerCarton);
        looseContainers = totalContainers % recipe.containersPerCarton;
      } else {
        looseContainers = totalContainers;
      }

      // 5. Generate batch ID
      const [lastRun] = await tx
        .select({ batchId: productionRuns.batchId })
        .from(productionRuns)
        .orderBy(desc(productionRuns.createdAt))
        .limit(1);

      let batchId = "AB1000";

      if (lastRun && lastRun.batchId) {
        const match = lastRun.batchId.match(/^([A-Za-z]+)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const number = parseInt(match[2], 10);
          batchId = `${prefix}${number + 1}`;
        }
      }

      // 6. Create production run
      const [productionRun] = await tx
        .insert(productionRuns)
        .values({
          batchId,
          recipeId: data.recipeId,
          warehouseId: data.warehouseId,
          operatorId: data.operatorId,
          initiatorId: context.session.user.id,
          batchesProduced: data.batchesProduced,
          cartonsProduced: totalCartons,
          containersProduced: totalContainers,
          looseUnitsProduced: looseContainers,
          plannedCartonsProduced: totalCartons,
          status: "scheduled",
          scheduledStartDate: data.scheduledStartDate || new Date(),
          notes: data.notes,
        })
        .returning();

      return productionRun;
    });
  });

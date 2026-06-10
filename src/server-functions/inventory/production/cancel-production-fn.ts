import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import {
  productionRuns,
  materialStock,
  inventoryAuditLog,
  recipes,
  recipeIngredients,
  chemicals,
  warehouses,
  finishedGoodsStock,
} from "@/db/schemas/inventory-schema";
import { requireManufacturingRunManageMiddleware } from "@/lib/middlewares";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  calculateTotalUnits,
  calculateTotalInventoryValue,
} from "@/lib/wac";

const cancelProductionSchema = z.object({
  productionRunId: z.string().min(1, "Production run ID is required"),
  reason: z.string().optional(),
});

export const cancelProductionFn = createServerFn()
  .middleware([requireManufacturingRunManageMiddleware])
  .inputValidator(cancelProductionSchema)
  .handler(async ({ data, context }) => {
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(productionRuns)
        .where(eq(productionRuns.id, data.productionRunId));

      if (!run) {
        throw new Error("Production run not found");
      }

      if (run.status === "completed" || run.status === "cancelled") {
        throw new Error("Cannot cancel a completed or already cancelled run");
      }

      // Get factory floor
      const factoryFloor = await tx.query.warehouses.findFirst({
        where: eq(warehouses.type, "factory_floor"),
      });

      if (!factoryFloor) throw new Error("Factory floor not found");

      // Get recipe for chemical restoration
      const [recipe] = await tx
        .select()
        .from(recipes)
        .where(eq(recipes.id, run.recipeId));

      if (!recipe) throw new Error("Recipe not found");

      // === RESTORE CHEMICALS ===
      // Chemicals were deducted upfront at start. We need to calculate unused portion and return it.
      // The total chemicals deducted = batchesProduced * quantityPerBatch (per ingredient)
      // The total units that SHOULD have consumed chemicals = completedUnits
      // The target was containersProduced units from batchesProduced batches
      // So the proportion of unused chemicals = (target - completedUnits) / target
      const completedUnits = run.completedUnits || 0;
      const target = run.containersProduced;

      if (completedUnits < target && target > 0) {
        // There are unused chemicals to return
        const unusedRatio = (target - completedUnits) / target;

        const ingredients = await tx
          .select({
            ingredient: recipeIngredients,
            material: chemicals,
          })
          .from(recipeIngredients)
          .leftJoin(chemicals, eq(recipeIngredients.chemicalId, chemicals.id))
          .where(eq(recipeIngredients.recipeId, recipe.id));

        for (const { ingredient, material } of ingredients) {
          if (!material) continue;

          const totalDeducted =
            parseFloat(ingredient.quantityPerBatch) * run.batchesProduced;
          const toReturn = totalDeducted * unusedRatio;

          if (toReturn > 0) {
            // Return chemical to factory floor stock
            await tx
              .update(materialStock)
              .set({
                quantity: sql`quantity + ${toReturn}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(materialStock.warehouseId, factoryFloor.id),
                  eq(materialStock.chemicalId, material.id),
                ),
              );

            // Audit log
            await tx.insert(inventoryAuditLog).values({
              warehouseId: factoryFloor.id,
              materialType: "chemical",
              materialId: material.id,
              type: "credit",
              amount: toReturn.toString(),
              reason: `[CANCELLED] Production run ${run.batchId} cancelled. ${toReturn.toFixed(2)} ${material.unit || "kg"} of ${material.name} returned to stock.`,
              performedById: context.session.user.id,
              referenceId: run.id,
            });
          }
        }
      }

      // === REVERSE FINISHED GOODS (if any were produced) ===
      // Remove any finished goods that were added during log progress
      if (completedUnits > 0) {
        const existingStock = await tx.query.finishedGoodsStock.findFirst({
          where: and(
            eq(finishedGoodsStock.warehouseId, factoryFloor.id),
            eq(finishedGoodsStock.recipeId, recipe.id),
          ),
        });

        if (existingStock) {
          // Remove the units that were added during this run
          await tx
            .update(finishedGoodsStock)
            .set({
              quantityContainers: sql`GREATEST(0, ${finishedGoodsStock.quantityContainers} - ${completedUnits})`,
              updatedAt: new Date(),
            })
            .where(eq(finishedGoodsStock.id, existingStock.id));

          // Recalculate total inventory value after quantity change.
          // WAC per unit stays the same — only the total value changes.
          const containersPerCarton = recipe.containersPerCarton || 0;
          const [updatedStock] = await tx
            .select()
            .from(finishedGoodsStock)
            .where(eq(finishedGoodsStock.id, existingStock.id));

          if (updatedStock) {
            const remainingTotalUnits = calculateTotalUnits(
              updatedStock.quantityCartons,
              updatedStock.quantityContainers,
              containersPerCarton,
            );
            const currentWAC = parseFloat(
              updatedStock.weightedAverageCostPerPack?.toString() || "0",
            );
            const newValue = calculateTotalInventoryValue(remainingTotalUnits, currentWAC);

            await tx
              .update(finishedGoodsStock)
              .set({
                totalInventoryValue: newValue.toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(finishedGoodsStock.id, existingStock.id));
          }
        }

        // Audit log for finished goods reversal
        await tx.insert(inventoryAuditLog).values({
          warehouseId: factoryFloor.id,
          materialType: "finished",
          materialId: recipe.id,
          type: "debit",
          amount: completedUnits.toString(),
          reason: `[CANCELLED] Production run ${run.batchId} cancelled. ${completedUnits} finished units reversed from stock.`,
          performedById: context.session.user.id,
          referenceId: run.id,
        });
      }

      // Update production run status
      await tx
        .update(productionRuns)
        .set({
          status: "cancelled",
          actualCompletionDate: new Date(),
          notes: data.reason
            ? run.notes
              ? `${run.notes}\n\n[FAILED]: ${data.reason}`
              : `[FAILED]: ${data.reason}`
            : run.notes,
        })
        .where(eq(productionRuns.id, data.productionRunId));

      return {
        success: true,
        chemicalsReturned: completedUnits < target,
        finishedGoodsReversed: completedUnits > 0,
      };
    });
  });

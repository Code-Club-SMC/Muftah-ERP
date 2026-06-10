import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  inventoryAuditLog,
  materialStock,
  stockTransfers,
  warehouses,
} from "@/db";
import { finishedGoodsStock, recipes } from "@/db/schemas/inventory-schema";
import { cartons } from "@/db/schemas/manufacturing-schema";
import { requireInventoryManageMiddleware } from "@/lib/middlewares";
import { transferStockSchema } from "@/lib/validators/validators";
import {
  calculateTransferDestinationWAC,
  calculateTotalUnits,
  calculateTotalInventoryValue,
  calculateWACPerCarton,
} from "@/lib/wac";

export const transferStockFn = createServerFn()
  .middleware([requireInventoryManageMiddleware])
  .inputValidator(transferStockSchema)
  .handler(async ({ data, context }) => {
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new Error("Source and destination warehouses must be different");
    }

    return await db.transaction(async (tx) => {
      // Validate Destination Warehouse Type
      const toWarehouse = await tx.query.warehouses.findFirst({
        where: eq(warehouses.id, data.toWarehouseId),
      });

      if (!toWarehouse) throw new Error("Destination warehouse not found");

      if (
        data.materialType === "chemical" ||
        data.materialType === "packaging"
      ) {
        if (toWarehouse.type !== "factory_floor") {
          throw new Error(
            "Raw materials (chemicals/packaging) can only be transferred to a Factory Floor facility.",
          );
        }
      }

      const qty = parseFloat(data.quantity) || 0;
      const loose = parseFloat(data.looseUnits || "0") || 0;

      if (data.materialType === "finished") {
        // ── Finished goods: move actual carton records ─────────────────────
        const transferableStatuses = ["PARTIAL", "COMPLETE", "SEALED"] as const;

        // Count actual transferable cartons in source warehouse
        const [sourceCartonCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(cartons)
          .where(
            and(
              eq(cartons.warehouseId, data.fromWarehouseId),
              eq(cartons.recipeId, data.materialId),
              inArray(cartons.status, transferableStatuses),
            ),
          );

        const availableCartons = sourceCartonCount?.count ?? 0;
        const requestedCartons = Math.round(qty);
        const requestedLoose = Math.round(loose);

        if (requestedCartons > availableCartons) {
          throw new Error(
            `Insufficient cartons. Available: ${availableCartons} cartons.`,
          );
        }

        // Fetch cartons to move (complete first, then partial, then sealed)
        const cartonsToMove = await tx.query.cartons.findMany({
          where: and(
            eq(cartons.warehouseId, data.fromWarehouseId),
            eq(cartons.recipeId, data.materialId),
            inArray(cartons.status, transferableStatuses),
          ),
          orderBy: (c, { sql }) => [
            sql`case ${c.status}
              when 'COMPLETE' then 1
              when 'SEALED' then 2
              when 'PARTIAL' then 3
            end`,
          ],
          limit: requestedCartons,
        });

        // Move selected cartons to destination warehouse
        if (cartonsToMove.length > 0) {
          const cartonIds = cartonsToMove.map((c) => c.id);
          await tx
            .update(cartons)
            .set({ warehouseId: data.toWarehouseId, updatedAt: new Date() })
            .where(inArray(cartons.id, cartonIds));
        }

        // Handle loose units (quantityContainers)
        const sourceStock = await tx.query.finishedGoodsStock.findFirst({
          where: and(
            eq(finishedGoodsStock.warehouseId, data.fromWarehouseId),
            eq(finishedGoodsStock.recipeId, data.materialId),
          ),
        });

        if (!sourceStock) {
          throw new Error("Source stock not found");
        }

        if (sourceStock.quantityContainers < requestedLoose) {
          throw new Error(
            `Insufficient loose units. Available: ${sourceStock.quantityContainers} units.`,
          );
        }

        await tx
          .update(finishedGoodsStock)
          .set({
            quantityContainers: sourceStock.quantityContainers - requestedLoose,
            updatedAt: new Date(),
          })
          .where(eq(finishedGoodsStock.id, sourceStock.id));

        // Recompute quantityCartons for source warehouse
        const [sourceCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(cartons)
          .where(
            and(
              eq(cartons.warehouseId, data.fromWarehouseId),
              eq(cartons.recipeId, data.materialId),
              inArray(cartons.status, ["PARTIAL", "COMPLETE", "SEALED"]),
            ),
          );

        await tx
          .update(finishedGoodsStock)
          .set({
            quantityCartons: sourceCount?.count ?? 0,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(finishedGoodsStock.warehouseId, data.fromWarehouseId),
              eq(finishedGoodsStock.recipeId, data.materialId),
            ),
          );

        // Add to destination
        const destStock = await tx.query.finishedGoodsStock.findFirst({
          where: and(
            eq(finishedGoodsStock.warehouseId, data.toWarehouseId),
            eq(finishedGoodsStock.recipeId, data.materialId),
          ),
        });

        if (destStock) {
          await tx
            .update(finishedGoodsStock)
            .set({
              quantityContainers: destStock.quantityContainers + requestedLoose,
              updatedAt: new Date(),
            })
            .where(eq(finishedGoodsStock.id, destStock.id));
        } else {
          await tx.insert(finishedGoodsStock).values({
            warehouseId: data.toWarehouseId,
            recipeId: data.materialId,
            quantityCartons: 0,
            quantityContainers: requestedLoose,
          });
        }

        // Recompute quantityCartons for destination warehouse
        const [destCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(cartons)
          .where(
            and(
              eq(cartons.warehouseId, data.toWarehouseId),
              eq(cartons.recipeId, data.materialId),
              inArray(cartons.status, ["PARTIAL", "COMPLETE", "SEALED"]),
            ),
          );

        await tx
          .update(finishedGoodsStock)
          .set({
            quantityCartons: destCount?.count ?? 0,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(finishedGoodsStock.warehouseId, data.toWarehouseId),
              eq(finishedGoodsStock.recipeId, data.materialId),
            ),
          );

        // ── WAC blending at destination and value update at source ──
        // Read source WAC before the transfer quantities changed
        const sourceWAC = parseFloat(sourceStock.weightedAverageCostPerPack?.toString() || "0");
        // Total units transferred (cartons × packs-per-carton + loose units)
        const [recipeRow] = await tx
          .select({ containersPerCarton: recipes.containersPerCarton })
          .from(recipes)
          .where(eq(recipes.id, data.materialId));
        const transferContainersPerCarton = recipeRow?.containersPerCarton || 0;
        const transferredTotalUnits =
          (requestedCartons || 0) * transferContainersPerCarton + requestedLoose;

        // ── Source: recalculate total inventory value (WAC per unit unchanged, only quantity changed) ──
        // Re-fetch source stock after qty changes
        const [sourceAfter] = await tx
          .select()
          .from(finishedGoodsStock)
          .where(
            and(
              eq(finishedGoodsStock.warehouseId, data.fromWarehouseId),
              eq(finishedGoodsStock.recipeId, data.materialId),
            ),
          );

        if (sourceAfter) {
          const sourceTotalUnits = calculateTotalUnits(
            sourceAfter.quantityCartons,
            sourceAfter.quantityContainers,
            transferContainersPerCarton,
          );
          const sourceNewValue = calculateTotalInventoryValue(sourceTotalUnits, sourceWAC);

          await tx
            .update(finishedGoodsStock)
            .set({
              totalInventoryValue: sourceNewValue.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(finishedGoodsStock.id, sourceAfter.id));
        }

        // ── Destination: blend WAC ──
        const [destAfter] = await tx
          .select()
          .from(finishedGoodsStock)
          .where(
            and(
              eq(finishedGoodsStock.warehouseId, data.toWarehouseId),
              eq(finishedGoodsStock.recipeId, data.materialId),
            ),
          );

        if (destAfter && transferredTotalUnits > 0) {
          const destTotalUnits = calculateTotalUnits(
            destAfter.quantityCartons,
            destAfter.quantityContainers,
            transferContainersPerCarton,
          );
          const destCurrentWAC = parseFloat(
            destAfter.weightedAverageCostPerPack?.toString() || "0",
          );

          const newDestWAC = calculateTransferDestinationWAC(
            destTotalUnits - transferredTotalUnits, // units that were at destination before transfer
            destCurrentWAC,
            transferredTotalUnits,
            sourceWAC,
          );

          const newDestWACPerCarton = calculateWACPerCarton(newDestWAC, transferContainersPerCarton);
          const destNewTotalUnits = calculateTotalUnits(
            destAfter.quantityCartons,
            destAfter.quantityContainers,
            transferContainersPerCarton,
          );
          const destNewValue = calculateTotalInventoryValue(destNewTotalUnits, newDestWAC);

          await tx
            .update(finishedGoodsStock)
            .set({
              weightedAverageCostPerPack: newDestWAC.toFixed(4),
              weightedAverageCostPerCarton: newDestWACPerCarton.toFixed(4),
              totalInventoryValue: destNewValue.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(finishedGoodsStock.id, destAfter.id));
        }
      } else {
        // Handle raw/packaging material transfer
        const sourceStock = await tx.query.materialStock.findFirst({
          where: and(
            eq(materialStock.warehouseId, data.fromWarehouseId),
            data.materialType === "chemical"
              ? eq(materialStock.chemicalId, data.materialId)
              : eq(materialStock.packagingMaterialId, data.materialId),
          ),
        });

        if (!sourceStock || parseFloat(sourceStock.quantity) < qty) {
          throw new Error("Insufficient stock for transfer");
        }

        // Deduct from source
        await tx
          .update(materialStock)
          .set({
            quantity: (parseFloat(sourceStock.quantity) - qty).toString(),
            updatedAt: new Date(),
          })
          .where(eq(materialStock.id, sourceStock.id));

        // Add to destination
        const destStock = await tx.query.materialStock.findFirst({
          where: and(
            eq(materialStock.warehouseId, data.toWarehouseId),
            data.materialType === "chemical"
              ? eq(materialStock.chemicalId, data.materialId)
              : eq(materialStock.packagingMaterialId, data.materialId),
          ),
        });

        if (destStock) {
          await tx
            .update(materialStock)
            .set({
              quantity: (parseFloat(destStock.quantity) + qty).toString(),
              updatedAt: new Date(),
            })
            .where(eq(materialStock.id, destStock.id));
        } else {
          await tx.insert(materialStock).values({
            warehouseId: data.toWarehouseId,
            [data.materialType === "chemical"
              ? "chemicalId"
              : "packagingMaterialId"]: data.materialId,
            quantity: data.quantity,
          });
        }
      }

      // Record transfer
      const noteSuffix = loose > 0 ? ` (+ ${loose} loose units)` : "";
      const transferNotes = (data.notes || "") + noteSuffix;

      const [transfer] = await tx
        .insert(stockTransfers)
        .values({
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
          materialType: data.materialType,
          materialId: data.materialId,
          quantity: data.quantity, // Records Cartons (or main qty)
          performedById: context.session.user.id,
          notes: transferNotes.trim(),
          status: "completed",
        })
        .returning();

      // Audit logs
      await tx.insert(inventoryAuditLog).values([
        {
          warehouseId: data.fromWarehouseId,
          materialType: data.materialType,
          materialId: data.materialId,
          type: "debit",
          amount: data.quantity,
          reason: "Transfer Out" + noteSuffix,
          performedById: context.session.user.id,
          referenceId: transfer.id,
        },
        {
          warehouseId: data.toWarehouseId,
          materialType: data.materialType,
          materialId: data.materialId,
          type: "credit",
          amount: data.quantity,
          reason: "Transfer In" + noteSuffix,
          performedById: context.session.user.id,
          referenceId: transfer.id,
        },
      ]);

      return transfer;
    });
  });

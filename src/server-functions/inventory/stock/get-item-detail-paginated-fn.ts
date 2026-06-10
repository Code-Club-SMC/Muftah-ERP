import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  chemicals,
  packagingMaterials,
  recipes,
  stockTransfers,
} from "@/db";
import { requireInventoryViewMiddleware } from "@/lib/middlewares";

export const getItemDetailPaginatedFn = createServerFn()
  .middleware([requireInventoryViewMiddleware])
  .inputValidator(
    z.object({
      itemType: z.enum(["chemical", "packaging", "finished"]),
      itemId: z.string(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(50).default(20),
    }),
  )
  .handler(async ({ data }) => {
    const offset = (data.page - 1) * data.limit;

    // --- Fetch item metadata based on type ---
    let item: Record<string, unknown> = {};

    if (data.itemType === "chemical") {
      const result = await db.query.chemicals.findFirst({
        where: eq(chemicals.id, data.itemId),
        with: {
          stock: {
            with: {
              warehouse: {
                columns: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!result) throw new Error("Chemical not found");

      // Aggregate stock across all warehouses
      const totalStock = result.stock.reduce(
        (sum, s) => sum + parseFloat(s.quantity),
        0,
      );

      item = {
        id: result.id,
        name: result.name,
        unit: result.unit,
        costPerUnit: result.costPerUnit,
        minimumStockLevel: result.minimumStockLevel,
        packagingType: result.packagingType,
        packagingSize: result.packagingSize,
        totalStock,
        stockByWarehouse: result.stock.map((s) => ({
          warehouseId: s.warehouseId,
          warehouseName: s.warehouse.name,
          quantity: s.quantity,
        })),
      };
    } else if (data.itemType === "packaging") {
      const result = await db.query.packagingMaterials.findFirst({
        where: eq(packagingMaterials.id, data.itemId),
        with: {
          stock: {
            with: {
              warehouse: {
                columns: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!result) throw new Error("Packaging material not found");

      const totalStock = result.stock.reduce(
        (sum, s) => sum + parseFloat(s.quantity),
        0,
      );

      item = {
        id: result.id,
        name: result.name,
        type: result.type,
        capacity: result.capacity,
        capacityUnit: result.capacityUnit,
        costPerUnit: result.costPerUnit,
        minimumStockLevel: result.minimumStockLevel,
        totalStock,
        stockByWarehouse: result.stock.map((s) => ({
          warehouseId: s.warehouseId,
          warehouseName: s.warehouse.name,
          quantity: s.quantity,
        })),
      };
    } else {
      // finished
      const result = await db.query.recipes.findFirst({
        where: eq(recipes.id, data.itemId),
        with: {
          product: true,
          finishedGoods: {
            with: {
              warehouse: {
                columns: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!result) throw new Error("Recipe not found");

      const totalCartons = result.finishedGoods.reduce(
        (sum, fg) => sum + fg.quantityCartons,
        0,
      );
      const totalContainers = result.finishedGoods.reduce(
        (sum, fg) => sum + fg.quantityContainers,
        0,
      );

      item = {
        id: result.id,
        name: result.name,
        productName: result.product?.name,
        containersPerCarton: result.containersPerCarton,
        estimatedCostPerContainer: result.estimatedCostPerContainer,
        minimumStockLevel: result.minimumStockLevel,
        totalCartons,
        totalContainers,
        // WAC values aggregated across all warehouse stock records
        weightedAverageCostPerPack: result.finishedGoods.reduce(
          (sum: number, fg: any) => sum + parseFloat(fg.weightedAverageCostPerPack?.toString() || "0"),
          0,
        ) > 0
          ? result.finishedGoods.reduce(
              (sum: number, fg: any) => sum + parseFloat(fg.weightedAverageCostPerPack?.toString() || "0"),
              0,
            ) / (result.finishedGoods.filter((fg: any) => parseFloat(fg.weightedAverageCostPerPack?.toString() || "0") > 0).length || 1)
          : null,
        weightedAverageCostPerCarton: result.containersPerCarton && result.containersPerCarton > 0
          ? (result.finishedGoods.reduce(
              (sum: number, fg: any) => sum + parseFloat(fg.weightedAverageCostPerPack?.toString() || "0"),
              0,
            ) / (result.finishedGoods.filter((fg: any) => parseFloat(fg.weightedAverageCostPerPack?.toString() || "0") > 0).length || 1)) * result.containersPerCarton
          : null,
        totalInventoryValue: result.finishedGoods.reduce(
          (sum: number, fg: any) => sum + parseFloat(fg.totalInventoryValue?.toString() || "0"),
          0,
        ),
        stockByWarehouse: result.finishedGoods.map((fg: any) => ({
          warehouseId: fg.warehouseId,
          warehouseName: fg.warehouse.name,
          quantityCartons: fg.quantityCartons,
          quantityContainers: fg.quantityContainers,
          weightedAverageCostPerPack: fg.weightedAverageCostPerPack,
          weightedAverageCostPerCarton: fg.weightedAverageCostPerCarton,
        })),
      };
    }

    // --- Fetch total count of transfers for this item ---
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(stockTransfers)
      .where(
        and(
          eq(stockTransfers.materialType, data.itemType),
          eq(stockTransfers.materialId, data.itemId),
        ),
      );

    // --- Fetch paginated transfer history with warehouse names and performer name ---
    const transfers = await db.query.stockTransfers.findMany({
      where: and(
        eq(stockTransfers.materialType, data.itemType),
        eq(stockTransfers.materialId, data.itemId),
      ),
      orderBy: [desc(stockTransfers.createdAt)],
      limit: data.limit,
      offset,
      with: {
        fromWarehouse: {
          columns: { id: true, name: true },
        },
        toWarehouse: {
          columns: { id: true, name: true },
        },
        performedBy: {
          columns: { id: true, name: true },
        },
      },
    });

    const pageCount = Math.ceil(total / data.limit);

    return {
      item,
      transferHistory: {
        data: transfers,
        total,
        pageCount,
        page: data.page,
      },
    };
  });

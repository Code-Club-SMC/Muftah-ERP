import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requireIntegrityAlertsMiddleware,
  requireIntegrityCheckMiddleware,
  requireManufacturingViewMiddleware,
} from "@/lib/middlewares";
import * as repo from "@/lib/cartons/carton.repository";
import { productionRuns } from "@/db/schemas/inventory-schema";
import { notInArray } from "drizzle-orm";

export const getCartonByIdFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(z.object({ cartonId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const carton = await repo.findCartonById(data.cartonId);
    if (!carton) {
      throw new Error("Carton not found");
    }
    return carton;
  });

export const getCartonsByBatchFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(z.object({ productionRunId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { recipes } = await import("@/db/schemas/inventory-schema");
    const { eq } = await import("drizzle-orm");

    const cartonsData = await repo.findCartonsByProductionRunId(data.productionRunId);
    
    if (cartonsData.length === 0) return [];
    
    const recipeId = cartonsData[0].recipeId;
    const [recipe] = await db
      .select({ fillAmount: recipes.fillAmount, fillUnit: recipes.fillUnit })
      .from(recipes)
      .where(eq(recipes.id, recipeId));

    return cartonsData.map((c) => ({
      ...c,
      weightAmount: recipe?.fillAmount ? Number(recipe.fillAmount) * c.currentPacks : 0,
      weightUnit: recipe?.fillUnit || "g",
    }));
  });

export const getBatchKpisFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(z.object({ productionRunId: z.string().min(1) }))
  .handler(async ({ data }) => {
    return repo.getBatchKpis(data.productionRunId);
  });

export const getCartonAuditLogFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(z.object({
    cartonId: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }))
  .handler(async ({ data }) => {
    const [logs, total] = await Promise.all([
      repo.findAdjustmentLogsByCartonId(data.cartonId, {
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
      }),
      repo.countAdjustmentLogsByCartonId(data.cartonId),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: data.page,
        limit: data.limit,
        totalPages: Math.ceil(total / data.limit),
      },
    };
  });

export const getBatchAuditLogFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(z.object({
    productionRunId: z.string().min(1),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }))
  .handler(async ({ data }) => {
    const [logs, total] = await Promise.all([
      repo.findAdjustmentLogsByBatchId(data.productionRunId, {
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
      }),
      repo.countAdjustmentLogsByBatchId(data.productionRunId),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: data.page,
        limit: data.limit,
        totalPages: Math.ceil(total / data.limit),
      },
    };
  });

export const getIntegrityAlertsFn = createServerFn()
  .middleware([requireIntegrityAlertsMiddleware])
  .inputValidator(z.object({}))
  .handler(async () => {
    return repo.findOpenIntegrityAlerts();
  });

export const runIntegrityCheckFn = createServerFn()
  .middleware([requireIntegrityCheckMiddleware])
  .inputValidator(z.object({ batchId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { runIntegrityCheck } = await import("@/lib/cartons/carton-extended.service");
    return runIntegrityCheck(data.batchId);
  });

export const updateIntegrityAlertFn = createServerFn()
  .middleware([requireIntegrityAlertsMiddleware])
  .inputValidator(z.object({
    alertId: z.string().min(1),
    status: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
    resolution: z.string().max(500).optional(),
  }))
  .handler(async ({ data, context }) => {
    return repo.updateIntegrityAlertById(data.alertId, {
      status: data.status,
      resolvedBy: data.status === "RESOLVED" ? context.session.user.id : undefined,
      resolvedAt: data.status === "RESOLVED" ? new Date() : undefined,
      resolution: data.resolution ?? null,
    });
  });

export const getCartonsByRecipeFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(
    z.object({
      recipeId: z.string().min(1),
      warehouseId: z.string().optional(),
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(100),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { cartons } = await import("@/db/schemas/manufacturing-schema");
    const { recipes } = await import("@/db/schemas/inventory-schema");
    const { eq, and, sql } = await import("drizzle-orm");

    const conditions = [eq(cartons.recipeId, data.recipeId)];
    if (data.warehouseId) {
      conditions.push(eq(cartons.warehouseId, data.warehouseId));
    }
    if (data.status && data.status !== "ALL") {
      conditions.push(eq(cartons.status, data.status));
    }

    // Get total count for pagination
    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cartons)
      .where(and(...conditions));

    const total = totalRes?.count || 0;

    // Fetch paginated data
    const cartonsData = await db.query.cartons.findMany({
      where: and(...conditions),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      limit: data.limit,
      offset: (data.page - 1) * data.limit,
    });

    if (cartonsData.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page: data.page,
          limit: data.limit,
          totalPages: Math.ceil(total / data.limit),
        },
      };
    }

    const [recipe] = await db
      .select({ fillAmount: recipes.fillAmount, fillUnit: recipes.fillUnit })
      .from(recipes)
      .where(eq(recipes.id, data.recipeId));

    const formattedData = cartonsData.map((c) => ({
      ...c,
      weightAmount: recipe?.fillAmount
        ? Number(recipe.fillAmount) * c.currentPacks
        : 0,
      weightUnit: recipe?.fillUnit || "g",
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page: data.page,
        limit: data.limit,
        totalPages: Math.ceil(total / data.limit),
      },
    };
  });

export const getRecipeKpisFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(
    z.object({
      recipeId: z.string().min(1),
      warehouseId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { cartons } = await import("@/db/schemas/manufacturing-schema");
    const { recipes } = await import("@/db/schemas/inventory-schema");
    const { eq, and, sql } = await import("drizzle-orm");

    const conditions = [eq(cartons.recipeId, data.recipeId)];
    if (data.warehouseId) {
      conditions.push(eq(cartons.warehouseId, data.warehouseId));
    }

    const [result] = await db
      .select({
        totalCartons: sql<number>`count(*) filter (where status not in ('ARCHIVED', 'RETIRED'))::int`,
        completeCartons: sql<number>`count(*) filter (where status = 'COMPLETE')::int`,
        partialCartons: sql<number>`count(*) filter (where status = 'PARTIAL')::int`,
        sealedCartons: sql<number>`count(*) filter (where status = 'SEALED')::int`,
        dispatchedCartons: sql<number>`count(*) filter (where status = 'DISPATCHED')::int`,
        onHoldCartons: sql<number>`count(*) filter (where status = 'ON_HOLD')::int`,
        retiredCartons: sql<number>`count(*) filter (where status = 'RETIRED')::int`,
        totalPacks: sql<number>`coalesce(sum(current_packs) filter (where status not in ('ARCHIVED', 'RETIRED')), 0)::int`,
        totalCapacity: sql<number>`coalesce(sum(capacity) filter (where status not in ('ARCHIVED', 'RETIRED')), 0)::int`,
        fillRatePct: sql<number>`round(coalesce(sum(current_packs) filter (where status not in ('ARCHIVED', 'RETIRED')), 0)::numeric / nullif(sum(capacity) filter (where status not in ('ARCHIVED', 'RETIRED')), 0) * 100, 2)`,
        containersPerCarton: recipes.containersPerCarton,
      })
      .from(cartons)
      .leftJoin(recipes, eq(cartons.recipeId, recipes.id))
      .where(and(...conditions));

    const capacity = Number(result?.containersPerCarton ?? 0);
    return {
      totalCartons: Number(result?.totalCartons ?? 0),
      completeCartons: Number(result?.completeCartons ?? 0),
      partialCartons: Number(result?.partialCartons ?? 0),
      sealedCartons: Number(result?.sealedCartons ?? 0),
      dispatchedCartons: Number(result?.dispatchedCartons ?? 0),
      onHoldCartons: Number(result?.onHoldCartons ?? 0),
      retiredCartons: Number(result?.retiredCartons ?? 0),
      totalPacks: Number(result?.totalPacks ?? 0),
      totalCapacity: Number(result?.totalCapacity ?? 0),
      fillRatePct: Number(result?.fillRatePct ?? 0),
      containersPerCarton: capacity,
    };
  });

export const getProductionRunsByRecipeFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .inputValidator(
    z.object({
      recipeId: z.string().min(1),
      warehouseId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { cartons } = await import("@/db/schemas/manufacturing-schema");
    const { recipes } = await import("@/db/schemas/inventory-schema");
    const { eq, and, sql } = await import("drizzle-orm");

    // Exclude cancelled/failed runs — they can never receive cartons
    const excludedStatuses = ["cancelled", "failed"];

    const conditions = [
      eq(productionRuns.recipeId, data.recipeId),
      notInArray(productionRuns.status, excludedStatuses),
    ];
    if (data.warehouseId) {
      conditions.push(eq(productionRuns.warehouseId, data.warehouseId));
    }

    const runs = await db
      .select({
        id: productionRuns.id,
        batchId: productionRuns.batchId,
        status: productionRuns.status,
        warehouseId: productionRuns.warehouseId,
        recipeId: productionRuns.recipeId,
      })
      .from(productionRuns)
      .where(and(...conditions))
      .orderBy(sql`${productionRuns.createdAt} DESC`);

    const [recipe] = await db
      .select({
        containersPerCarton: recipes.containersPerCarton,
        targetUnitsPerBatch: recipes.targetUnitsPerBatch,
      })
      .from(recipes)
      .where(eq(recipes.id, data.recipeId));

    const capacity = recipe?.containersPerCarton ?? 0;
    const recipeTargetUnits = recipe?.targetUnitsPerBatch ?? 0;

    // Get carton counts per run
    const cartonCounts = await db
      .select({
        productionRunId: cartons.productionRunId,
        count: sql<number>`count(*)::int`,
      })
      .from(cartons)
      .where(
        and(
          eq(cartons.recipeId, data.recipeId),
          ...(
            data.warehouseId
              ? [eq(cartons.warehouseId, data.warehouseId)]
              : []
          ),
        ),
      )
      .groupBy(cartons.productionRunId);

    const cartonCountMap = new Map(
      cartonCounts.map((c) => [c.productionRunId, c.count]),
    );

    const enriched = runs.map((run) => {
      const currentCartons = cartonCountMap.get(run.id) ?? 0;
      const targetUnits = recipeTargetUnits;
      const targetCartons =
        targetUnits > 0 && capacity > 0 ? Math.ceil(targetUnits / capacity) : 0;
      const shortfall = Math.max(0, targetCartons - currentCartons);
      // Mirror backend rules from addCartonsToBatch:
      // - Block cancelled/failed outright
      // - Block completed batches with no target
      // - Block any batch that has already met its target (shortfall = 0)
      const canAddCartons =
        !["cancelled", "failed"].includes(run.status) &&
        !(run.status === "completed" && targetCartons === 0) &&
        !(targetCartons > 0 && shortfall === 0);

      return {
        id: run.id,
        batchId: run.batchId,
        status: run.status,
        warehouseId: run.warehouseId,
        targetUnitsPerBatch: targetUnits,
        containersPerCarton: capacity,
        targetCartons,
        currentCartons,
        shortfall,
        canAddCartons,
      };
    });

    return enriched;
  });

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { cartons } from "@/db/schemas/manufacturing-schema";
import { requireInventoryViewMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { eq, and, sql, notInArray } from "drizzle-orm";

/**
 * Returns complete vs partial carton counts grouped by recipeId
 * for a given warehouse. Used by the invoice product dropdown to
 * show only sellable (COMPLETE status) cartons and indicate partials.
 *
 * Excludes RETIRED, DISPATCHED, ARCHIVED, ON_HOLD, SEALED statuses.
 * Only COMPLETE status cartons count as sellable completeCartons.
 */
export const getCartonAvailabilityFn = createServerFn()
  .middleware([requireInventoryViewMiddleware])
  .inputValidator((input: any) =>
    z.object({ warehouseId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const excludedStatuses = ["RETIRED", "DISPATCHED", "ARCHIVED", "ON_HOLD", "SEALED"];

    const rows = await db
      .select({
        recipeId: cartons.recipeId,
        completeCartons: sql<number>`COALESCE(SUM(CASE WHEN ${cartons.status} = 'COMPLETE' THEN 1 ELSE 0 END), 0)`.as("complete_cartons"),
        partialCartons: sql<number>`COALESCE(SUM(CASE WHEN ${cartons.status} = 'PARTIAL' THEN 1 ELSE 0 END), 0)`.as("partial_cartons"),
        totalPacks: sql<number>`COALESCE(SUM(${cartons.currentPacks}), 0)`.as("total_packs"),
      })
      .from(cartons)
      .where(
        and(
          eq(cartons.warehouseId, data.warehouseId),
          notInArray(cartons.status, excludedStatuses),
        ),
      )
      .groupBy(cartons.recipeId);

    return rows.map((r) => ({
      recipeId: r.recipeId,
      completeCartons: Number(r.completeCartons),
      partialCartons: Number(r.partialCartons),
      totalPacks: Number(r.totalPacks),
    }));
  });

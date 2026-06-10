import { db } from "@/db";
import {
  cartons,
  adjustmentLog,
  stockCountSessions,
  stockCountLines,
  returnRecords,
  returnLines,
  integrityAlerts,
  productionRuns,
  recipes,
} from "@/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { CartonNotFoundError, BatchNotFoundError } from "./carton.errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = any;

// ---------------------------------------------------------------------------
// Carton CRUD
// ---------------------------------------------------------------------------

export async function findCartonById(id: string) {
  const [carton] = await db
    .select()
    .from(cartons)
    .where(eq(cartons.id, id));
  return carton ?? null;
}

export async function findCartonByIdForUpdate(id: string, tx: DbOrTx) {
  const [carton] = await tx
    .select()
    .from(cartons)
    .where(eq(cartons.id, id))
    .for("update");
  if (!carton) throw new CartonNotFoundError(id);
  return carton;
}

export async function findCartonsByProductionRunId(productionRunId: string) {
  return db
    .select()
    .from(cartons)
    .where(eq(cartons.productionRunId, productionRunId));
}

export async function findCartonsByIdsForUpdate(ids: string[], tx: DbOrTx) {
  const sortedIds = [...ids].sort();
  return tx
    .select()
    .from(cartons)
    .where(inArray(cartons.id, sortedIds))
    .for("update");
}

export async function insertCarton(
  data: typeof cartons.$inferInsert,
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  const [result] = await executor.insert(cartons).values(data).returning();
  return result;
}

export async function insertCartons(
  data: (typeof cartons.$inferInsert)[],
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  return executor.insert(cartons).values(data).returning();
}

export async function updateCartonById(
  id: string,
  data: Partial<typeof cartons.$inferInsert>,
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  const [result] = await executor
    .update(cartons)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cartons.id, id))
    .returning();
  return result;
}

// ---------------------------------------------------------------------------
// Adjustment Log
// ---------------------------------------------------------------------------

export async function insertAdjustmentLog(
  data: typeof adjustmentLog.$inferInsert,
  tx: DbOrTx,
) {
  const [result] = await tx.insert(adjustmentLog).values(data).returning();
  return result;
}

export async function findAdjustmentLogsByCartonId(
  cartonId: string,
  options?: { limit?: number; offset?: number },
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  return db
    .select()
    .from(adjustmentLog)
    .where(eq(adjustmentLog.cartonId, cartonId))
    .orderBy(desc(adjustmentLog.performedAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdjustmentLogsByCartonId(cartonId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adjustmentLog)
    .where(eq(adjustmentLog.cartonId, cartonId));
  return result.count;
}

export async function findAdjustmentLogsByBatchId(
  batchId: string,
  options?: { limit?: number; offset?: number },
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  return db
    .select()
    .from(adjustmentLog)
    .where(eq(adjustmentLog.batchId, batchId))
    .orderBy(desc(adjustmentLog.performedAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdjustmentLogsByBatchId(batchId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adjustmentLog)
    .where(eq(adjustmentLog.batchId, batchId));
  return result.count;
}

// ---------------------------------------------------------------------------
// Production Run Queries
// ---------------------------------------------------------------------------

export async function findProductionRunById(id: string) {
  const [run] = await db
    .select()
    .from(productionRuns)
    .where(eq(productionRuns.id, id));
  return run ?? null;
}

export async function findProductionRunByIdForUpdate(id: string, tx: DbOrTx) {
  const [run] = await tx
    .select()
    .from(productionRuns)
    .where(eq(productionRuns.id, id))
    .for("update");
  if (!run) throw new BatchNotFoundError(id);
  return run;
}

export async function findRecipeById(id: string, tx?: DbOrTx) {
  const executor = tx ?? db;
  const [recipe] = await executor
    .select()
    .from(recipes)
    .where(eq(recipes.id, id));
  return recipe ?? null;
}

// ---------------------------------------------------------------------------
// Batch KPIs
// ---------------------------------------------------------------------------

export async function getBatchKpis(productionRunId: string) {
  const result = await db.execute(sql`
    SELECT
      c.total_cartons,
      c.complete_cartons,
      c.partial_cartons,
      c.sealed_cartons,
      c.dispatched_cartons,
      c.on_hold_cartons,
      c.retired_cartons,
      c.total_packs,
      c.total_capacity,
      c.fill_rate_pct,
      p.status AS run_status,
      r.target_units_per_batch,
      r.containers_per_carton
    FROM (
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('ARCHIVED', 'RETIRED')) AS total_cartons,
        COUNT(*) FILTER (WHERE status = 'COMPLETE') AS complete_cartons,
        COUNT(*) FILTER (WHERE status = 'PARTIAL') AS partial_cartons,
        COUNT(*) FILTER (WHERE status = 'SEALED') AS sealed_cartons,
        COUNT(*) FILTER (WHERE status = 'DISPATCHED') AS dispatched_cartons,
        COUNT(*) FILTER (WHERE status = 'ON_HOLD') AS on_hold_cartons,
        COUNT(*) FILTER (WHERE status = 'RETIRED') AS retired_cartons,
        COALESCE(SUM(current_packs) FILTER (WHERE status NOT IN ('ARCHIVED', 'RETIRED')), 0) AS total_packs,
        COALESCE(SUM(capacity) FILTER (WHERE status NOT IN ('ARCHIVED', 'RETIRED')), 0) AS total_capacity,
        ROUND(
          COALESCE(SUM(current_packs) FILTER (WHERE status NOT IN ('ARCHIVED', 'RETIRED')), 0)::numeric
          / NULLIF(SUM(capacity) FILTER (WHERE status NOT IN ('ARCHIVED', 'RETIRED')), 0) * 100, 2
        ) AS fill_rate_pct
      FROM cartons
      WHERE production_run_id = ${productionRunId}
    ) c
    CROSS JOIN production_runs p
    CROSS JOIN recipes r
    WHERE p.id = ${productionRunId}
      AND r.id = p.recipe_id
  `);
  const row = result.rows[0];
  const capacity = Number(row?.containers_per_carton ?? 0);
  const targetUnits = Number(row?.target_units_per_batch ?? 0);
  const targetCartons = capacity > 0 && targetUnits > 0 ? Math.ceil(targetUnits / capacity) : 0;
  const currentCartons = Number(row?.total_cartons ?? 0);
  return {
    totalCartons: currentCartons,
    completeCartons: Number(row?.complete_cartons ?? 0),
    partialCartons: Number(row?.partial_cartons ?? 0),
    sealedCartons: Number(row?.sealed_cartons ?? 0),
    dispatchedCartons: Number(row?.dispatched_cartons ?? 0),
    onHoldCartons: Number(row?.on_hold_cartons ?? 0),
    retiredCartons: Number(row?.retired_cartons ?? 0),
    totalPacks: Number(row?.total_packs ?? 0),
    totalCapacity: Number(row?.total_capacity ?? 0),
    fillRatePct: Number(row?.fill_rate_pct ?? 0),
    runStatus: String(row?.run_status ?? ""),
    targetUnitsPerBatch: targetUnits,
    containersPerCarton: capacity,
    targetCartons,
    shortfallCartons: Math.max(0, targetCartons - currentCartons),
  };
}

// ---------------------------------------------------------------------------
// Stock Count Sessions
// ---------------------------------------------------------------------------

export async function findStockCountSessionById(id: string) {
  const [session] = await db
    .select()
    .from(stockCountSessions)
    .where(eq(stockCountSessions.id, id));
  return session ?? null;
}

export async function insertStockCountSession(
  data: typeof stockCountSessions.$inferInsert,
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  const [result] = await executor
    .insert(stockCountSessions)
    .values(data)
    .returning();
  return result;
}

export async function updateStockCountSessionById(
  id: string,
  data: Partial<typeof stockCountSessions.$inferInsert>,
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  const [result] = await executor
    .update(stockCountSessions)
    .set(data)
    .where(eq(stockCountSessions.id, id))
    .returning();
  return result;
}

export async function findStockCountLinesBySessionId(sessionId: string) {
  return db
    .select()
    .from(stockCountLines)
    .where(eq(stockCountLines.sessionId, sessionId));
}

export async function updateStockCountLineById(
  id: string,
  data: Partial<typeof stockCountLines.$inferInsert>,
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  const [result] = await executor
    .update(stockCountLines)
    .set(data)
    .where(eq(stockCountLines.id, id))
    .returning();
  return result;
}

export async function insertStockCountLines(
  data: (typeof stockCountLines.$inferInsert)[],
  tx: DbOrTx,
) {
  return tx.insert(stockCountLines).values(data).returning();
}

// ---------------------------------------------------------------------------
// Return Records
// ---------------------------------------------------------------------------

export async function insertReturnRecord(
  data: typeof returnRecords.$inferInsert,
  tx: DbOrTx,
) {
  const [result] = await tx.insert(returnRecords).values(data).returning();
  return result;
}

export async function insertReturnLines(
  data: (typeof returnLines.$inferInsert)[],
  tx: DbOrTx,
) {
  return tx.insert(returnLines).values(data).returning();
}

// ---------------------------------------------------------------------------
// Integrity Alerts
// ---------------------------------------------------------------------------

export async function findOpenIntegrityAlerts() {
  return db
    .select()
    .from(integrityAlerts)
    .where(sql`${integrityAlerts.status} IN ('OPEN', 'ACKNOWLEDGED')`)
    .orderBy(desc(integrityAlerts.detectedAt));
}

export async function insertIntegrityAlerts(
  data: (typeof integrityAlerts.$inferInsert)[],
  tx: DbOrTx,
) {
  return tx.insert(integrityAlerts).values(data).returning();
}

export async function updateIntegrityAlertById(
  id: string,
  data: Partial<typeof integrityAlerts.$inferInsert>,
  tx?: DbOrTx,
) {
  const executor = tx ?? db;
  const [result] = await executor
    .update(integrityAlerts)
    .set(data)
    .where(eq(integrityAlerts.id, id))
    .returning();
  return result;
}

export async function findExistingOpenAlert(sku: string, batchId: string | null, delta: number) {
  const conditions = [
    eq(integrityAlerts.sku, sku),
    sql`${integrityAlerts.status} IN ('OPEN', 'ACKNOWLEDGED')`,
    eq(integrityAlerts.delta, delta),
  ];
  if (batchId) {
    conditions.push(eq(integrityAlerts.batchId, batchId));
  }
  const [existing] = await db
    .select()
    .from(integrityAlerts)
    .where(and(...conditions));
  return existing ?? null;
}
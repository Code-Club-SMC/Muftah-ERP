import { db } from "@/db";
import { cartons, adjustmentLog, productionRuns } from "@/db";
import { eq, inArray, sql, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { CartonStatus, AdjustmentType } from "./carton.types";
import { MIN_YIELD_THRESHOLD } from "./carton.types";
import {
  assertCanRemove,
  assertCanTopUp,
  assertCartonIsEditable,
  assertNewCapacityValid,
  assertNotDispatched,
  assertSameSku,
  deriveCartonStatus,
} from "./carton.guards";
import {
  BatchClosedError,
  BatchNotClosedError,
  CapacityExceededError,
  CartonAlreadyDispatchedError,
  CartonLockedError,
  CartonNotFoundError,
  CartonOnHoldError,
  PermissionError,
  YieldShortfallError,
} from "./carton.errors";
import * as repo from "./carton.repository";

// ---------------------------------------------------------------------------
// Scenario 1 — Top-Up a Partial Carton
// ---------------------------------------------------------------------------

export async function topUpCarton(
  cartonId: string,
  delta: number,
  userId: string,
  reason?: string,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);
    assertCanTopUp(carton, delta);

    const packsAfter = carton.currentPacks + delta;
    const newStatus = deriveCartonStatus(
      packsAfter,
      carton.capacity,
    );

    const [updated] = await tx
      .update(cartons)
      .set({
        currentPacks: packsAfter,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "TOP_UP" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta,
      packsAfter,
      reason: reason ?? null,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated, changed: true };
  });
}

// ---------------------------------------------------------------------------
// Scenario 2 — Remove Packs from a Carton
// ---------------------------------------------------------------------------

export async function removePacksFromCarton(
  cartonId: string,
  delta: number,
  userId: string,
  reason: string,
  notes?: string,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);
    assertCanRemove(carton, delta);

    // If SEALED, unseal first
    if (carton.status === "SEALED") {
      await tx.insert(adjustmentLog).values({
        id: createId(),
        cartonId,
        batchId: carton.productionRunId,
        sku: carton.sku,
        type: "UNSEALED" as AdjustmentType,
        packsBefore: carton.currentPacks,
        delta: 0,
        packsAfter: carton.currentPacks,
        reason: "Unsealed by pack removal",
        performedBy: userId,
        performedAt: new Date(),
      });
    }

    const negativeDelta = -delta;
    const packsAfter = carton.currentPacks + negativeDelta;
    const newStatus = deriveCartonStatus(
      packsAfter,
      carton.capacity,
    );

    const [updated] = await tx
      .update(cartons)
      .set({
        currentPacks: packsAfter,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "REMOVAL" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta: negativeDelta,
      packsAfter,
      reason: `${reason}${notes ? `: ${notes}` : ""}`,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated };
  });
}

// ---------------------------------------------------------------------------
// Scenario 3 — Set Carton to an Exact Pack Count (Manual Override)
// ---------------------------------------------------------------------------

export async function setCartonCount(
  cartonId: string,
  newCount: number,
  userId: string,
  reason: string,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);

    if (newCount === carton.currentPacks) {
      return { carton, changed: false };
    }

    if (newCount < 0 || newCount > carton.capacity) {
      throw new CapacityExceededError(
        `Count must be between 0 and ${carton.capacity}.`,
      );
    }

    assertNotDispatched(carton);

    const delta = newCount - carton.currentPacks;
    const newStatus = deriveCartonStatus(
      newCount,
      carton.capacity,
    );

    const [updated] = await tx
      .update(cartons)
      .set({
        currentPacks: newCount,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "MANUAL_OVERRIDE" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta,
      packsAfter: newCount,
      reason,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated, changed: true };
  });
}

// ---------------------------------------------------------------------------
// Scenario 4 — Bulk Adjust Multiple Cartons
// ---------------------------------------------------------------------------

export async function bulkAdjustCartons(
  cartonIds: string[],
  delta: number,
  strategy: "SKIP" | "CAP",
  reason: string,
  userId: string,
) {
  const bulkOperationId = createId();

  return db.transaction(async (tx) => {
    const sortedIds = [...cartonIds].sort();
    const lockedCartons = await tx
      .select()
      .from(cartons)
      .where(inArray(cartons.id, sortedIds))
      .for("update");

    const updated: Array<{
      cartonId: string;
      packsBefore: number;
      packsAfter: number;
    }> = [];
    const skipped: Array<{ cartonId: string; reason: string }> = [];

    for (const carton of lockedCartons) {
      try {
        assertCartonIsEditable(carton);

        let effectiveDelta = delta;
        if (delta > 0) {
          const available = carton.capacity - carton.currentPacks;
          if (strategy === "SKIP" && delta > available) {
            skipped.push({
              cartonId: carton.id,
              reason: "CAPACITY_EXCEEDED",
            });
            continue;
          }
          if (strategy === "CAP") {
            effectiveDelta = Math.min(delta, available);
            if (effectiveDelta === 0) {
              skipped.push({
                cartonId: carton.id,
                reason: "CAPACITY_EXCEEDED",
              });
              continue;
            }
          }
        } else {
          const maxRemovable = carton.currentPacks;
          if (strategy === "SKIP" && Math.abs(delta) > maxRemovable) {
            skipped.push({
              cartonId: carton.id,
              reason: "INSUFFICIENT_PACKS",
            });
            continue;
          }
          if (strategy === "CAP") {
            effectiveDelta = Math.max(delta, -maxRemovable);
            if (effectiveDelta === 0) {
              skipped.push({
                cartonId: carton.id,
                reason: "INSUFFICIENT_PACKS",
              });
              continue;
            }
          }
        }

        const packsAfter = carton.currentPacks + effectiveDelta;
        const newStatus = deriveCartonStatus(
          packsAfter,
          carton.capacity,
        );

        await tx
          .update(cartons)
          .set({
            currentPacks: packsAfter,
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(cartons.id, carton.id));

        await tx.insert(adjustmentLog).values({
          id: createId(),
          cartonId: carton.id,
          batchId: carton.productionRunId,
          sku: carton.sku,
          type: "BULK_ADJUST" as AdjustmentType,
          packsBefore: carton.currentPacks,
          delta: effectiveDelta,
          packsAfter,
          reason,
          bulkOperationId,
          performedBy: userId,
          performedAt: new Date(),
        });

        updated.push({
          cartonId: carton.id,
          packsBefore: carton.currentPacks,
          packsAfter,
        });
      } catch (error) {
        skipped.push({
          cartonId: carton.id,
          reason: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        });
      }
    }

    return { bulkOperationId, updated, skipped };
  });
}

// ---------------------------------------------------------------------------
// Scenario 6 — Merge Packs from Multiple Partial Cartons into One
// ---------------------------------------------------------------------------

export async function mergeCartons(
  sourceCartonIds: string[],
  destinationCartonId: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const allIds = [...sourceCartonIds, destinationCartonId].sort();
    const lockedCartons = await tx
      .select()
      .from(cartons)
      .where(inArray(cartons.id, allIds))
      .for("update");

    const cartonMap = new Map(lockedCartons.map((c) => [c.id, c]));
    const destination = cartonMap.get(destinationCartonId);
    if (!destination) throw new CartonNotFoundError(destinationCartonId);

    assertCartonIsEditable(destination);

    const sources = sourceCartonIds
      .map((id) => cartonMap.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (sources.length !== sourceCartonIds.length) {
      throw new CartonNotFoundError("One or more source cartons not found");
    }

    for (const source of sources) {
      assertSameSku(source, destination);
    }

    const totalSourcePacks = sources.reduce(
      (sum, s) => sum + s!.currentPacks,
      0,
    );
    const availableSpace = destination.capacity - destination.currentPacks;
    if (totalSourcePacks > availableSpace) {
      throw new CapacityExceededError(
        `Total packs (${totalSourcePacks}) exceed available space (${availableSpace}).`,
      );
    }

    // Archive all source cartons
    for (const source of sources) {
      await tx
        .update(cartons)
        .set({
          currentPacks: 0,
          status: "ARCHIVED" as CartonStatus,
          updatedAt: new Date(),
        })
        .where(eq(cartons.id, source!.id));

      await tx.insert(adjustmentLog).values({
        id: createId(),
        cartonId: source!.id,
        batchId: source!.productionRunId,
        sku: source!.sku,
        type: "MERGE_OUT" as AdjustmentType,
        packsBefore: source!.currentPacks,
        delta: -source!.currentPacks,
        packsAfter: 0,
        reason: `Merged into carton ${destinationCartonId}`,
        relatedCartonId: destinationCartonId,
        performedBy: userId,
        performedAt: new Date(),
      });
    }

    // Add packs to destination
    const newPacks = destination.currentPacks + totalSourcePacks;
    const newStatus = deriveCartonStatus(
      newPacks,
      destination.capacity,
    );

    const [updatedDest] = await tx
      .update(cartons)
      .set({
        currentPacks: newPacks,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, destinationCartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId: destinationCartonId,
      batchId: destination.productionRunId,
      sku: destination.sku,
      type: "MERGE_IN" as AdjustmentType,
      packsBefore: destination.currentPacks,
      delta: totalSourcePacks,
      packsAfter: newPacks,
      reason: `Merged from ${sources.length} carton(s)`,
      performedBy: userId,
      performedAt: new Date(),
    });

    return {
      destination: updatedDest,
      archivedSources: sourceCartonIds,
    };
  });
}

// ---------------------------------------------------------------------------
// Scenario 7 — Change a Carton's Capacity (Repack)
// ---------------------------------------------------------------------------

export async function repackCarton(
  cartonId: string,
  newCapacity: number,
  justification: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);
    assertCartonIsEditable(carton);
    assertNewCapacityValid(carton, newCapacity);

    const oldCapacity = carton.capacity;

    // One-time snapshot of original capacity
    const originalCapacity = carton.originalCapacity ?? oldCapacity;

    const newStatus = deriveCartonStatus(
      carton.currentPacks,
      newCapacity,
    );

    const [updated] = await tx
      .update(cartons)
      .set({
        capacity: newCapacity,
        originalCapacity,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "REPACK" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta: 0,
      packsAfter: carton.currentPacks,
      reason: `Capacity changed from ${oldCapacity} to ${newCapacity}. Justification: ${justification}`,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated };
  });
}

// ---------------------------------------------------------------------------
// Scenario 8 — Retire / Archive a Damaged or Lost Carton
// ---------------------------------------------------------------------------

export async function retireCarton(
  cartonId: string,
  reason: string,
  notes: string | undefined,
  userId: string,
  isPrivilegedUser: boolean,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);

    if (carton.status === "RETIRED") {
      throw new CartonNotFoundError(`Carton ${cartonId} is already retired.`);
    }
    if (carton.status === "DISPATCHED") {
      throw new CartonAlreadyDispatchedError(
        `Carton ${cartonId} is dispatched. Use the Returns flow.`,
      );
    }

    // COMPLETE or SEALED requires Admin (isPrivilegedUser)
    if (["COMPLETE", "SEALED"].includes(carton.status) && !isPrivilegedUser) {
      throw new PermissionError(
        "Only administrators can retire COMPLETE or SEALED cartons.",
      );
    }

    const writeOffPacks = carton.currentPacks;

    const [updated] = await tx
      .update(cartons)
      .set({
        currentPacks: 0,
        status: "RETIRED" as CartonStatus,
        retiredAt: new Date(),
        retiredReason: `${reason}${notes ? `: ${notes}` : ""}`,
        retiredBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "RETIRE" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta: -writeOffPacks,
      packsAfter: 0,
      reason: `Retired: ${reason}${notes ? `. ${notes}` : ""}`,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated };
  });
}

// ---------------------------------------------------------------------------
// Scenario 11 — Add Supplementary Cartons to a Batch
// ---------------------------------------------------------------------------

export async function addCartonsToBatch(
  productionRunId: string,
  count: number,
  _userId: string,
  zone?: string,
) {
  return db.transaction(async (tx) => {
    const run = await repo.findProductionRunByIdForUpdate(productionRunId, tx);

    // Block cancelled/failed outright
    if (["cancelled", "failed"].includes(run.status)) {
      throw new BatchClosedError(
        "Cannot add cartons to a cancelled or failed production run.",
      );
    }

    const recipe = await repo.findRecipeById(run.recipeId, tx);
    if (!recipe) throw new Error("Recipe not found");

    const capacity = recipe.containersPerCarton || 0;
    if (!capacity || capacity <= 0) {
      throw new Error(
        `Cannot add cartons: recipe "${recipe.name}" has no containersPerCarton defined. Set the carton capacity on the recipe first.`,
      );
    }

    // Calculate current cartons and target (exclude archived/retired)
    const [existingCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(cartons)
      .where(
        and(
          eq(cartons.productionRunId, productionRunId),
          sql`${cartons.status} NOT IN ('ARCHIVED', 'RETIRED')`,
        ),
      );

    const currentCartons = existingCount.count;
    const targetUnits = recipe.targetUnitsPerBatch ?? 0;
    const targetCartons = targetUnits > 0 && capacity > 0 ? Math.ceil(targetUnits / capacity) : 0;
    const shortfall = Math.max(0, targetCartons - currentCartons);

    // Enforce hard cap against shortfall when target is defined
    if (targetCartons > 0) {
      if (count > shortfall) {
        throw new BatchClosedError(
          shortfall === 0
            ? "This batch has already met its production target. No additional cartons can be added."
            : `Cannot add ${count} cartons. This batch is short by only ${shortfall} carton${shortfall !== 1 ? "s" : ""}.`,
        );
      }
    }

    // Completed batches with no target can't be verified for shortfall — block them
    if (run.status === "completed" && targetCartons === 0) {
      throw new BatchClosedError(
        "Cannot add cartons to a completed batch with no production target defined.",
      );
    }

    // If completed but shortfall exists, reopen to in_progress so downstream ops work
    if (run.status === "completed" && shortfall > 0) {
      await tx
        .update(productionRuns)
        .set({
          status: "in_progress",
          actualCompletionDate: null,
          reopenedAt: new Date(),
          reopenedBy: _userId,
          reopenReason: "Auto-reopened: adding cartons to meet production shortfall",
        })
        .where(eq(productionRuns.id, productionRunId));
    }

    const newCartons: (typeof cartons.$inferInsert)[] = [];

    for (let i = 0; i < count; i++) {
      newCartons.push({
        id: createId(),
        recipeId: run.recipeId,
        productionRunId: run.id,
        warehouseId: run.warehouseId,
        sku: recipe.name,
        capacity,
        currentPacks: 0,
        status: "PARTIAL" as CartonStatus,
        zone: zone ?? null,
      });
    }

    const created = await tx.insert(cartons).values(newCartons).returning();

    // Re-calculate after insert (exclude archived/retired)
    const [newExistingCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(cartons)
      .where(
        and(
          eq(cartons.productionRunId, productionRunId),
          sql`${cartons.status} NOT IN ('ARCHIVED', 'RETIRED')`,
        ),
      );

    let exceedsTarget = false;
    if (targetUnits > 0 && capacity > 0) {
      exceedsTarget = newExistingCount.count > targetCartons;
    }

    return {
      created,
      exceedsTarget,
      totalCartons: newExistingCount.count,
      shortfallCartons: Math.max(0, targetCartons - newExistingCount.count),
    };
  });
}

// ---------------------------------------------------------------------------
// Scenario 13 — Transfer Packs Between Cartons
// ---------------------------------------------------------------------------

export async function transferPacks(
  sourceCartonId: string,
  destinationCartonId: string,
  packCount: number,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const sortedIds = [sourceCartonId, destinationCartonId].sort();
    const [source, destination] = await tx
      .select()
      .from(cartons)
      .where(inArray(cartons.id, sortedIds))
      .for("update");

    if (!source || source.id !== sourceCartonId)
      throw new CartonNotFoundError(sourceCartonId);
    if (!destination || destination.id !== destinationCartonId)
      throw new CartonNotFoundError(destinationCartonId);

    assertCartonIsEditable(source);
    assertCartonIsEditable(destination);
    assertSameSku(source, destination);

    if (packCount > source.currentPacks) {
      throw new CapacityExceededError(
        `Cannot transfer ${packCount} packs. Source only has ${source.currentPacks}.`,
      );
    }

    const destAvail = destination.capacity - destination.currentPacks;
    if (packCount > destAvail) {
      throw new CapacityExceededError(
        `Cannot transfer ${packCount} packs. Destination only has ${destAvail} space available.`,
      );
    }

    // Update source
    const sourcePacksAfter = source.currentPacks - packCount;
    const sourceNewStatus = deriveCartonStatus(
      sourcePacksAfter,
      source.capacity,
    );

    await tx
      .update(cartons)
      .set({
        currentPacks: sourcePacksAfter,
        status: sourceNewStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, sourceCartonId));

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId: sourceCartonId,
      batchId: source.productionRunId,
      sku: source.sku,
      type: "TRANSFER_OUT" as AdjustmentType,
      packsBefore: source.currentPacks,
      delta: -packCount,
      packsAfter: sourcePacksAfter,
      reason: `Transferred ${packCount} pack(s) to carton ${destinationCartonId}`,
      relatedCartonId: destinationCartonId,
      performedBy: userId,
      performedAt: new Date(),
    });

    // Update destination
    const destPacksAfter = destination.currentPacks + packCount;
    const destNewStatus = deriveCartonStatus(
      destPacksAfter,
      destination.capacity,
    );

    const [updatedDest] = await tx
      .update(cartons)
      .set({
        currentPacks: destPacksAfter,
        status: destNewStatus,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, destinationCartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId: destinationCartonId,
      batchId: destination.productionRunId,
      sku: destination.sku,
      type: "TRANSFER_IN" as AdjustmentType,
      packsBefore: destination.currentPacks,
      delta: packCount,
      packsAfter: destPacksAfter,
      reason: `Transferred ${packCount} pack(s) from carton ${sourceCartonId}`,
      relatedCartonId: sourceCartonId,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { source: { id: sourceCartonId, packsAfter: sourcePacksAfter }, destination: updatedDest };
  });
}

// ---------------------------------------------------------------------------
// Scenario 17 — QC Hold
// ---------------------------------------------------------------------------

export async function applyQcHold(
  cartonId: string,
  reason: string,
  userId: string,
  expiresAt?: Date,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);

    if (carton.status === "ON_HOLD") {
      throw new CartonOnHoldError(`Carton ${cartonId} is already on hold.`);
    }
    if (["DISPATCHED", "RETIRED", "ARCHIVED"].includes(carton.status)) {
      throw new CartonLockedError(
        `Cannot hold a carton with status ${carton.status}.`,
      );
    }

    const preHoldStatus = carton.status;

    const [updated] = await tx
      .update(cartons)
      .set({
        status: "ON_HOLD" as CartonStatus,
        preHoldStatus,
        holdReason: reason,
        holdStartedAt: new Date(),
        holdExpiresAt: expiresAt ?? null,
        holdStartedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "QC_HOLD_APPLIED" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta: 0,
      packsAfter: carton.currentPacks,
      reason,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated };
  });
}

export async function releaseQcHold(
  cartonId: string,
  outcome: "CLEARED" | "CONDEMNED",
  notes: string | undefined,
  userId: string,
  isPrivilegedUser: boolean,
) {
  return db.transaction(async (tx) => {
    const carton = await repo.findCartonByIdForUpdate(cartonId, tx);

    if (carton.status !== "ON_HOLD") {
      throw new CartonNotFoundError(`Carton ${cartonId} is not on hold.`);
    }

    if (!isPrivilegedUser) {
      throw new PermissionError("Only managers can release QC holds.");
    }

    if (outcome === "CLEARED") {
      const restoredStatus = carton.preHoldStatus ?? "PARTIAL";
      const [updated] = await tx
        .update(cartons)
        .set({
          status: restoredStatus as CartonStatus,
          preHoldStatus: null,
          holdReason: null,
          holdStartedAt: null,
          holdExpiresAt: null,
          holdStartedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(cartons.id, cartonId))
        .returning();

      await tx.insert(adjustmentLog).values({
        id: createId(),
        cartonId,
        batchId: carton.productionRunId,
        sku: carton.sku,
        type: "QC_HOLD_CLEARED" as AdjustmentType,
        packsBefore: carton.currentPacks,
        delta: 0,
        packsAfter: carton.currentPacks,
        reason: `QC Hold cleared${notes ? `. ${notes}` : ""}`,
        performedBy: userId,
        performedAt: new Date(),
      });

      return { carton: updated };
    }

    // CONDEMNED — retire the carton
    const writeOffPacks = carton.currentPacks;
    const [updated] = await tx
      .update(cartons)
      .set({
        currentPacks: 0,
        status: "RETIRED" as CartonStatus,
        preHoldStatus: null,
        holdReason: null,
        holdStartedAt: null,
        holdExpiresAt: null,
        holdStartedBy: null,
        retiredAt: new Date(),
        retiredReason: `QC Condemned${notes ? `: ${notes}` : ""}`,
        retiredBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(cartons.id, cartonId))
      .returning();

    await tx.insert(adjustmentLog).values({
      id: createId(),
      cartonId,
      batchId: carton.productionRunId,
      sku: carton.sku,
      type: "QC_HOLD_CONDEMNED" as AdjustmentType,
      packsBefore: carton.currentPacks,
      delta: -writeOffPacks,
      packsAfter: 0,
      reason: `QC Hold condemned${notes ? `. ${notes}` : ""}`,
      performedBy: userId,
      performedAt: new Date(),
    });

    return { carton: updated };
  });
}

// ---------------------------------------------------------------------------
// Scenario 9 — Close a Batch
// ---------------------------------------------------------------------------

export async function closeBatch(
  productionRunId: string,
  userId: string,
  acknowledgeShortfall: boolean = false,
) {
  return db.transaction(async (tx) => {
    const run = await repo.findProductionRunByIdForUpdate(productionRunId, tx);

    if (!["scheduled", "in_progress"].includes(run.status)) {
      throw new BatchClosedError("Production run must be scheduled or in_progress to close.");
    }

    const recipe = await repo.findRecipeById(run.recipeId, tx);
    if (!recipe) throw new Error("Recipe not found");

    const batchCartons = await repo.findCartonsByIdsForUpdate(
      (await tx.select({ id: cartons.id }).from(cartons).where(eq(cartons.productionRunId, productionRunId))).map((c) => c.id),
      tx,
    );

    const totalPacks = batchCartons.reduce(
      (sum: number, c: any) => sum + (c.status !== "ARCHIVED" && c.status !== "RETIRED" ? c.currentPacks : 0),
      0,
    );
    const targetPacks =
      (recipe.containersPerCarton ?? 0) * (recipe.targetUnitsPerBatch ?? 0);
    const yieldPct = targetPacks > 0 ? (totalPacks / targetPacks) * 100 : 100;

    if (yieldPct < MIN_YIELD_THRESHOLD && !acknowledgeShortfall) {
      throw new YieldShortfallError(yieldPct, MIN_YIELD_THRESHOLD);
    }

    // Seal all non-hold, non-dispatched, non-retired, non-archived cartons
    for (const c of batchCartons) {
      if (["PARTIAL", "COMPLETE"].includes(c.status)) {
        await tx
          .update(cartons)
          .set({ status: "SEALED" as CartonStatus, updatedAt: new Date() })
          .where(eq(cartons.id, c.id));
      }
    }

    // Mark ON_HOLD cartons as still on hold (they stay)

    await tx
      .update(productionRuns)
      .set({
        status: "completed",
        actualCompletionDate: new Date(),
        closedBy: userId,
      })
      .where(eq(productionRuns.id, productionRunId));

    const updatedRun = await repo.findProductionRunById(productionRunId);

    return {
      productionRun: updatedRun,
      yieldPct,
      totalPacks,
      targetPacks,
      cartonsSealed: batchCartons.filter((c: any) =>
        ["PARTIAL", "COMPLETE"].includes(c.status),
      ).length,
      cartonsOnHold: batchCartons.filter((c: any) => c.status === "ON_HOLD").length,
    };
  });
}

// ---------------------------------------------------------------------------
// Scenario 10 — Reopen a Closed Batch
// ---------------------------------------------------------------------------

export async function reopenBatch(
  productionRunId: string,
  userId: string,
  reopenReason: string,
  force: boolean = false,
) {
  return db.transaction(async (tx) => {
    const run = await repo.findProductionRunByIdForUpdate(productionRunId, tx);

    if (run.status !== "completed") {
      throw new BatchNotClosedError("Production run is not closed. Only completed runs can be reopened.");
    }

    const batchCartons = await repo.findCartonsByIdsForUpdate(
      (await tx.select({ id: cartons.id }).from(cartons).where(eq(cartons.productionRunId, productionRunId))).map((c: any) => c.id),
      tx,
    );

    const dispatchedCartons = batchCartons.filter(
      (c: any) => c.status === "DISPATCHED",
    );

    if (dispatchedCartons.length > 0 && !force) {
      return {
        requiresForce: true,
        dispatchedCartonIds: dispatchedCartons.map((c: any) => c.id),
        message:
          "Some cartons are already dispatched. Re-submit with force=true to proceed (dispatched cartons will remain locked).",
      };
    }

    // Unseal all SEALED cartons back to their derived status
    for (const c of batchCartons) {
      if (c.status === "SEALED") {
        const derivedStatus =
          c.currentPacks === c.capacity ? "COMPLETE" : "PARTIAL";
        await tx
          .update(cartons)
          .set({
            status: derivedStatus as CartonStatus,
            updatedAt: new Date(),
          })
          .where(eq(cartons.id, c.id));
      }
    }

    await tx
      .update(productionRuns)
      .set({
        status: "in_progress",
        reopenedAt: new Date(),
        reopenedBy: userId,
        reopenReason,
      })
      .where(eq(productionRuns.id, productionRunId));

    const updatedRun = await repo.findProductionRunById(productionRunId);

    return {
      productionRun: updatedRun,
      reopenedCartons: batchCartons.filter((c: any) => c.status === "SEALED").length,
      lockedDispatchedCartons: dispatchedCartons.length,
    };
  });
}
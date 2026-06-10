import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { commissionTiers, commissionRecords } from "@/db/schemas/sales-erp-schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  requireSalesConfigViewMiddleware,
  requireSalesConfigManageMiddleware,
  requireSalesPeopleViewMiddleware,
} from "@/lib/middlewares";

// ═══════════════════════════════════════════════════════════════════════════
// COMMISSION TIERS
// ═══════════════════════════════════════════════════════════════════════════

export const getCommissionTiersFn = createServerFn()
  .middleware([requireSalesConfigViewMiddleware])
  .inputValidator((input: any) =>
    z.object({ orderBookerId: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.orderBookerId) {
      return await db.query.commissionTiers.findMany({
        where: eq(commissionTiers.orderBookerId, data.orderBookerId),
        orderBy: [commissionTiers.minAmount],
      });
    }
    // Return ALL tiers (global + per-booker) for management view
    return await db.query.commissionTiers.findMany({
      orderBy: [commissionTiers.minAmount],
    });
  });

export const getOrderBookerCommissionTiersFn = createServerFn()
  .middleware([requireSalesConfigViewMiddleware])
  .inputValidator((input: any) =>
    z.object({ orderBookerId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const bookerTiers = await db.query.commissionTiers.findMany({
      where: and(
        eq(commissionTiers.orderBookerId, data.orderBookerId),
        eq(commissionTiers.isActive, true),
      ),
      orderBy: [commissionTiers.minAmount],
    });
    if (bookerTiers.length > 0) return bookerTiers;
    // Fall back to global tiers
    return await db.query.commissionTiers.findMany({
      where: and(
        isNull(commissionTiers.orderBookerId),
        eq(commissionTiers.isActive, true),
      ),
      orderBy: [commissionTiers.minAmount],
    });
  });

export const createCommissionTierFn = createServerFn()
  .middleware([requireSalesConfigManageMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        orderBookerId: z.string().optional(),
        minAmount: z.number().nonnegative(),
        maxAmount: z.number().nonnegative().nullable().optional(),
        rate: z.number().min(0).max(100),
      })
      .refine((data) => data.maxAmount === null || data.maxAmount === undefined || data.maxAmount > data.minAmount, {
        message: "Max amount must be greater than min amount",
        path: ["maxAmount"],
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const [inserted] = await db
      .insert(commissionTiers)
      .values({
        orderBookerId: data.orderBookerId ?? null,
        minAmount: data.minAmount.toString(),
        maxAmount: data.maxAmount?.toString() ?? null,
        rate: data.rate.toString(),
      })
      .returning();
    return inserted;
  });

export const updateCommissionTierFn = createServerFn()
  .middleware([requireSalesConfigManageMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        id: z.string(),
        minAmount: z.number().nonnegative().optional(),
        maxAmount: z.number().nonnegative().nullable().optional(),
        rate: z.number().min(0).max(100).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    const updateValues: any = {};
    if (updates.minAmount !== undefined) updateValues.minAmount = updates.minAmount.toString();
    if (updates.maxAmount !== undefined) updateValues.maxAmount = updates.maxAmount?.toString() ?? null;
    if (updates.rate !== undefined) updateValues.rate = updates.rate.toString();
    if (updates.isActive !== undefined) updateValues.isActive = updates.isActive;
    updateValues.updatedAt = new Date();

    const [updated] = await db
      .update(commissionTiers)
      .set(updateValues)
      .where(eq(commissionTiers.id, id))
      .returning();
    return updated;
  });

export const deleteCommissionTierFn = createServerFn()
  .middleware([requireSalesConfigManageMiddleware])
  .inputValidator((input: any) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    await db.delete(commissionTiers).where(eq(commissionTiers.id, data.id));
    return { success: true };
  });

// ═══════════════════════════════════════════════════════════════════════════
// COMMISSION CALCULATION & RECORDS
// ═══════════════════════════════════════════════════════════════════════════

export const getCommissionRecordsFn = createServerFn()
  .middleware([requireSalesPeopleViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        orderBookerId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        status: z.enum(["accrued", "paid", "reversed"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const conditions: any[] = [eq(commissionRecords.orderBookerId, data.orderBookerId)];
    if (data.fromDate) {
      conditions.push(sql`${commissionRecords.calculatedAt} >= ${new Date(data.fromDate)}`);
    }
    if (data.toDate) {
      conditions.push(sql`${commissionRecords.calculatedAt} <= ${new Date(data.toDate)}`);
    }
    if (data.status) {
      conditions.push(eq(commissionRecords.status, data.status));
    }
    return await db.query.commissionRecords.findMany({
      where: and(...conditions),
      orderBy: [desc(commissionRecords.calculatedAt)],
    });
  });

export const getCommissionSummaryFn = createServerFn()
  .middleware([requireSalesPeopleViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        orderBookerId: z.string(),
        fromDate: z.string(),
        toDate: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const records = await db.query.commissionRecords.findMany({
      where: and(
        eq(commissionRecords.orderBookerId, data.orderBookerId),
        sql`${commissionRecords.calculatedAt} >= ${new Date(data.fromDate)}`,
        sql`${commissionRecords.calculatedAt} <= ${new Date(data.toDate)}`,
      ),
    });

    const accrued = records
      .filter((r) => r.status === "accrued")
      .reduce((sum, r) => sum + parseFloat(r.commissionAmount), 0);
    const paid = records
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + parseFloat(r.commissionAmount), 0);
    const reversed = records
      .filter((r) => r.status === "reversed")
      .reduce((sum, r) => sum + parseFloat(r.commissionAmount), 0);

    return {
      totalRecords: records.length,
      totalAccrued: accrued,
      totalPaid: paid,
      totalReversed: reversed,
      totalPending: accrued - paid - reversed,
    };
  });

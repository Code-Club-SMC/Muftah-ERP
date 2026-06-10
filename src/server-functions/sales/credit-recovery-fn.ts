/**
 * Enhanced Credit Recovery Server Functions
 * Removed auto-assignment, manual status control, professional escalation
 */

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { createId } from "@paralleldrive/cuid2";
import { invoices } from "@/db/schemas/sales-schema";
import { slipRecords, creditRecoveryAttempts } from "@/db/schemas/sales-erp-schema";
import {
  requireSalesRecoveryViewMiddleware,
  requireSalesRecoveryManageMiddleware,
} from "@/lib/middlewares";
import { z } from "zod";
import {
  eq,
  and,
  ne,
  lte,
  lt,
  isNotNull,
  isNull,
  sql,
  asc,
  desc,
  inArray,
} from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// GET DUE TODAY SLIPS
// All non-closed slips where invoice creditReturnDate <= today.
// ═══════════════════════════════════════════════════════════════════════════
export const getDueTodaySlipsFn = createServerFn()
  .middleware([requireSalesRecoveryViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().default(50),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dueInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(
        isNotNull(invoices.creditReturnDate),
        lte(invoices.creditReturnDate, todayEnd),
      ));

    const dueInvoiceIds = dueInvoices.map((i) => i.id);

    if (dueInvoiceIds.length === 0) {
      return { slips: [], total: 0, pageCount: 0 };
    }

    const offset = (data.page - 1) * data.limit;

    const results = await db.query.slipRecords.findMany({
      where: and(
        ne(slipRecords.status, "closed"),
        inArray(slipRecords.invoiceId, dueInvoiceIds),
      ),
      with: {
        invoice: {
          columns: {
            id: true,
            date: true,
            totalPrice: true,
            credit: true,
            creditReturnDate: true,
          },
        },
        customer: {
          columns: {
            id: true,
            name: true,
            city: true,
            mobileNumber: true,
            customerType: true,
          },
        },
      },
      orderBy: [asc(slipRecords.issuedAt)],
      limit: data.limit,
      offset,
    });

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(slipRecords)
      .where(and(
        ne(slipRecords.status, "closed"),
        inArray(slipRecords.invoiceId, dueInvoiceIds),
      ));

    return {
      slips: results,
      total: Number(totalRes.count),
      pageCount: Math.ceil(Number(totalRes.count) / data.limit),
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET RECOVERY QUEUE
// All slips with recoveryStatus set, filterable.
// ═══════════════════════════════════════════════════════════════════════════
export const getRecoveryQueueFn = createServerFn()
  .middleware([requireSalesRecoveryViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      recoveryStatus: z.enum(["pending", "in_progress", "partially_paid", "overdue", "defaulted"]).optional(),
      escalationLevel: z.number().int().min(0).optional(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().default(50),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const conditions = [isNotNull(slipRecords.recoveryStatus)];

    if (data.recoveryStatus) {
      conditions.push(eq(slipRecords.recoveryStatus, data.recoveryStatus));
    }
    if (data.escalationLevel !== undefined) {
      conditions.push(eq(slipRecords.escalationLevel, data.escalationLevel));
    }

    const offset = (data.page - 1) * data.limit;

    const results = await db.query.slipRecords.findMany({
      where: and(...conditions),
      with: {
        invoice: {
          columns: {
            id: true,
            date: true,
            totalPrice: true,
            credit: true,
            creditReturnDate: true,
          },
        },
        customer: {
          columns: {
            id: true,
            name: true,
            city: true,
            mobileNumber: true,
            customerType: true,
          },
        },
      },
      orderBy: [asc(slipRecords.nextFollowUpDate)],
      limit: data.limit,
      offset,
    });

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(slipRecords)
      .where(and(...conditions));

    return {
      slips: results,
      total: Number(totalRes.count),
      pageCount: Math.ceil(Number(totalRes.count) / data.limit),
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET RECOVERY SUMMARY
// Aggregation counts for dashboard banners.
// ═══════════════════════════════════════════════════════════════════════════
export const getRecoverySummaryFn = createServerFn()
  .middleware([requireSalesRecoveryViewMiddleware])
  .inputValidator((input: any) => z.object({}).parse(input))
  .handler(async () => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Due today: non-closed slips with creditReturnDate <= today
    const dueTodayInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(
        isNotNull(invoices.creditReturnDate),
        lte(invoices.creditReturnDate, todayEnd),
      ));
    const dueTodayIds = dueTodayInvoices.map((i) => i.id);

    const [dueTodayCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(slipRecords)
      .where(and(
        ne(slipRecords.status, "closed"),
        inArray(slipRecords.invoiceId, dueTodayIds),
      ));

    // Recovery queue counts by status
    const statusCounts = await db
      .select({
        status: slipRecords.recoveryStatus,
        count: sql<number>`count(*)`,
      })
      .from(slipRecords)
      .where(isNotNull(slipRecords.recoveryStatus))
      .groupBy(slipRecords.recoveryStatus);

    // Total outstanding in recovery
    const [outstandingRes] = await db
      .select({ total: sql<number>`sum(${slipRecords.amountDue})` })
      .from(slipRecords)
      .where(isNotNull(slipRecords.recoveryStatus));

    return {
      dueToday: Number(dueTodayCount.count) || 0,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s.count])),
      totalOutstanding: Number(outstandingRes.total) || 0,
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGN RECOVERY PERSON (Manual Assignment)
// Users manually assign a recovery person to a slip. No auto-assignment.
// ═══════════════════════════════════════════════════════════════════════════
export const assignRecoveryPersonFn = createServerFn()
  .middleware([requireSalesRecoveryManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      slipId: z.string().min(1),
      recoveryAssignedToId: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(slipRecords)
      .set({
        recoveryAssignedToId: data.recoveryAssignedToId,
        updatedAt: new Date(),
      })
      .where(eq(slipRecords.id, data.slipId))
      .returning();

    if (!updated) throw new Error("Slip not found");
    return updated;
  });

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE RECOVERY STATUS (Manual Control)
// Any authorized user can set any status at any time.
// Removed auto-assignment - status is purely manual.
// ═══════════════════════════════════════════════════════════════════════════
export const updateRecoveryStatusFn = createServerFn()
  .middleware([requireSalesRecoveryManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      slipId: z.string().min(1),
      recoveryStatus: z.enum(["pending", "in_progress", "partially_paid", "overdue", "defaulted"]),
      notes: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(slipRecords)
      .set({
        recoveryStatus: data.recoveryStatus,
        updatedAt: new Date(),
      })
      .where(eq(slipRecords.id, data.slipId))
      .returning();

    if (!updated) throw new Error("Slip not found");
    return updated;
  });

// ═══════════════════════════════════════════════════════════════════════════
// ESCALATE RECOVERY (Manual Control)
// Increments escalationLevel. Status is NOT auto-changed.
// Users must manually update status if needed.
// ═══════════════════════════════════════════════════════════════════════════
export const escalateRecoveryFn = createServerFn()
  .middleware([requireSalesRecoveryManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      slipId: z.string().min(1),
      reason: z.string().min(1, "Escalation reason is required"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const slip = await db.query.slipRecords.findFirst({
      where: eq(slipRecords.id, data.slipId),
    });

    if (!slip) throw new Error("Slip not found");

    const newLevel = (slip.escalationLevel ?? 0) + 1;

    const [updated] = await db
      .update(slipRecords)
      .set({
        escalationLevel: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(slipRecords.id, data.slipId))
      .returning();

    return updated;
  });

// ═══════════════════════════════════════════════════════════════════════════
// DE-ESCALATE RECOVERY
// Decrements escalationLevel (minimum 0).
// ═══════════════════════════════════════════════════════════════════════════
export const deEscalateRecoveryFn = createServerFn()
  .middleware([requireSalesRecoveryManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      slipId: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const slip = await db.query.slipRecords.findFirst({
      where: eq(slipRecords.id, data.slipId),
    });

    if (!slip) throw new Error("Slip not found");

    const newLevel = Math.max(0, (slip.escalationLevel ?? 0) - 1);

    const [updated] = await db
      .update(slipRecords)
      .set({
        escalationLevel: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(slipRecords.id, data.slipId))
      .returning();

    return updated;
  });

// ═══════════════════════════════════════════════════════════════════════════
// CREATE RECOVERY ATTEMPT
// Logs an attempt. Auto-updates lastFollowUpDate and nextFollowUpDate.
// ═══════════════════════════════════════════════════════════════════════════
export const createRecoveryAttemptFn = createServerFn()
  .middleware([requireSalesRecoveryManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      slipId: z.string().min(1),
      assignedToId: z.string().optional(),
      attemptMethod: z.enum(["call", "visit", "whatsapp", "letter", "other"]).default("call"),
      attemptOutcome: z.enum(["no_answer", "promised", "partial_payment", "refused", "unreachable", "resolved"]).default("no_answer"),
      amountPromised: z.number().nonnegative().optional(),
      promisedDate: z.string().optional(), // ISO date string
      notes: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const slip = await db.query.slipRecords.findFirst({
      where: eq(slipRecords.id, data.slipId),
    });
    if (!slip) throw new Error("Slip not found");

    const attempt = await db.insert(creditRecoveryAttempts).values({
      id: createId(),
      slipId: data.slipId,
      assignedToId: data.assignedToId || null,
      attemptMethod: data.attemptMethod,
      attemptOutcome: data.attemptOutcome,
      amountPromised: data.amountPromised?.toString(),
      promisedDate: data.promisedDate ? new Date(data.promisedDate) : null,
      notes: data.notes,
      attemptedAt: new Date(),
    }).returning();

    // Update slip follow-up dates
    let nextFollowUp: Date;
    if (data.attemptOutcome === "promised" && data.promisedDate) {
      nextFollowUp = new Date(data.promisedDate);
    } else {
      nextFollowUp = new Date();
      nextFollowUp.setDate(nextFollowUp.getDate() + 3);
    }

    await db
      .update(slipRecords)
      .set({
        lastFollowUpDate: new Date(),
        nextFollowUpDate: nextFollowUp,
        updatedAt: new Date(),
      })
      .where(eq(slipRecords.id, data.slipId));

    return attempt[0];
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET RECOVERY ATTEMPTS
// Timeline for a slip.
// ═══════════════════════════════════════════════════════════════════════════
export const getRecoveryAttemptsFn = createServerFn()
  .middleware([requireSalesRecoveryViewMiddleware])
  .inputValidator((input: any) =>
    z.object({ slipId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    return await db.query.creditRecoveryAttempts.findMany({
      where: eq(creditRecoveryAttempts.slipId, data.slipId),
      with: {
        assignedTo: { columns: { id: true, name: true } },
      },
      orderBy: [desc(creditRecoveryAttempts.attemptedAt)],
    });
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET SLIP DETAIL
// Full slip information for escalation sheet.
// ═══════════════════════════════════════════════════════════════════════════
export const getSlipDetailFn = createServerFn()
  .middleware([requireSalesRecoveryViewMiddleware])
  .inputValidator((input: any) =>
    z.object({ slipId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const slip = await db.query.slipRecords.findFirst({
      where: eq(slipRecords.id, data.slipId),
      with: {
        invoice: {
          columns: {
            id: true,
            date: true,
            totalPrice: true,
            cash: true,
            credit: true,
            creditReturnDate: true,
            slipNumber: true,
          },
        },
        customer: {
          columns: {
            id: true,
            name: true,
            city: true,
            mobileNumber: true,
            customerType: true,
          },
        },
      },
    });

    if (!slip) throw new Error("Slip not found");

    // Get recovery attempts
    const attempts = await db.query.creditRecoveryAttempts.findMany({
      where: eq(creditRecoveryAttempts.slipId, data.slipId),
      orderBy: [desc(creditRecoveryAttempts.attemptedAt)],
      limit: 10,
    });

    return { slip, attempts };
  });

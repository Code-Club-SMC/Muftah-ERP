import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { orders, orderItems, orderBookerTrips, commissionRecords } from "@/db/schemas/sales-erp-schema";
import { orderBookers } from "@/db/schemas/sales-erp-schema";
import { tadaRates } from "@/db/schemas/hr-schema";
import { eq, and, gte, lte, desc, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  requireOrderBookerViewMiddleware,
  requireOrderBookerOrdersManageMiddleware,
  requireOrderBookerTripsManageMiddleware,
} from "@/lib/middlewares";
import { createOrderSchema } from "@/db/zod_schemas";
import { AppError, InternalError } from "@/lib/errors";

// ═══════════════════════════════════════════════════════════════════════════
// ORDER BOOKER SELF-SERVICE
// All functions look up the order booker by session.user.id via userId link.
// ═══════════════════════════════════════════════════════════════════════════

const ORDER_BOOKER_PROFILE_REQUIRED = "ORDER_BOOKER_PROFILE_REQUIRED";
const ORDER_BOOKER_PROFILE_INACTIVE = "ORDER_BOOKER_PROFILE_INACTIVE";
const ORDER_BOOKER_EMPLOYEE_INACTIVE = "ORDER_BOOKER_EMPLOYEE_INACTIVE";

type OrderBookerProfile = NonNullable<
  Awaited<ReturnType<typeof db.query.orderBookers.findFirst>>
>;

type OrderBookerPortalAccess =
  | {
      allowed: true;
      profile: OrderBookerProfile;
    }
  | {
      allowed: false;
      reason:
        | typeof ORDER_BOOKER_PROFILE_REQUIRED
        | typeof ORDER_BOOKER_PROFILE_INACTIVE
        | typeof ORDER_BOOKER_EMPLOYEE_INACTIVE;
      message: string;
    };

async function getOrderBookerPortalAccess(session: any): Promise<OrderBookerPortalAccess> {
  if (!session?.user?.id) {
    throw new InternalError("Unable to verify the current account.");
  }

  try {
    const ob = await db.query.orderBookers.findFirst({
      where: eq(orderBookers.userId, session.user.id),
    });

    if (!ob) {
      return {
        allowed: false,
        reason: ORDER_BOOKER_PROFILE_REQUIRED,
        message: "This account is not linked to an order booker profile.",
      };
    }

    if (ob.status !== "active") {
      return {
        allowed: false,
        reason: ORDER_BOOKER_PROFILE_INACTIVE,
        message: "This order booker profile is inactive. Contact an administrator.",
      };
    }

    if (ob.employeeId) {
      const employee = await db.query.employees.findFirst({
        where: (employee, { eq }) => eq(employee.id, ob.employeeId!),
        columns: {
          status: true,
        },
      });

      if (!employee || employee.status !== "active") {
        return {
          allowed: false,
          reason: ORDER_BOOKER_EMPLOYEE_INACTIVE,
          message:
            "Order booker portal requires an active employee profile. Contact HR.",
        };
      }
    }

    return {
      allowed: true,
      profile: ob,
    };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error("[getOrderBookerPortalAccess] DB error:", error);
      throw new InternalError("Failed to verify your account. Please try again.");
    }

    throw error;
  }
}

async function requireOrderBookerFromSession(session: any) {
  const portalAccess = await getOrderBookerPortalAccess(session);

  if (!portalAccess.allowed) {
    throw new AppError(portalAccess.message, portalAccess.reason, 403);
  }

  return portalAccess.profile;
}

export const getOrderBookerPortalAccessFn = createServerFn()
  .middleware([requireOrderBookerViewMiddleware])
  .handler(async ({ context }) => {
    return getOrderBookerPortalAccess(context.session);
  });

// ---------------------------------------------------------------------------
// Orders — Paginated with filters
// ---------------------------------------------------------------------------

export const getMyOrdersFn = createServerFn()
  .middleware([requireOrderBookerViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        status: z.enum(["pending", "confirmed", "delivered", "returned"]).optional(),
        search: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ob = await requireOrderBookerFromSession(context.session);

    const conditions: any[] = [eq(orders.orderBookerId, ob.id)];
    if (data.status) conditions.push(eq(orders.status, data.status));
    if (data.fromDate) conditions.push(gte(orders.createdAt, new Date(data.fromDate)));
    if (data.toDate) conditions.push(lte(orders.createdAt, new Date(data.toDate)));
    if (data.search) {
      const safeSearch = data.search.replace(/[%_]/g, "");
      if (safeSearch) {
        conditions.push(
          or(
            ilike(orders.shopkeeperName, `%${safeSearch}%`),
            ilike(orders.shopkeeperMobile, `%${safeSearch}%`),
          ),
        );
      }
    }

    const whereClause = and(...conditions);
    const limit = data.limit;
    const offset = (data.page - 1) * limit;

    const [totalRes, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(whereClause),
      db.query.orders.findMany({
        where: whereClause,
        orderBy: [desc(orders.createdAt)],
        limit,
        offset,
        with: {
          items: { with: { product: true } },
        },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total: totalRes[0]?.count ?? 0,
        page: data.page,
        limit,
        totalPages: Math.ceil((totalRes[0]?.count ?? 0) / limit),
      },
    };
  });

export const createMyOrderFn = createServerFn()
  .middleware([requireOrderBookerOrdersManageMiddleware])
  .inputValidator((input: any) => createOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ob = await requireOrderBookerFromSession(context.session);
    const { items, ...rest } = data;

    const [order] = await db
      .insert(orders)
      .values({
        ...rest,
        orderBookerId: ob.id,
        status: "pending",
      })
      .returning();

    if (items?.length) {
      await db.insert(orderItems).values(
        items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          recipeId: item.recipeId,
          unitType: item.unitType,
          quantity: item.quantity,
          rate: String(item.rate),
          amount: String(item.quantity * item.rate),
        })),
      );
    }

    return order;
  });

// ---------------------------------------------------------------------------
// Trips — Paginated with filters
// ---------------------------------------------------------------------------

const tripVehicleTypeSchema = z.enum(["own", "company", "own_vehicle", "company_vehicle"]);

export const getMyTripsFn = createServerFn()
  .middleware([requireOrderBookerViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        vehicleType: tripVehicleTypeSchema.optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ob = await requireOrderBookerFromSession(context.session);

    const conditions: any[] = [eq(orderBookerTrips.orderBookerId, ob.id)];
    if (data.fromDate) conditions.push(gte(orderBookerTrips.tripDate, new Date(data.fromDate)));
    if (data.toDate) conditions.push(lte(orderBookerTrips.tripDate, new Date(data.toDate)));
    if (data.vehicleType) {
      const vt = data.vehicleType;
      const dbValue = vt === "own" ? "own_vehicle" : vt === "company" ? "company_vehicle" : vt;
      conditions.push(eq(orderBookerTrips.vehicleType, dbValue));
    }

    const whereClause = and(...conditions);
    const limit = data.limit;
    const offset = (data.page - 1) * limit;

    const [totalRes, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderBookerTrips)
        .where(whereClause),
      db.query.orderBookerTrips.findMany({
        where: whereClause,
        orderBy: [desc(orderBookerTrips.tripDate)],
        limit,
        offset,
      }),
    ]);

    return {
      data: rows,
      meta: {
        total: totalRes[0]?.count ?? 0,
        page: data.page,
        limit,
        totalPages: Math.ceil((totalRes[0]?.count ?? 0) / limit),
      },
    };
  });

const createTripInputSchema = z.object({
  date: z.string().min(1, "Date is required"),
  areaVisited: z.string().min(1, "Area visited is required"),
  distanceKm: z.number().positive("Distance must be greater than 0"),
  vehicleType: tripVehicleTypeSchema,
  fuelCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const createMyTripFn = createServerFn()
  .middleware([requireOrderBookerTripsManageMiddleware])
  .inputValidator((input: any) => createTripInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ob = await requireOrderBookerFromSession(context.session);

    const activeRate = await db.query.tadaRates.findFirst({
      where: eq(tadaRates.isActive, true),
      orderBy: [desc(tadaRates.effectiveFrom)],
    });

    const tadaAmount = activeRate ? data.distanceKm * Number(activeRate.ratePerKm) : 0;

    const vt = data.vehicleType;
    const dbVehicleType = vt === "own" ? "own_vehicle" : vt === "company" ? "company_vehicle" : vt;

    const [trip] = await db
      .insert(orderBookerTrips)
      .values({
        orderBookerId: ob.id,
        tripDate: new Date(data.date),
        destination: data.areaVisited,
          distanceKm: String(data.distanceKm),
        vehicleType: dbVehicleType,
        fuelCost: dbVehicleType === "own_vehicle" ? String(data.fuelCost || 0) : "0",
        tadaAmount: String(tadaAmount),
        notes: data.notes ?? null,
      })
      .returning();

    return trip;
  });

// ---------------------------------------------------------------------------
// Commission — Paginated with filters
// ---------------------------------------------------------------------------

export const getMyCommissionFn = createServerFn()
  .middleware([requireOrderBookerViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        status: z.enum(["accrued", "paid", "reversed"]).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ob = await requireOrderBookerFromSession(context.session);

    const conditions: any[] = [eq(commissionRecords.orderBookerId, ob.id)];
    if (data.status) conditions.push(eq(commissionRecords.status, data.status));
    if (data.fromDate) conditions.push(gte(commissionRecords.createdAt, new Date(data.fromDate)));
    if (data.toDate) conditions.push(lte(commissionRecords.createdAt, new Date(data.toDate)));

    const whereClause = and(...conditions);
    const limit = data.limit;
    const offset = (data.page - 1) * limit;

    const [totalRes, records, summaryResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(commissionRecords)
        .where(whereClause),
      db.query.commissionRecords.findMany({
        where: whereClause,
        orderBy: [desc(commissionRecords.createdAt)],
        limit,
        offset,
        with: {
          order: { columns: { billNumber: true, shopkeeperName: true } },
        },
      }),
      db
        .select({
          totalAccrued: sql<number>`COALESCE(SUM(CASE WHEN ${commissionRecords.status} = 'accrued' THEN ${commissionRecords.commissionAmount} ELSE 0 END), 0)`,
          totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${commissionRecords.status} = 'paid' THEN ${commissionRecords.commissionAmount} ELSE 0 END), 0)`,
          totalReversed: sql<number>`COALESCE(SUM(CASE WHEN ${commissionRecords.status} = 'reversed' THEN ${commissionRecords.commissionAmount} ELSE 0 END), 0)`,
        })
        .from(commissionRecords)
        .where(whereClause),
    ]);

    const summary = {
      totalAccrued: Number(summaryResult[0]?.totalAccrued ?? 0),
      totalPaid: Number(summaryResult[0]?.totalPaid ?? 0),
      totalReversed: Number(summaryResult[0]?.totalReversed ?? 0),
    };

    return {
      data: records,
      summary,
      meta: {
        total: totalRes[0]?.count ?? 0,
        page: data.page,
        limit,
        totalPages: Math.ceil((totalRes[0]?.count ?? 0) / limit),
      },
    };
  });

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getMyProfileFn = createServerFn()
  .middleware([requireOrderBookerViewMiddleware])
  .handler(async ({ context }) => {
    const ob = await requireOrderBookerFromSession(context.session);
    return ob;
  });

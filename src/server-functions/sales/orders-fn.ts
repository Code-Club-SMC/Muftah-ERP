import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { orders, orderItems, commissionRecords, salesmen } from "@/db/schemas/sales-erp-schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";
import {
  requireSalesOrdersViewMiddleware,
  requireSalesOrdersManageMiddleware,
} from "@/lib/middlewares";
import { calculateCommissionForOrder } from "./order-booker-commission-calc";

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════

export const getOrdersFn = createServerFn()
  .middleware([requireSalesOrdersViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        status: z.enum(["pending", "confirmed", "delivered", "returned"]).optional(),
        orderBookerId: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const conditions: any[] = [];
    if (data.status) conditions.push(eq(orders.status, data.status));
    if (data.orderBookerId) conditions.push(eq(orders.orderBookerId, data.orderBookerId));
    if (data.fromDate) conditions.push(gte(orders.createdAt, new Date(data.fromDate)));
    if (data.toDate) conditions.push(lte(orders.createdAt, new Date(data.toDate)));

    return await db.query.orders.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(orders.createdAt)],
      with: {
        orderBooker: true,
        items: { with: { product: true } },
      },
    });
  });

export const getOrderDetailFn = createServerFn()
  .middleware([requireSalesOrdersViewMiddleware])
  .inputValidator((input: any) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, data.id),
      with: {
        orderBooker: true,
        fulfilledBySalesman: true,
        trip: true,
        items: { with: { product: true } },
      },
    });
    if (!order) throw new Error("Order not found");
    return order;
  });

export const createOrderFn = createServerFn()
  .middleware([requireSalesOrdersManageMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        orderBookerId: z.string().min(1),
        shopkeeperName: z.string().min(1),
        shopkeeperMobile: z.string().optional(),
        shopkeeperAddress: z.string().optional(),
        tripId: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.string().min(1),
            recipeId: z.string().optional(),
            unitType: z.enum(["full_carton", "half_carton", "pack", "shopper"]).default("full_carton"),
            quantity: z.number().int().positive(),
            rate: z.number().nonnegative(),
          }),
        ).min(1),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          orderBookerId: data.orderBookerId,
          shopkeeperName: data.shopkeeperName,
          shopkeeperMobile: data.shopkeeperMobile,
          shopkeeperAddress: data.shopkeeperAddress,
          tripId: data.tripId,
          status: "pending",
          notes: data.notes,
        })
        .returning();

      await tx.insert(orderItems).values(
        data.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          recipeId: item.recipeId,
          unitType: item.unitType,
          quantity: item.quantity,
          rate: item.rate.toString(),
          amount: (item.quantity * item.rate).toString(),
        })),
      );

      return order;
    });
  });

export const updateOrderFn = createServerFn()
  .middleware([requireSalesOrdersManageMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        id: z.string(),
        shopkeeperName: z.string().min(1).optional(),
        shopkeeperMobile: z.string().optional(),
        shopkeeperAddress: z.string().optional(),
        tripId: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    const updateValues: any = {};
    if (updates.shopkeeperName !== undefined) updateValues.shopkeeperName = updates.shopkeeperName;
    if (updates.shopkeeperMobile !== undefined) updateValues.shopkeeperMobile = updates.shopkeeperMobile;
    if (updates.shopkeeperAddress !== undefined) updateValues.shopkeeperAddress = updates.shopkeeperAddress;
    if (updates.tripId !== undefined) updateValues.tripId = updates.tripId;
    if (updates.notes !== undefined) updateValues.notes = updates.notes;
    updateValues.updatedAt = new Date();

    const [updated] = await db
      .update(orders)
      .set(updateValues)
      .where(eq(orders.id, id))
      .returning();
    return updated;
  });

export const deleteOrderFn = createServerFn()
  .middleware([requireSalesOrdersManageMiddleware])
  .inputValidator((input: any) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      await tx.delete(commissionRecords).where(eq(commissionRecords.orderId, data.id));
      await tx.delete(orderItems).where(eq(orderItems.orderId, data.id));
      await tx.delete(orders).where(eq(orders.id, data.id));
    });
    return { success: true };
  });

export const fulfillOrderFn = createServerFn()
  .middleware([requireSalesOrdersManageMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        id: z.string(),
        fulfilledBySalesmanId: z.string().min(1),
        fulfilledAmount: z.number().nonnegative(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, data.id),
      with: { items: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "delivered") throw new Error("Order already fulfilled");

    const salesman = await db.query.salesmen.findFirst({
      where: eq(salesmen.id, data.fulfilledBySalesmanId),
    });
    if (!salesman) throw new Error("Salesman not found");
    if (salesman.status !== "active") throw new Error("Salesman is not active");

    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orders)
        .set({
          status: "delivered",
          fulfilledBySalesmanId: data.fulfilledBySalesmanId,
          fulfilledAt: new Date(),
          fulfilledAmount: data.fulfilledAmount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, data.id))
        .returning();

      // Calculate commission within same transaction
      await calculateCommissionForOrder(
        tx as any,
        order.orderBookerId,
        order.id,
        data.fulfilledAmount,
      );

      return updated;
    });
  });

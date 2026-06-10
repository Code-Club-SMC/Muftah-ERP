import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { customers, invoices } from "@/db/schemas/sales-schema";
import { requireSalesViewMiddleware, requireSalesManageMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { count, like, or, SQL, eq, gt, lt, and, sum as drizzleSum, desc as drizzleDesc, asc as drizzleAsc, gte, lte, isNotNull } from "drizzle-orm";
import { parseISO, isValid } from "date-fns";
import { createId } from "@paralleldrive/cuid2";

// ── Shared sort config ─────────────────────────────────────────────────────
const customerSortFields = {
  name: customers.name,
  totalSale: customers.totalSale,
  credit: customers.credit,
  createdAt: customers.createdAt,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// CREATE CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════
export const createCustomerFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      name: z.string().min(1, "Name is required"),
      mobileNumber: z.string().optional(),
      cnic: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      bankAccount: z.string().optional(),
      customerType: z.enum(["distributor", "retailer", "shopkeeper", "wholesaler"]).default("retailer"),
      defaultMargin: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const [inserted] = await db
      .insert(customers)
      .values({
        id: createId(),
        name: data.name,
        mobileNumber: data.mobileNumber || null,
        cnic: data.cnic || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        bankAccount: data.bankAccount || null,
        customerType: data.customerType,
        defaultMargin: data.defaultMargin || "0",
      })
      .returning();

    return inserted;
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET CUSTOMERS (extended with advanced filters)
// ═══════════════════════════════════════════════════════════════════════════
export const getCustomersFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
        search: z.string().optional(),
        customerType: z.enum(["distributor", "retailer"]).optional(),
        city: z.string().optional(),
        outstandingOnly: z.boolean().default(false),
        sortBy: z.enum(["name", "totalSale", "credit", "createdAt"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const offset = (data.page - 1) * data.limit;
    const conditions: SQL[] = [];

    if (data.search) {
      conditions.push(
        or(
          like(customers.name, `%${data.search}%`),
          like(customers.mobileNumber, `%${data.search}%`),
          like(customers.city, `%${data.search}%`),
        )!,
      );
    }

    if (data.customerType) {
      conditions.push(eq(customers.customerType, data.customerType));
    }

    if (data.city) {
      conditions.push(eq(customers.city, data.city));
    }

    if (data.outstandingOnly) {
      conditions.push(gt(customers.credit, "0"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [total] = await db
      .select({ value: count() })
      .from(customers)
      .where(whereClause);

    const sortColumn = customerSortFields[data.sortBy] ?? customers.createdAt;

    const dataQuery = await db.query.customers.findMany({
      where: whereClause,
      limit: data.limit,
      offset: offset,
      orderBy: data.sortOrder === "asc"
        ? [drizzleAsc(sortColumn)]
        : [drizzleDesc(sortColumn)],
    });

    return {
      data: dataQuery,
      total: total.value,
      pageCount: Math.ceil(Number(total.value) / data.limit),
    };
  });

export const getAllCustomersFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .handler(async () => {
    return await db.query.customers.findMany({
      orderBy: (customers, { asc }) => [asc(customers.name)],
    });
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET CUSTOMER STATS (aggregate KPIs)
// ═══════════════════════════════════════════════════════════════════════════
export const getCustomerStatsFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const [countResult] = await db
      .select({ value: count() })
      .from(customers);

    const revenueConditions: SQL[] = [];
    if (data.dateFrom) {
      const from = parseISO(data.dateFrom);
      if (isValid(from)) revenueConditions.push(gte(invoices.date, from));
    }
    if (data.dateTo) {
      const to = parseISO(data.dateTo);
      if (isValid(to)) revenueConditions.push(lte(invoices.date, to));
    }
    const [totalSalesResult] = await db
      .select({ value: drizzleSum(invoices.totalPrice) })
      .from(invoices)
      .where(revenueConditions.length > 0 ? and(...revenueConditions) : undefined);

    const [totalOutstandingResult] = await db
      .select({ value: drizzleSum(customers.credit) })
      .from(customers)
      .where(gt(customers.credit, "0"));

    const [outstandingCountResult] = await db
      .select({ value: count() })
      .from(customers)
      .where(gt(customers.credit, "0"));

    return {
      totalCustomers: Number(countResult.value) || 0,
      totalSalesRevenue: Number(totalSalesResult.value) || 0,
      totalOutstanding: Number(totalOutstandingResult.value) || 0,
      customersWithOutstanding: Number(outstandingCountResult.value) || 0,
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET CUSTOMER LEDGER (customer detail + invoice history)
// ═══════════════════════════════════════════════════════════════════════════
export const getCustomerLedgerFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      customerId: z.string(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().default(10),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const offset = (data.page - 1) * data.limit;

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, data.customerId),
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Build date-scoped invoice WHERE clause
    const invoiceConditions: SQL[] = [eq(invoices.customerId, data.customerId)];
    if (data.dateFrom) {
      const from = parseISO(data.dateFrom);
      if (isValid(from)) invoiceConditions.push(gte(invoices.date, from));
    }
    if (data.dateTo) {
      const to = parseISO(data.dateTo);
      if (isValid(to)) invoiceConditions.push(lte(invoices.date, to));
    }
    const invoiceWhereClause = and(...invoiceConditions);

    const [totalResult] = await db
      .select({ value: count() })
      .from(invoices)
      .where(invoiceWhereClause);

    const customerInvoices = await db.query.invoices.findMany({
      where: invoiceWhereClause,
      with: { warehouse: true },
      limit: data.limit,
      offset,
      orderBy: [drizzleDesc(invoices.date)],
    });

    // Period aggregates (date-scoped)
    const [aggResult] = await db
      .select({
        periodRevenue: drizzleSum(invoices.totalPrice),
        periodCash:    drizzleSum(invoices.cash),
        periodCredit:  drizzleSum(invoices.credit),
      })
      .from(invoices)
      .where(invoiceWhereClause);

    // Overdue count — all-time, NOT date-scoped
    const [overdueResult] = await db
      .select({ value: count() })
      .from(invoices)
      .where(and(
        eq(invoices.customerId, data.customerId),
        lt(invoices.creditReturnDate, new Date()),
        gt(invoices.credit, "0"),
      ));

    // Next due date — all-time, NOT date-scoped
    const nextDueRow = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.customerId, data.customerId),
        gt(invoices.credit, "0"),
        isNotNull(invoices.creditReturnDate),
      ),
      orderBy: [drizzleAsc(invoices.creditReturnDate)],
      columns: { creditReturnDate: true },
    });

    return {
      customer,
      invoices: customerInvoices,
      total: Number(totalResult.value),
      pageCount: Math.ceil(Number(totalResult.value) / data.limit),
      periodRevenue: Number(aggResult.periodRevenue) || 0,
      periodCash:    Number(aggResult.periodCash) || 0,
      periodCredit:  Number(aggResult.periodCredit) || 0,
      overdueInvoices: Number(overdueResult.value) || 0,
      nextDueDate: nextDueRow?.creditReturnDate ?? null,
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════
export const updateCustomerFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      address: z.string().optional(),
      mobileNumber: z.string().optional(),
      cnic: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      bankAccount: z.string().optional(),
      customerType: z.enum(["distributor", "retailer"]).optional(),
      defaultMargin: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;

    const [updated] = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();

    if (!updated) {
      throw new Error("Customer not found");
    }

    return updated;
  });

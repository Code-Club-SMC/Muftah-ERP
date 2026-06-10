/**
 * Production-ready Ledger Server Functions
 * Fixes: balance calculation, pagination, search, sorting, aging, audit logging
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "@/db";
import { invoices, customers } from "@/db/schemas/sales-schema";
import { payments, slipRecords, salesmen, ledgerExportAuditLog } from "@/db/schemas/sales-erp-schema";
import { requireSalesViewMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import {
  eq,
  and,
  gte,
  lte,
  asc,
  desc,
  sum,
  count,
  inArray,
  lt,
} from "drizzle-orm";
import { parseISO, isValid, differenceInDays } from "date-fns";
import type {
  LedgerEntry,
  LedgerSummary,
  DistributorLedgerResponse,
  SalesmanLedgerResponse,
  AgingAnalysis,
} from "@/lib/ledger-types";

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function parseDateInput(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? parsed : null;
}

function buildDateConditions(
  dateFrom?: string,
  dateTo?: string,
  dateField: any = invoices.date,
) {
  const conditions: any[] = [];
  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInput(dateTo);

  if (fromDate) conditions.push(gte(dateField, fromDate));
  if (toDate) conditions.push(lte(dateField, toDate));

  return conditions;
}

async function logLedgerAccess(params: {
  userId: string;
  userName?: string;
  userEmail?: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  exportType: string;
  periodFrom?: Date;
  periodTo?: Date;
  entryCount?: number;
}) {
  try {
    const headers = getRequestHeaders() as unknown as Record<string, string | undefined>;
    await db.insert(ledgerExportAuditLog).values({
      userId: params.userId,
      userName: params.userName ?? null,
      userEmail: params.userEmail ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName ?? null,
      exportType: params.exportType,
      periodFrom: params.periodFrom ?? null,
      periodTo: params.periodTo ?? null,
      entryCount: params.entryCount ?? 0,
      ipAddress: headers["x-forwarded-for"] ?? headers["x-real-ip"] ?? null,
      userAgent: headers["user-agent"] ?? null,
    });
  } catch (err) {
    // Non-blocking: audit log failure should not break the main operation
    console.error("[Ledger Audit] Failed to log access:", err);
  }
}

function computeAgingAnalysis(entries: LedgerEntry[]): AgingAnalysis {
  const now = new Date();
  const buckets = [
    { label: "Current", days: 0, amount: 0, count: 0, color: "#22c55e" },
    { label: "1-30 Days", days: 30, amount: 0, count: 0, color: "#3b82f6" },
    { label: "31-60 Days", days: 60, amount: 0, count: 0, color: "#f59e0b" },
    { label: "61-90 Days", days: 90, amount: 0, count: 0, color: "#f97316" },
    { label: "90+ Days", days: Infinity, amount: 0, count: 0, color: "#ef4444" },
  ];

  let totalOutstanding = 0;
  let oldestInvoiceDate: Date | null = null;

  for (const entry of entries) {
    if (entry.type === "invoice") {
      const daysOverdue = entry.creditReturnDate
        ? differenceInDays(now, entry.creditReturnDate)
        : differenceInDays(now, entry.date);

      if (!oldestInvoiceDate || entry.date < oldestInvoiceDate) {
        oldestInvoiceDate = entry.date;
      }

      // Only count unpaid/overdue credit amounts
      if (entry.status !== "paid" && entry.credit > 0) {
        totalOutstanding += entry.credit;
        const amount = entry.credit;

        if (daysOverdue <= 0) {
          buckets[0].amount += amount;
          buckets[0].count++;
        } else if (daysOverdue <= 30) {
          buckets[1].amount += amount;
          buckets[1].count++;
        } else if (daysOverdue <= 60) {
          buckets[2].amount += amount;
          buckets[2].count++;
        } else if (daysOverdue <= 90) {
          buckets[3].amount += amount;
          buckets[3].count++;
        } else {
          buckets[4].amount += amount;
          buckets[4].count++;
        }
      }
    }
  }

  return { buckets, totalOutstanding, oldestInvoiceDate };
}

function filterAndSortEntries(
  entries: LedgerEntry[],
  search?: string,
  sortBy?: string,
  sortOrder?: string,
  typeFilter?: string,
): LedgerEntry[] {
  let result = [...entries];

  // Type filter
  if (typeFilter && typeFilter !== "all") {
    result = result.filter((e) => e.type === typeFilter);
  }

  // Search filter
  if (search && search.trim()) {
    const term = search.toLowerCase().trim();
    result = result.filter((e) => {
      if (e.type === "invoice") {
        return (
          (e.slipNumber?.toLowerCase().includes(term) ?? false) ||
          (e.warehouseName?.toLowerCase().includes(term) ?? false) ||
          (e.remarks?.toLowerCase().includes(term) ?? false) ||
          e.items.some((item) => item.pack.toLowerCase().includes(term))
        );
      } else {
        return (
          (e.reference?.toLowerCase().includes(term) ?? false) ||
          e.method.toLowerCase().includes(term) ||
          (e.notes?.toLowerCase().includes(term) ?? false) ||
          (e.invoiceSlipNumber?.toLowerCase().includes(term) ?? false)
        );
      }
    });
  }

  // Sorting
  const order = sortOrder === "desc" ? -1 : 1;
  result.sort((a, b) => {
    switch (sortBy) {
      case "amount": {
        const aAmt = a.type === "invoice" ? a.totalPrice : a.amount;
        const bAmt = b.type === "invoice" ? b.totalPrice : b.amount;
        return (aAmt - bAmt) * order;
      }
      case "balance": {
        return (a.runningBalance - b.runningBalance) * order;
      }
      case "date":
      default:
        return (a.date.getTime() - b.date.getTime()) * order;
    }
  });

  return result;
}

// ── DISTRIBUTOR LEDGER ────────────────────────────────────────────────────

export const generateDistributorLedgerFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        customerId: z.string().min(1, "Customer ID is required"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().int().positive().default(DEFAULT_PAGE),
        limit: z.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
        search: z.string().optional(),
        sortBy: z.enum(["date", "amount", "balance"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        typeFilter: z.enum(["all", "invoice", "payment"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.authContext?.session?.user?.id ?? "unknown";
    const userName = context.authContext?.session?.user?.name ?? "Unknown";
    const userEmail = context.authContext?.session?.user?.email ?? undefined;

    // Validate customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, data.customerId),
      columns: { id: true, name: true, city: true, mobileNumber: true, credit: true, customerType: true },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // ── Compute opening balance from pre-period data ──
    let openingBalance = 0;
    const fromDate = parseDateInput(data.dateFrom);

    if (fromDate) {
      const [preInvoiceAgg] = await db
        .select({ totalCredit: sum(invoices.credit) })
        .from(invoices)
        .where(
          and(
            eq(invoices.customerId, data.customerId),
            lt(invoices.date, fromDate),
          ),
        );

      const [prePaymentAgg] = await db
        .select({ totalPaid: sum(payments.amount) })
        .from(payments)
        .where(
          and(
            eq(payments.customerId, data.customerId),
            lt(payments.paymentDate, fromDate),
          ),
        );

      openingBalance =
        safeNumber(preInvoiceAgg?.totalCredit) -
        safeNumber(prePaymentAgg?.totalPaid);
    }

    // ── Fetch invoices in period ──
    const invoiceConditions = [
      eq(invoices.customerId, data.customerId),
      ...buildDateConditions(data.dateFrom, data.dateTo, invoices.date),
    ];

    const invoiceRows = await db.query.invoices.findMany({
      where: and(...invoiceConditions),
      with: {
        items: {
          columns: {
            id: true,
            pack: true,
            numberOfCartons: true,
            discountCartons: true,
            freeCartons: true,
            quantity: true,
            packsPerCarton: true,
            actualPackSize: true,
            perCartonPrice: true,
            amount: true,
            hsnCode: true,
            retailPrice: true,
          },
        },
        warehouse: { columns: { name: true } },
        salesman: { columns: { name: true } },
      },
      orderBy: [asc(invoices.date), asc(invoices.sNo)],
    });

    // ── Fetch slip records ──
    const slipMap = new Map<string, { status: string | null; amountDue: string; recoveryStatus: string | null }>();
    const slipRows = await db.query.slipRecords.findMany({
      where: eq(slipRecords.customerId, data.customerId),
      columns: { invoiceId: true, status: true, amountDue: true, recoveryStatus: true },
    });
    slipRows.forEach((s) => {
      if (s.invoiceId) {
        slipMap.set(s.invoiceId, {
          status: s.status ?? null,
          amountDue: s.amountDue,
          recoveryStatus: s.recoveryStatus ?? null,
        });
      }
    });

    // ── Fetch payments in period ──
    const paymentConditions = [
      eq(payments.customerId, data.customerId),
      ...buildDateConditions(data.dateFrom, data.dateTo, payments.paymentDate),
    ];

    const paymentRows = await db.query.payments.findMany({
      where: and(...paymentConditions),
      orderBy: [asc(payments.paymentDate), asc(payments.createdAt)],
      columns: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        paymentDate: true,
        invoiceId: true,
      },
    });

    // Build invoice slip number map for payment linking
    const invoiceSlipMap = new Map<string, string>();
    invoiceRows.forEach((inv) => {
      if (inv.id && inv.slipNumber) {
        invoiceSlipMap.set(inv.id, inv.slipNumber);
      }
    });

    // ── Merge into chronological ledger entries with running balance ──
    const entries: LedgerEntry[] = [];
    const timeline: Array<{ date: Date; kind: "invoice" | "payment"; idx: number }> = [];

    invoiceRows.forEach((inv, i) =>
      timeline.push({ date: new Date(inv.date), kind: "invoice", idx: i }),
    );
    paymentRows.forEach((pay, i) =>
      timeline.push({ date: new Date(pay.paymentDate), kind: "payment", idx: i }),
    );

    // Sort by date, then by kind (invoices before payments on same date for consistency)
    timeline.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      // On same date, invoices come before payments; stable tie-breaker by idx
      if (a.kind === b.kind) return a.idx - b.idx;
      return a.kind === "invoice" ? -1 : 1;
    });

    let runningBalance = openingBalance;

    for (const t of timeline) {
      if (t.kind === "invoice") {
        const inv = invoiceRows[t.idx];
        const totalPrice = safeNumber(inv.totalPrice);
        const cash = safeNumber(inv.cash);
        const credit = safeNumber(inv.credit);
        const expenses = safeNumber(inv.expenses);
        const slipInfo = inv.id ? slipMap.get(inv.id) : null;

        runningBalance += credit;
        entries.push({
          type: "invoice",
          id: inv.id,
          date: new Date(inv.date),
          slipNumber: inv.slipNumber,
          warehouseName: inv.warehouse?.name ?? null,
          totalPrice,
          cash,
          credit,
          status: inv.status,
          runningBalance,
          items: inv.items.map((item) => ({
            id: item.id,
            pack: item.pack,
            numberOfCartons: item.numberOfCartons,
            discountCartons: item.discountCartons,
            freeCartons: item.freeCartons,
            quantity: item.quantity,
            packsPerCarton: item.packsPerCarton,
            actualPackSize: item.actualPackSize,
            perCartonPrice: item.perCartonPrice,
            amount: item.amount,
            hsnCode: item.hsnCode,
            retailPrice: item.retailPrice,
          })),
          expenses,
          expensesDescription: inv.expensesDescription ?? null,
          creditReturnDate: inv.creditReturnDate ?? null,
          remarks: inv.remarks ?? null,
          slipStatus: slipInfo?.status ?? null,
          slipRecoveryStatus: slipInfo?.recoveryStatus ?? null,
          slipAmountDue: safeNumber(slipInfo?.amountDue),
        });
      } else {
        const pay = paymentRows[t.idx];
        const amount = safeNumber(pay.amount);
        const invoiceSlipNumber = pay.invoiceId
          ? invoiceSlipMap.get(pay.invoiceId) ?? null
          : null;

        // BUG FIX: Removed Math.max(0, ...) to correctly handle overpayments
        runningBalance -= amount;
        entries.push({
          type: "payment",
          id: pay.id,
          date: new Date(pay.paymentDate),
          reference: pay.reference,
          method: pay.method,
          amount,
          notes: pay.notes,
          runningBalance,
          invoiceId: pay.invoiceId,
          invoiceSlipNumber,
        });
      }
    }

    // ── Period aggregates ──
    const [agg] = await db
      .select({
        totalSales: sum(invoices.totalPrice),
        totalCash: sum(invoices.cash),
        totalCredit: sum(invoices.credit),
        invoiceCount: count(),
      })
      .from(invoices)
      .where(and(...invoiceConditions));

    const [payAgg] = await db
      .select({ totalPaid: sum(payments.amount), paymentCount: count() })
      .from(payments)
      .where(and(...paymentConditions));

    const summary: LedgerSummary = {
      openingBalance,
      closingBalance: runningBalance,
      periodTotalSales: safeNumber(agg?.totalSales),
      periodTotalCash: safeNumber(agg?.totalCash),
      periodTotalCredit: safeNumber(agg?.totalCredit),
      periodPayments: safeNumber(payAgg?.totalPaid),
      invoiceCount: Number(agg?.invoiceCount) || 0,
      paymentCount: Number(payAgg?.paymentCount) || 0,
      overdueAmount: 0,
      aging30: 0,
      aging60: 0,
      aging90: 0,
    };

    // ── Compute aging analysis ──
    const aging = computeAgingAnalysis(entries);
    summary.overdueAmount = aging.totalOutstanding;
    summary.aging30 = aging.buckets[1].amount;
    summary.aging60 = aging.buckets[2].amount;
    summary.aging90 = aging.buckets[3].amount + aging.buckets[4].amount;

    // ── Apply search, filter, sort ──
    const filteredEntries = filterAndSortEntries(
      entries,
      data.search,
      data.sortBy,
      data.sortOrder,
      data.typeFilter,
    );

    // ── Pagination ──
    const totalEntries = filteredEntries.length;
    const pageCount = Math.ceil(totalEntries / data.limit);
    const page = Math.min(data.page, Math.max(1, pageCount)) || 1;
    const offset = (page - 1) * data.limit;
    const paginatedEntries = filteredEntries.slice(offset, offset + data.limit);

    // ── Audit Log ──
    await logLedgerAccess({
      userId,
      userName,
      userEmail,
      entityType: "distributor",
      entityId: data.customerId,
      entityName: customer.name,
      exportType: "view",
      periodFrom: fromDate ?? undefined,
      periodTo: parseDateInput(data.dateTo) ?? undefined,
      entryCount: totalEntries,
    });

    const response: DistributorLedgerResponse = {
      customer: {
        id: customer.id,
        name: customer.name,
        city: customer.city,
        mobileNumber: customer.mobileNumber,
        credit: customer.credit,
        customerType: customer.customerType,
      },
      entries: paginatedEntries,
      summary,
      generatedAt: new Date().toISOString(),
      generatedBy: userName,
      page,
      pageCount,
      totalEntries,
    };

    return response;
  });

// ── SALESMAN LEDGER ───────────────────────────────────────────────────────

export const generateSalesmanLedgerFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        salesmanId: z.string().min(1, "Salesman ID is required"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().int().positive().default(DEFAULT_PAGE),
        limit: z.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
        search: z.string().optional(),
        sortBy: z.enum(["date", "amount", "balance"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        typeFilter: z.enum(["all", "invoice", "payment"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.authContext?.session?.user?.id ?? "unknown";
    const userName = context.authContext?.session?.user?.name ?? "Unknown";
    const userEmail = context.authContext?.session?.user?.email ?? undefined;

    const salesman = await db.query.salesmen.findFirst({
      where: eq(salesmen.id, data.salesmanId),
      columns: { id: true, name: true },
    });
    if (!salesman) throw new Error("Salesman not found");

    const linkedCustomers = await db.query.customers.findMany({
      where: eq(customers.salesmanId, data.salesmanId),
      columns: { id: true, name: true },
    });
    const customerIds = linkedCustomers.map((c) => c.id);

    if (customerIds.length === 0) {
      return {
        salesman: { id: salesman.id, name: salesman.name },
        entries: [],
        summary: {
          openingBalance: 0,
          closingBalance: 0,
          periodTotalSales: 0,
          periodTotalCash: 0,
          periodTotalCredit: 0,
          periodPayments: 0,
          invoiceCount: 0,
          paymentCount: 0,
          overdueAmount: 0,
          aging30: 0,
          aging60: 0,
          aging90: 0,
        },
        generatedAt: new Date().toISOString(),
        generatedBy: userName,
        page: 1,
        pageCount: 1,
        totalEntries: 0,
      } satisfies SalesmanLedgerResponse;
    }

    // ── Compute opening balance from pre-period data ──
    let openingBalance = 0;
    const fromDate = parseDateInput(data.dateFrom);
    if (fromDate) {
      const [preInvoiceAgg] = await db
        .select({ totalCredit: sum(invoices.credit) })
        .from(invoices)
        .where(and(inArray(invoices.customerId, customerIds), lt(invoices.date, fromDate)));
      const [prePaymentAgg] = await db
        .select({ totalPaid: sum(payments.amount) })
        .from(payments)
        .where(and(inArray(payments.customerId, customerIds), lt(payments.paymentDate, fromDate)));
      openingBalance = safeNumber(preInvoiceAgg?.totalCredit) - safeNumber(prePaymentAgg?.totalPaid);
    }

    const invConditions = [
      inArray(invoices.customerId, customerIds),
      ...buildDateConditions(data.dateFrom, data.dateTo, invoices.date),
    ];

    const invoiceRows = await db.query.invoices.findMany({
      where: and(...invConditions),
      with: {
        customer: { columns: { name: true } },
        warehouse: { columns: { name: true } },
      },
      orderBy: [asc(invoices.date), asc(invoices.sNo)],
    });

    const payConditions = [
      inArray(payments.customerId, customerIds),
      ...buildDateConditions(data.dateFrom, data.dateTo, payments.paymentDate),
    ];

    const paymentRows = await db.query.payments.findMany({
      where: and(...payConditions),
      orderBy: [asc(payments.paymentDate), asc(payments.createdAt)],
      columns: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        paymentDate: true,
        customerId: true,
      },
    });

    const customerMap = new Map(linkedCustomers.map((c) => [c.id, c.name]));

    const entries: LedgerEntry[] = [];
    const timeline: Array<{ date: Date; kind: "invoice" | "payment"; idx: number }> = [];
    invoiceRows.forEach((inv, i) =>
      timeline.push({ date: new Date(inv.date), kind: "invoice", idx: i }),
    );
    paymentRows.forEach((pay, i) =>
      timeline.push({ date: new Date(pay.paymentDate), kind: "payment", idx: i }),
    );
    timeline.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.kind === b.kind) return a.idx - b.idx;
      return a.kind === "invoice" ? -1 : 1;
    });

    let runningBalance = openingBalance;
    for (const t of timeline) {
      if (t.kind === "invoice") {
        const inv = invoiceRows[t.idx];
        const credit = safeNumber(inv.credit);
        runningBalance += credit;
        entries.push({
          type: "invoice",
          id: inv.id,
          date: new Date(inv.date),
          slipNumber: inv.slipNumber,
          warehouseName: inv.warehouse?.name ?? null,
          totalPrice: safeNumber(inv.totalPrice),
          cash: safeNumber(inv.cash),
          credit,
          status: inv.status,
          runningBalance,
          items: [],
          expenses: 0,
          expensesDescription: null,
          creditReturnDate: null,
          remarks: null,
          slipStatus: null,
          slipRecoveryStatus: null,
          slipAmountDue: 0,
          customerName: inv.customer?.name ?? null,
        } as LedgerEntry);
      } else {
        const pay = paymentRows[t.idx];
        const amount = safeNumber(pay.amount);
        // BUG FIX: Removed Math.max(0, ...)
        runningBalance -= amount;
        entries.push({
          type: "payment",
          id: pay.id,
          date: new Date(pay.paymentDate),
          reference: pay.reference,
          method: pay.method,
          amount,
          notes: pay.notes,
          runningBalance,
          invoiceId: null,
          invoiceSlipNumber: null,
          customerName: customerMap.get(pay.customerId) ?? null,
        } as LedgerEntry);
      }
    }

    const [agg] = await db
      .select({
        totalSales: sum(invoices.totalPrice),
        totalCash: sum(invoices.cash),
        totalCredit: sum(invoices.credit),
        invoiceCount: count(),
      })
      .from(invoices)
      .where(and(...invConditions));

    const [payAgg] = await db
      .select({ totalPaid: sum(payments.amount), paymentCount: count() })
      .from(payments)
      .where(and(...payConditions));

    const summary: LedgerSummary = {
      openingBalance,
      closingBalance: runningBalance,
      periodTotalSales: safeNumber(agg?.totalSales),
      periodTotalCash: safeNumber(agg?.totalCash),
      periodTotalCredit: safeNumber(agg?.totalCredit),
      periodPayments: safeNumber(payAgg?.totalPaid),
      invoiceCount: Number(agg?.invoiceCount) || 0,
      paymentCount: Number(payAgg?.paymentCount) || 0,
      overdueAmount: 0,
      aging30: 0,
      aging60: 0,
      aging90: 0,
    };

    const aging = computeAgingAnalysis(entries);
    summary.overdueAmount = aging.totalOutstanding;
    summary.aging30 = aging.buckets[1].amount;
    summary.aging60 = aging.buckets[2].amount;
    summary.aging90 = aging.buckets[3].amount + aging.buckets[4].amount;

    const filteredEntries = filterAndSortEntries(
      entries,
      data.search,
      data.sortBy,
      data.sortOrder,
      data.typeFilter,
    );

    const totalEntries = filteredEntries.length;
    const pageCount = Math.ceil(totalEntries / data.limit);
    const page = Math.min(data.page, Math.max(1, pageCount)) || 1;
    const offset = (page - 1) * data.limit;
    const paginatedEntries = filteredEntries.slice(offset, offset + data.limit);

    await logLedgerAccess({
      userId,
      userName,
      userEmail,
      entityType: "salesman",
      entityId: data.salesmanId,
      entityName: salesman.name,
      exportType: "view",
      periodFrom: parseDateInput(data.dateFrom) ?? undefined,
      periodTo: parseDateInput(data.dateTo) ?? undefined,
      entryCount: totalEntries,
    });

    return {
      salesman: { id: salesman.id, name: salesman.name },
      entries: paginatedEntries,
      summary,
      generatedAt: new Date().toISOString(),
      generatedBy: userName,
      page,
      pageCount,
      totalEntries,
    } satisfies SalesmanLedgerResponse;
  });

// ── EXPORT AUDIT LOG QUERY ────────────────────────────────────────────────

// ── SALESMAN SUMMARY (retained for backward compatibility) ─────────────────

export const getSalesmanSummaryFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        salesmanId: z.string(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const salesman = await db.query.salesmen.findFirst({
      where: eq(salesmen.id, data.salesmanId),
    });
    if (!salesman) throw new Error("Salesman not found");

    const linkedCustomers = await db.query.customers.findMany({
      where: eq(customers.salesmanId, data.salesmanId),
      columns: {
        id: true,
        name: true,
        city: true,
        credit: true,
        customerType: true,
        mobileNumber: true,
        email: true,
      },
    });
    const customerIds = linkedCustomers.map((c) => c.id);

    if (customerIds.length === 0) {
      return {
        salesman,
        customers: [],
        totalSales: 0,
        totalCredit: 0,
        totalCash: 0,
        outstandingBalance: 0,
        invoiceCount: 0,
      };
    }

    const conditions = [inArray(invoices.customerId, customerIds)];
    if (data.dateFrom) {
      const f = parseISO(data.dateFrom);
      if (isValid(f)) conditions.push(gte(invoices.date, f));
    }
    if (data.dateTo) {
      const t = parseISO(data.dateTo);
      if (isValid(t)) conditions.push(lte(invoices.date, t));
    }

    const [agg] = await db
      .select({
        totalSales: sum(invoices.totalPrice),
        totalCredit: sum(invoices.credit),
        totalCash: sum(invoices.cash),
        invoiceCount: count(),
      })
      .from(invoices)
      .where(and(...conditions));

    const customersWithBalance = linkedCustomers.map((c) => ({
      ...c,
      outstandingBalance: safeNumber(c.credit),
    }));

    const totalOutstanding = customersWithBalance.reduce(
      (acc, c) => acc + c.outstandingBalance,
      0,
    );

    return {
      salesman,
      customers: customersWithBalance,
      totalSales: safeNumber(agg?.totalSales),
      totalCredit: safeNumber(agg?.totalCredit),
      totalCash: safeNumber(agg?.totalCash),
      outstandingBalance: totalOutstanding,
      invoiceCount: Number(agg?.invoiceCount) || 0,
    };
  });

// ── SALESMAN-SHOP LEDGER (retained for backward compatibility) ─────────────

export const getSalesmanShopLedgerFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        salesmanId: z.string(),
        customerId: z.string(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const salesman = await db.query.salesmen.findFirst({
      where: eq(salesmen.id, data.salesmanId),
    });
    if (!salesman) throw new Error("Salesman not found");

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, data.customerId),
    });
    if (!customer) throw new Error("Customer not found");

    const conditions = [
      eq(invoices.customerId, data.customerId),
      eq(invoices.salesmanId, data.salesmanId),
    ];
    if (data.dateFrom) {
      const f = parseISO(data.dateFrom);
      if (isValid(f)) conditions.push(gte(invoices.date, f));
    }
    if (data.dateTo) {
      const t = parseISO(data.dateTo);
      if (isValid(t)) conditions.push(lte(invoices.date, t));
    }

    const invoiceRows = await db.query.invoices.findMany({
      where: and(...conditions),
      with: {
        items: {
          columns: {
            pack: true,
            numberOfCartons: true,
            discountCartons: true,
            freeCartons: true,
            quantity: true,
            perCartonPrice: true,
            amount: true,
          },
        },
        warehouse: { columns: { name: true } },
      },
      orderBy: [asc(invoices.date)],
    });

    const payConditions = [eq(payments.customerId, data.customerId)];
    if (data.dateFrom) {
      const f = parseISO(data.dateFrom);
      if (isValid(f)) payConditions.push(gte(payments.paymentDate, f));
    }
    if (data.dateTo) {
      const t = parseISO(data.dateTo);
      if (isValid(t)) payConditions.push(lte(payments.paymentDate, t));
    }

    const paymentRows = await db.query.payments.findMany({
      where: and(...payConditions),
      orderBy: [asc(payments.paymentDate)],
      columns: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        paymentDate: true,
      },
    });

    type ShopLedgerEntry =
      | {
          type: "invoice";
          date: Date;
          slipNumber: string | null;
          warehouseName: string | null;
          totalPrice: number;
          cash: number;
          credit: number;
          status: string;
          runningBalance: number;
          items: any[];
        }
      | {
          type: "payment";
          date: Date;
          reference: string | null;
          method: string;
          amount: number;
          notes: string | null;
          runningBalance: number;
        };

    const entries: ShopLedgerEntry[] = [];
    const timeline: Array<{ date: Date; kind: "invoice" | "payment"; idx: number }> = [];
    invoiceRows.forEach((inv, i) =>
      timeline.push({ date: new Date(inv.date), kind: "invoice", idx: i }),
    );
    paymentRows.forEach((pay, i) =>
      timeline.push({ date: new Date(pay.paymentDate), kind: "payment", idx: i }),
    );
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    for (const t of timeline) {
      if (t.kind === "invoice") {
        const inv = invoiceRows[t.idx];
        const credit = safeNumber(inv.credit);
        runningBalance += credit;
        entries.push({
          type: "invoice",
          date: new Date(inv.date),
          slipNumber: inv.slipNumber,
          warehouseName: inv.warehouse?.name ?? null,
          totalPrice: safeNumber(inv.totalPrice),
          cash: safeNumber(inv.cash),
          credit,
          status: inv.status,
          runningBalance,
          items: inv.items,
        });
      } else {
        const pay = paymentRows[t.idx];
        const amount = safeNumber(pay.amount);
        runningBalance -= amount;
        entries.push({
          type: "payment",
          date: new Date(pay.paymentDate),
          reference: pay.reference,
          method: pay.method,
          amount,
          notes: pay.notes,
          runningBalance,
        });
      }
    }

    const [agg] = await db
      .select({
        totalSales: sum(invoices.totalPrice),
        totalCash: sum(invoices.cash),
        totalCredit: sum(invoices.credit),
        invoiceCount: count(),
      })
      .from(invoices)
      .where(and(...conditions));

    const [payAgg] = await db
      .select({ totalPaid: sum(payments.amount) })
      .from(payments)
      .where(and(...payConditions));

    return {
      salesman,
      customer,
      entries,
      openingBalance: 0,
      closingBalance: runningBalance,
      periodTotalSales: safeNumber(agg?.totalSales),
      periodTotalCash: safeNumber(agg?.totalCash),
      periodTotalCredit: safeNumber(agg?.totalCredit),
      periodPayments: safeNumber(payAgg?.totalPaid),
      invoiceCount: Number(agg?.invoiceCount) || 0,
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// SHOPKEEPER LEDGER (Full parity with distributor ledger)
// ═══════════════════════════════════════════════════════════════════════════
export const generateShopkeeperLedgerFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        customerId: z.string().min(1, "Customer ID is required"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().int().positive().default(DEFAULT_PAGE),
        limit: z.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
        search: z.string().optional(),
        sortBy: z.enum(["date", "amount", "balance"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        typeFilter: z.enum(["all", "invoice", "payment"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.authContext?.session?.user?.id ?? "unknown";
    const userName = context.authContext?.session?.user?.name ?? "Unknown";
    const userEmail = context.authContext?.session?.user?.email ?? undefined;

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, data.customerId),
      columns: { id: true, name: true, city: true, mobileNumber: true, credit: true, customerType: true },
    });
    if (!customer) throw new Error("Customer not found");

    // ── Compute opening balance from pre-period data ──
    let openingBalance = 0;
    const fromDate = parseDateInput(data.dateFrom);
    if (fromDate) {
      const [preInvoiceAgg] = await db
        .select({ totalCredit: sum(invoices.credit) })
        .from(invoices)
        .where(and(eq(invoices.customerId, data.customerId), lt(invoices.date, fromDate)));
      const [prePaymentAgg] = await db
        .select({ totalPaid: sum(payments.amount) })
        .from(payments)
        .where(and(eq(payments.customerId, data.customerId), lt(payments.paymentDate, fromDate)));
      openingBalance = safeNumber(preInvoiceAgg?.totalCredit) - safeNumber(prePaymentAgg?.totalPaid);
    }

    // ── Fetch invoices in period ──
    const invoiceConditions = [
      eq(invoices.customerId, data.customerId),
      ...buildDateConditions(data.dateFrom, data.dateTo, invoices.date),
    ];
    const invoiceRows = await db.query.invoices.findMany({
      where: and(...invoiceConditions),
      with: {
        items: {
          columns: {
            id: true,
            pack: true,
            numberOfCartons: true,
            discountCartons: true,
            freeCartons: true,
            quantity: true,
            packsPerCarton: true,
            actualPackSize: true,
            perCartonPrice: true,
            amount: true,
            hsnCode: true,
            retailPrice: true,
          },
        },
        warehouse: { columns: { name: true } },
        salesman: { columns: { name: true } },
      },
      orderBy: [asc(invoices.date), asc(invoices.sNo)],
    });

    // ── Fetch slip records ──
    const slipMap = new Map<string, { status: string | null; amountDue: string; recoveryStatus: string | null }>();
    const slipRows = await db.query.slipRecords.findMany({
      where: eq(slipRecords.customerId, data.customerId),
      columns: { invoiceId: true, status: true, amountDue: true, recoveryStatus: true },
    });
    slipRows.forEach((s) => {
      if (s.invoiceId) {
        slipMap.set(s.invoiceId, {
          status: s.status ?? null,
          amountDue: s.amountDue,
          recoveryStatus: s.recoveryStatus ?? null,
        });
      }
    });

    // ── Fetch payments in period ──
    const paymentConditions = [
      eq(payments.customerId, data.customerId),
      ...buildDateConditions(data.dateFrom, data.dateTo, payments.paymentDate),
    ];
    const paymentRows = await db.query.payments.findMany({
      where: and(...paymentConditions),
      orderBy: [asc(payments.paymentDate), asc(payments.createdAt)],
      columns: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        paymentDate: true,
        invoiceId: true,
      },
    });

    // Build invoice slip number map for payment linking
    const invoiceSlipMap = new Map<string, string>();
    invoiceRows.forEach((inv) => {
      if (inv.id && inv.slipNumber) {
        invoiceSlipMap.set(inv.id, inv.slipNumber);
      }
    });

    // ── Merge into chronological ledger entries with running balance ──
    const entries: LedgerEntry[] = [];
    const timeline: Array<{ date: Date; kind: "invoice" | "payment"; idx: number }> = [];
    invoiceRows.forEach((inv, i) => timeline.push({ date: new Date(inv.date), kind: "invoice", idx: i }));
    paymentRows.forEach((pay, i) => timeline.push({ date: new Date(pay.paymentDate), kind: "payment", idx: i }));
    timeline.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.kind === b.kind) return a.idx - b.idx;
      return a.kind === "invoice" ? -1 : 1;
    });

    let runningBalance = openingBalance;
    for (const t of timeline) {
      if (t.kind === "invoice") {
        const inv = invoiceRows[t.idx];
        const totalPrice = safeNumber(inv.totalPrice);
        const cash = safeNumber(inv.cash);
        const credit = safeNumber(inv.credit);
        const expenses = safeNumber(inv.expenses);
        const slipInfo = inv.id ? slipMap.get(inv.id) : null;

        runningBalance += credit;
        entries.push({
          type: "invoice",
          id: inv.id,
          date: new Date(inv.date),
          slipNumber: inv.slipNumber,
          warehouseName: inv.warehouse?.name ?? null,
          totalPrice,
          cash,
          credit,
          status: inv.status,
          runningBalance,
          items: inv.items.map((item) => ({
            id: item.id,
            pack: item.pack,
            numberOfCartons: item.numberOfCartons,
            discountCartons: item.discountCartons,
            freeCartons: item.freeCartons,
            quantity: item.quantity,
            packsPerCarton: item.packsPerCarton,
            actualPackSize: item.actualPackSize,
            perCartonPrice: item.perCartonPrice,
            amount: item.amount,
            hsnCode: item.hsnCode,
            retailPrice: item.retailPrice,
          })),
          expenses,
          expensesDescription: inv.expensesDescription ?? null,
          creditReturnDate: inv.creditReturnDate ?? null,
          remarks: inv.remarks ?? null,
          slipStatus: slipInfo?.status ?? null,
          slipRecoveryStatus: slipInfo?.recoveryStatus ?? null,
          slipAmountDue: safeNumber(slipInfo?.amountDue),
        });
      } else {
        const pay = paymentRows[t.idx];
        const amount = safeNumber(pay.amount);
        const invoiceSlipNumber = pay.invoiceId ? invoiceSlipMap.get(pay.invoiceId) ?? null : null;

        runningBalance -= amount;
        entries.push({
          type: "payment",
          id: pay.id,
          date: new Date(pay.paymentDate),
          reference: pay.reference,
          method: pay.method,
          amount,
          notes: pay.notes,
          runningBalance,
          invoiceId: pay.invoiceId,
          invoiceSlipNumber,
        });
      }
    }

    // ── Period aggregates ──
    const [agg] = await db
      .select({
        totalSales: sum(invoices.totalPrice),
        totalCash: sum(invoices.cash),
        totalCredit: sum(invoices.credit),
        invoiceCount: count(),
      })
      .from(invoices)
      .where(and(...invoiceConditions));

    const [payAgg] = await db
      .select({ totalPaid: sum(payments.amount), paymentCount: count() })
      .from(payments)
      .where(and(...paymentConditions));

    const summary: LedgerSummary = {
      openingBalance,
      closingBalance: runningBalance,
      periodTotalSales: safeNumber(agg?.totalSales),
      periodTotalCash: safeNumber(agg?.totalCash),
      periodTotalCredit: safeNumber(agg?.totalCredit),
      periodPayments: safeNumber(payAgg?.totalPaid),
      invoiceCount: Number(agg?.invoiceCount) || 0,
      paymentCount: Number(payAgg?.paymentCount) || 0,
      overdueAmount: 0,
      aging30: 0,
      aging60: 0,
      aging90: 0,
    };

    // ── Compute aging analysis ──
    const aging = computeAgingAnalysis(entries);
    summary.overdueAmount = aging.totalOutstanding;
    summary.aging30 = aging.buckets[1].amount;
    summary.aging60 = aging.buckets[2].amount;
    summary.aging90 = aging.buckets[3].amount + aging.buckets[4].amount;

    // ── Apply search, filter, sort ──
    const filteredEntries = filterAndSortEntries(
      entries,
      data.search,
      data.sortBy,
      data.sortOrder,
      data.typeFilter,
    );

    // ── Pagination ──
    const totalEntries = filteredEntries.length;
    const pageCount = Math.ceil(totalEntries / data.limit);
    const page = Math.min(data.page, Math.max(1, pageCount)) || 1;
    const offset = (page - 1) * data.limit;
    const paginatedEntries = filteredEntries.slice(offset, offset + data.limit);

    // ── Audit Log ──
    await logLedgerAccess({
      userId,
      userName,
      userEmail,
      entityType: "shopkeeper",
      entityId: data.customerId,
      entityName: customer.name,
      exportType: "view",
      periodFrom: fromDate ?? undefined,
      periodTo: parseDateInput(data.dateTo) ?? undefined,
      entryCount: totalEntries,
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        city: customer.city,
        mobileNumber: customer.mobileNumber,
        credit: customer.credit,
        customerType: customer.customerType,
      },
      entries: paginatedEntries,
      summary,
      generatedAt: new Date().toISOString(),
      generatedBy: userName,
      page,
      pageCount,
      totalEntries,
    };
  });

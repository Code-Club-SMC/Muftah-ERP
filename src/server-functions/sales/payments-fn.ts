import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { createId } from "@paralleldrive/cuid2";
import { customers } from "@/db/schemas/sales-schema";
import { payments } from "@/db/schemas/sales-erp-schema";
import { transactions, wallets } from "@/db/schemas/finance-schema";
import {
  requireSalesManageMiddleware,
  requireSalesViewMiddleware,
} from "@/lib/middlewares";
import { createPaymentSchema } from "@/db/zod_schemas";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { expenses } from "@/db/schemas/finance-schema";

export const createPaymentFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) => createPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;

    return await db.transaction(async (tx) => {
      // 1. Verify customer
      const customer = await tx.query.customers.findFirst({
        where: eq(customers.id, data.customerId),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      // 2. Insert payment record
      const [payment] = await tx
        .insert(payments)
        .values({
          id: createId(),
          customerId: data.customerId,
          invoiceId: data.invoiceId,
          amount: data.amount.toString(),
          method: data.method,
          reference: data.reference,
          notes: data.notes,
          recordedById: userId,
          paymentDate: new Date(),
        })
        .returning();

      // 3. Update customer ledger
      // A payment increases `payment` total and decreases `credit` balance
      await tx
        .update(customers)
        .set({
          payment: sql`${customers.payment} + ${data.amount}`,
          // Prevent credit from going negative
          credit: sql`GREATEST(${customers.credit} - ${data.amount}, 0)`,
        })
        .where(eq(customers.id, data.customerId));

      // 4. Update wallet and create transaction if walletId is provided
      if (data.walletId && (data.method === "cash" || data.method === "bank_transfer")) {
        const wallet = await tx.query.wallets.findFirst({
          where: eq(wallets.id, data.walletId),
        });

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        await tx
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${data.amount}` })
          .where(eq(wallets.id, data.walletId));

        await tx.insert(transactions).values({
          id: createId(),
          walletId: data.walletId,
          type: "credit",
          amount: data.amount.toString(),
          referenceId: payment.id,
          source: "Payment Recovery",
          performedById: userId,
        });
      }

      return payment;
    });
  });

export const getPaymentsFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator(
    z.object({
      customerId: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const offset = (data.page - 1) * data.limit;

    const filters = [];

    if (data.customerId) {
      filters.push(eq(payments.customerId, data.customerId));
    }

    if (data.dateFrom) {
      filters.push(gte(payments.paymentDate, new Date(data.dateFrom)));
    }

    if (data.dateTo) {
      const endOfDay = new Date(data.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filters.push(lte(payments.paymentDate, endOfDay));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const results = await db.query.payments.findMany({
      where: whereClause,
      with: {
        customer: true,
        recordedBy: {
          columns: { name: true },
        },
      },
      limit: data.limit,
      offset,
      orderBy: [desc(payments.paymentDate)],
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(whereClause);

    return {
      data: results,
      total: Number(totalResult[0]?.count || 0),
      pageCount: Math.ceil(Number(totalResult[0]?.count || 0) / data.limit),
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// RECORD EXPENSE OFFSET
// Simultaneously creates a payment record AND a company expense entry.
// Use when a customer credit balance is offset against a legitimate
// business expense (e.g. delivery fuel reimbursed from their balance).
// ═══════════════════════════════════════════════════════════════════════════
export const recordExpenseOffsetFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) =>
    z
      .object({
        customerId: z.string().min(1),
        invoiceId: z.string().min(1, "Invoice is required - every payment must be linked to an invoice"),
        amount: z.number().positive(),
        expenseDescription: z.string().min(1),
        expenseCategoryId: z.string().min(1),
        expenseCategory: z.string().min(1),
        walletId: z.string().min(1),
        notes: z.string().optional(),
        reference: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;

    return await db.transaction(async (tx) => {
      const customer = await tx.query.customers.findFirst({
        where: eq(customers.id, data.customerId),
      });
      if (!customer) throw new Error("Customer not found");

      const wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.id, data.walletId),
      });
      if (!wallet) throw new Error("Wallet not found");

      // 1. Payment record (reduces customer credit)
      const [payment] = await tx
        .insert(payments)
        .values({
          id: createId(),
          customerId: data.customerId,
          invoiceId: data.invoiceId,
          amount: data.amount.toString(),
          method: "expense_offset",
          reference: data.reference,
          expenseType: data.expenseCategory,
          notes: data.notes,
          recordedById: userId,
          paymentDate: new Date(),
        })
        .returning();

      // 2. Update customer ledger
      await tx
        .update(customers)
        .set({
          payment: sql`${customers.payment} + ${data.amount}`,
          credit: sql`GREATEST(${customers.credit} - ${data.amount}, 0)`,
        })
        .where(eq(customers.id, data.customerId));

      // 3. Company expense entry
      const expenseId = createId();
      await tx.insert(expenses).values({
        id: expenseId,
        description: data.expenseDescription,
        category: data.expenseCategory,
        categoryId: data.expenseCategoryId,
        amount: data.amount.toString(),
        walletId: data.walletId,
        performedById: userId,
        slipNumber: data.reference,
        remarks: `Expense offset against customer: ${customer.name}`,
      });

      // 4. Wallet debit transaction
      await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${data.amount}` })
        .where(eq(wallets.id, data.walletId));

      await tx.insert(transactions).values({
        id: createId(),
        walletId: data.walletId,
        type: "debit",
        amount: data.amount.toString(),
        referenceId: expenseId,
        source: "Expense Offset",
        performedById: userId,
      });

      return payment;
    });
  });

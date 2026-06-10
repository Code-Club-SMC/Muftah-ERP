import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  decimal,
  pgTable,
  text,
  timestamp,
  integer,
  serial,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { recipes, warehouses } from "./inventory-schema";
import { user } from "./auth-schema";
import { salesmen, discountRules } from "./sales-erp-schema";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// --- CUSTOMERS ---
export const customers = pgTable("customers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sNo: serial("s_no"),
  name: text("name").notNull(),
  address: text("address"),
  cnic: text("cnic"),
  city: text("city"),
  state: text("state"),
  bankAccount: text("bank_account"),
  mobileNumber: text("mobile_number"),
  totalSale: decimal("total_sale", { precision: 12, scale: 2 }).default("0"),
  payment: decimal("payment", { precision: 12, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0"),
  weightSaleKg: decimal("weight_sale_kg", { precision: 12, scale: 3 }).default(
    "0",
  ),
  expenses: decimal("expenses", { precision: 12, scale: 2 }).default("0"),
  averagePerKg: decimal("average_per_kg", { precision: 12, scale: 2 }).default(
    "0",
  ),
  averageKgWithExpense: decimal("average_kg_with_expense", {
    precision: 12,
    scale: 2,
  }).default("0"),
  expenseAverage: decimal("expense_average", {
    precision: 12,
    scale: 2,
  }).default("0"),
  customerType: text("customer_type").notNull().default("retailer"), // "distributor" | "retailer" | "shopkeeper" | "wholesaler"
  salesmanId: text("salesman_id").references(() => salesmen.id),
  defaultMargin: decimal("default_margin", { precision: 5, scale: 2 }).default("0"), // distributor default margin %
  ...timestamps,
});

// --- INVOICES ---
export const invoices = pgTable("invoices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sNo: serial("s_no"),
  date: timestamp("date").notNull().defaultNow(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  account: text("account"), // e.g., bank or cash account
  cash: decimal("cash", { precision: 12, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0"),
  creditReturnDate: timestamp("credit_return_date"),
  expenses: decimal("expenses", { precision: 12, scale: 2 }).default("0"),
  expensesDescription: text("expenses_description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  slipNumber: text("slip_number"),
  remarks: text("remarks"),

  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  performedById: text("performed_by_id")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull().default("saved"), // "draft" | "saved" | "paid" | "partially_paid" | "voided"
  salesmanId: text("salesman_id").references(() => salesmen.id),
  ...timestamps,
});

// --- INVOICE ITEMS ---
export const invoiceItems = pgTable("invoice_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  pack: text("pack").notNull(),
  recipeId: text("recipe_id").references(() => recipes.id), // For stock checks against Finished Goods
  numberOfCartons: integer("number_of_cartons").notNull().default(0),
  quantity: integer("quantity").notNull().default(0), // Loose units
  packsPerCarton: integer("packs_per_carton").notNull().default(0),
  totalWeight: decimal("total_weight", { precision: 12, scale: 3 })
    .notNull()
    .default("0"),
  perCartonPrice: decimal("per_carton_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountCartons: integer("discount_cartons").notNull().default(0),
  hsnCode: text("hsn_code").notNull(),
  retailPrice: decimal("retail_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  margin: decimal("margin", { precision: 12, scale: 2 }).notNull().default("0"),
  tpPrice: decimal("tp_price", { precision: 12, scale: 2 }),
  marginPercent: decimal("margin_percent", { precision: 12, scale: 2 }),
  actualPackSize: integer("actual_pack_size").default(0),
  discountRuleId: text("discount_rule_id").references(() => discountRules.id),
  freeCartons: integer("free_cartons").default(0),
  isPriceOverride: boolean("is_price_override").default(false),
  costOfGoodsSold: decimal("cost_of_goods_sold", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  costOfGoodsSoldPerUnit: decimal("cost_of_goods_sold_per_unit", {
    precision: 10,
    scale: 4,
  })
    .notNull()
    .default("0"),
  ...timestamps,
}, (table) => ({
  discountRuleIdx: index("idx_invoice_items_discount_rule").on(table.discountRuleId),
}));

// --- RELATIONS ---

export const customersRelations = relations(customers, ({ many }) => ({
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  salesman: one(salesmen, {
    fields: [invoices.salesmanId],
    references: [salesmen.id],
  }),
  items: many(invoiceItems),
  warehouse: one(warehouses, {
    fields: [invoices.warehouseId],
    references: [warehouses.id],
  }),
  performer: one(user, {
    fields: [invoices.performedById],
    references: [user.id],
  }),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  recipe: one(recipes, {
    fields: [invoiceItems.recipeId],
    references: [recipes.id],
  }),
  discountRule: one(discountRules, {
    fields: [invoiceItems.discountRuleId],
    references: [discountRules.id],
  }),
}));

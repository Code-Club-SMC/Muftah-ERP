import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./schemas/auth-schema";
import * as financeSchema from "./schemas/finance-schema";
import * as inventorySchema from "./schemas/inventory-schema";
import * as manufacturingSchema from "./schemas/manufacturing-schema";
import * as salesSchema from "./schemas/sales-schema";
import * as salesErpSchema from "./schemas/sales-erp-schema";
import * as coreSuppliers from "./schemas/core-suppliers";
import * as supplierSchema from "./schemas/supplier-schema";
import * as hrSchema from "./schemas/hr-schema";
import * as rbacSchema from "./schemas/rbac-schema";

const schema = {
  ...authSchema,
  ...inventorySchema,
  ...manufacturingSchema,
  ...salesSchema,
  ...salesErpSchema,
  ...financeSchema,
  ...supplierSchema,
  ...coreSuppliers,
  ...hrSchema,
  ...rbacSchema,
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const shouldUseRailwaySsl =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "staging" ||
  process.env.DATABASE_SSL === "true";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: shouldUseRailwaySsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

process.on("SIGTERM", async () => {
  await pool.end();
});

export const db = drizzle(pool, { schema: schema });

export const { account, session, twoFactor, user, verification } = authSchema;
export const {
  warehouses,
  chemicals,
  packagingMaterials,
  materialStock,
  finishedGoodsStock,
  recipes,
  products,
  productionRuns,
  stockTransfers,
  inventoryAuditLog,
  productionMaterialsUsed,
} = inventorySchema;
export const {
  cartons,
  adjustmentLog,
  stockCountSessions,
  stockCountLines,
  returnRecords,
  returnLines,
  integrityAlerts,
} = manufacturingSchema;
export const { customers, invoices, invoiceItems } = salesSchema;
export const {
  salesmen,
  discountRules,
  payments,
  slipRecords,
  priceChangeLog,
  orderBookers,
  orders,
  orderItems,
  orderBookerTrips,
  commissionTiers,
  commissionRecords,
  creditRecoveryAttempts,
  recipePrices,
  ledgerExportAuditLog,
  salesPerformanceLogs,
} = salesErpSchema;
export const { wallets, expenses, transactions } = financeSchema;
export const { supplierPayments, purchaseRecords } = supplierSchema;
export const { suppliers } = coreSuppliers;
export const { employees, attendance, payrolls, payslips, salaryRevisions, salaryAdvances, nightShiftRates, tadaRates, travelLogs, advanceInstallments, bradfordAuditLog, bradfordSnapshots } = hrSchema;
export const { appPermissions, appRolePermissions, appRoles, userRoleAssignments } =
  rbacSchema;

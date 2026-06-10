/**
 * Shared types and interfaces for the Ledger module
 * Used by Distributor, Shopkeeper, and Salesman ledgers
 *
 * LEDGER ACCOUNTING CONVENTIONS:
 * ───────────────────────────────────────────────────────────────────────────
 * In double-entry bookkeeping for customer/vendor ledgers:
 *
 * DEBIT (Left side):
 *   - Increases what the customer OWES us (credit sales)
 *   - Decreases what we owe the customer (overpayments, refunds)
 *   - In our context: Invoice credit amounts are DEBIT entries
 *
 * CREDIT (Right side):
 *   - Decreases what the customer owes us (payments received)
 *   - Increases what we owe the customer (overpayments)
 *   - In our context: Payment amounts are CREDIT entries
 *
 * RUNNING BALANCE:
 *   - Positive balance = Customer owes us money (accounts receivable)
 *   - Negative balance = We owe customer money (overpayment/refund due)
 *   - Zero balance = Account is settled
 *
 * OPENING BALANCE:
 *   - The balance at the START of the selected date range
 *   - Calculated as: (sum of all pre-period invoice credits) - (sum of all pre-period payments)
 *   - If no date range selected: Opening balance = 0 (shows all-time transactions)
 *
 * CLOSING BALANCE:
 *   - The balance at the END of the selected date range
 *   - Calculated as: Opening Balance + Period Credits - Period Payments
 *   - This is the customer's current outstanding amount
 *
 * CASH vs CREDIT on Invoices:
 *   - cash: Amount paid immediately (reduces balance immediately)
 *   - credit: Amount to be paid later (adds to balance)
 *   - totalPrice = cash + credit (total invoice value)
 *
 * AGING ANALYSIS:
 *   - Current: Credit not yet past due date
 *   - 1-30 Days: Past due by 1-30 days
 *   - 31-60 Days: Past due by 31-60 days
 *   - 61-90 Days: Past due by 61-90 days
 *   - 90+ Days: Past due by more than 90 days (highest risk)
 */

// ── Base Ledger Entry ─────────────────────────────────────────────────────

export interface LedgerInvoiceItem {
  id: string;
  pack: string;
  numberOfCartons: number;
  discountCartons: number;
  freeCartons: number | null;
  quantity: number;
  packsPerCarton: number;
  actualPackSize: number | null;
  perCartonPrice: string;
  amount: string;
  hsnCode: string;
  retailPrice: string;
}

export interface LedgerInvoiceEntry {
  type: "invoice";
  id: string;
  date: Date;
  slipNumber: string | null;
  warehouseName: string | null;
  totalPrice: number;
  cash: number;
  credit: number;
  status: string;
  runningBalance: number;
  items: LedgerInvoiceItem[];
  expenses: number;
  expensesDescription: string | null;
  creditReturnDate: Date | null;
  remarks: string | null;
  slipStatus: string | null;
  slipRecoveryStatus: string | null;
  slipAmountDue: number;
  customerName?: string | null;
}

export interface LedgerPaymentEntry {
  type: "payment";
  id: string;
  date: Date;
  reference: string | null;
  method: string;
  amount: number;
  notes: string | null;
  runningBalance: number;
  invoiceId: string | null;
  invoiceSlipNumber: string | null;
  customerName?: string | null;
}

export type LedgerEntry = LedgerInvoiceEntry | LedgerPaymentEntry;

// ── Ledger Summary ────────────────────────────────────────────────────────

export interface LedgerSummary {
  openingBalance: number;
  closingBalance: number;
  periodTotalSales: number;
  periodTotalCash: number;
  periodTotalCredit: number;
  periodPayments: number;
  invoiceCount: number;
  paymentCount: number;
  overdueAmount: number;
  aging30: number;
  aging60: number;
  aging90: number;
}

// ─– Ledger Customer Info ─────────────────────────────────────────────────

export interface LedgerCustomerInfo {
  id: string;
  name: string;
  city?: string | null;
  mobileNumber?: string | null;
  credit?: string | number | null;
  customerType?: string | null;
}

// ── Full Ledger Response ──────────────────────────────────────────────────

export interface DistributorLedgerResponse {
  customer: LedgerCustomerInfo;
  entries: LedgerEntry[];
  summary: LedgerSummary;
  generatedAt: string;
  generatedBy: string;
  page: number;
  pageCount: number;
  totalEntries: number;
}

export interface SalesmanLedgerResponse {
  salesman: {
    id: string;
    name: string;
  };
  entries: LedgerEntry[];
  summary: LedgerSummary;
  generatedAt: string;
  generatedBy: string;
  page: number;
  pageCount: number;
  totalEntries: number;
}

// ─– Pagination & Filter Params ────────────────────────────────────────────

export interface LedgerQueryParams {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "date" | "amount" | "balance";
  sortOrder?: "asc" | "desc";
  typeFilter?: "all" | "invoice" | "payment";
}

export interface DistributorLedgerParams extends LedgerQueryParams {
  customerId: string;
}

export interface SalesmanLedgerParams extends LedgerQueryParams {
  salesmanId: string;
}

export interface ShopkeeperLedgerParams extends LedgerQueryParams {
  customerId: string;
}

export interface ShopkeeperLedgerResponse {
  customer: LedgerCustomerInfo;
  entries: LedgerEntry[];
  summary: LedgerSummary;
  generatedAt: string;
  generatedBy: string;
  page: number;
  pageCount: number;
  totalEntries: number;
}

// ── Export Config ───────────────────────────────────────────────────────────

export interface LedgerExportColumn {
  key: string;
  label: string;
  format?: (value: any, entry: LedgerEntry) => string;
  includeInCsv?: boolean;
  includeInPrint?: boolean;
}

export interface LedgerExportConfig {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  columns: LedgerExportColumn[];
  includeLineItems?: boolean;
  includeSummary?: boolean;
  watermark?: {
    text: string;
    opacity?: number;
  };
}

// ── Aging Data ────────────────────────────────────────────────────────────

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color: string;
}

export interface AgingAnalysis {
  buckets: AgingBucket[];
  totalOutstanding: number;
  oldestInvoiceDate: Date | null;
}

// ─– Audit Log ───────────────────────────────────────────────────────────────

export interface LedgerExportAudit {
  id?: string;
  userId: string;
  userName: string;
  customerId: string;
  customerName: string;
  exportType: "csv" | "pdf" | "print" | "email";
  periodFrom?: string;
  periodTo?: string;
  entryCount: number;
  generatedAt: Date;
  ipAddress?: string;
}

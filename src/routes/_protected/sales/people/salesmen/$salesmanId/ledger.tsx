/**
 * Salesman Ledger Page
 * Production-ready with pagination, search, sorting, aging, export, audit logging
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { type DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Search,
  ArrowUpDown,
  Clock,
  User,
  RefreshCw,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Package,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/currency-format";
import { generateSalesmanLedgerFn } from "@/server-functions/sales/ledger-fn";
import { DatePickerWithRange } from "@/components/custom/date-range-picker";
import { LedgerPrintExport } from "@/components/sales/ledger-print-export";
import type {
  LedgerEntry,
  SalesmanLedgerResponse,
} from "@/lib/ledger-types";

export const Route = createFileRoute(
  "/_protected/sales/people/salesmen/$salesmanId/ledger",
)({
  component: SalesmanLedgerPage,
});

function SalesmanLedgerPage() {
  const { salesmanId } = Route.useParams();
  const router = useRouter();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "balance">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "payment">("all");
  const [searchInput, setSearchInput] = useState("");

  const dateFrom = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const dateTo = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSort = (column: "date" | "amount" | "balance") => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<SalesmanLedgerResponse>({
    queryKey: [
      "salesman-ledger",
      salesmanId,
      dateFrom,
      dateTo,
      page,
      search,
      sortBy,
      sortOrder,
      typeFilter,
    ],
    queryFn: () =>
      generateSalesmanLedgerFn({
        data: {
          salesmanId,
          dateFrom,
          dateTo,
          page,
          limit: 50,
          search: search || undefined,
          sortBy,
          sortOrder,
          typeFilter,
        },
      }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleDateChange = (d: DateRange | undefined) => {
    setDateRange(d ?? { from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    setPage(1);
  };

  if (isLoading) {
    return <LedgerSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-sm font-medium text-destructive max-w-md text-center">
          {(error as any)?.message || "Failed to load ledger. Please try again."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.history.back()}>
            Go Back
          </Button>
          <Button variant="default" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn("size-4 mr-2", isRefetching && "animate-spin")} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { salesman, entries, summary, generatedAt, pageCount, totalEntries } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2"
          onClick={() => router.history.back()}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{salesman.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-3" />
              Salesman Ledger · {summary.invoiceCount} invoice{summary.invoiceCount !== 1 ? "s" : ""}
            </span>
            {generatedAt && (
              <span className="flex items-center gap-1" title={`Generated by ${data.generatedBy}`}>
                <Clock className="size-3" />
                Updated {format(new Date(generatedAt), "dd MMM yyyy HH:mm")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-4", isRefetching && "animate-spin")} />
            Refresh
          </Button>
          <LedgerPrintExport
            title="Salesman Ledger"
            subtitle={salesman.name}
            periodLabel={`${dateFrom || "All"} to ${dateTo || "All"}`}
            entries={entries}
            summary={summary}
            watermark={data.generatedBy}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Period</p>
          <DatePickerWithRange
            date={dateRange}
            onDateChange={handleDateChange}
            className="w-64"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Type</p>
          <Select
            value={typeFilter}
            onValueChange={(v: any) => {
              setTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entries</SelectItem>
              <SelectItem value="invoice">Invoices Only</SelectItem>
              <SelectItem value="payment">Payments Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
          <p className="text-xs font-medium text-muted-foreground">Search</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search customers, references..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8"
            />
          </div>
        </div>

        <Button size="sm" onClick={handleSearch} className="mb-0.5">
          Search
        </Button>

        {search && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
            className="mb-0.5"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Sales" value={summary.periodTotalSales} color="text-emerald-700" />
        <SummaryCard label="Cash" value={summary.periodTotalCash} color="text-blue-700" />
        <SummaryCard label="Credit" value={summary.periodTotalCredit} color="text-rose-700" />
        <SummaryCard
          label="Closing Balance"
          value={summary.closingBalance}
          color={summary.closingBalance > 0 ? "text-red-700" : "text-green-700"}
        />
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="text-[11px] cursor-pointer select-none"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center gap-1">
                  Date
                  {sortBy === "date" && <ArrowUpDown className="size-3" />}
                </div>
              </TableHead>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">Reference</TableHead>
              <TableHead className="text-[11px]">Customer</TableHead>
              <TableHead
                className="text-[11px] text-right cursor-pointer select-none"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end gap-1">
                  Debit
                  {sortBy === "amount" && <ArrowUpDown className="size-3" />}
                </div>
              </TableHead>
              <TableHead
                className="text-[11px] text-right cursor-pointer select-none"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end gap-1">
                  Credit
                  {sortBy === "amount" && <ArrowUpDown className="size-3" />}
                </div>
              </TableHead>
              <TableHead
                className="text-[11px] text-right cursor-pointer select-none"
                onClick={() => handleSort("balance")}
              >
                <div className="flex items-center justify-end gap-1">
                  Balance
                  {sortBy === "balance" && <ArrowUpDown className="size-3" />}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                  No ledger entries for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry: LedgerEntry) => (
                <LedgerTableRow key={entry.id} entry={entry} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pageCount} · {totalEntries} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                let pageNum: number;
                if (pageCount <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= pageCount - 2) {
                  pageNum = pageCount - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "ghost"}
                    size="sm"
                    className="size-8 p-0 text-xs"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl border bg-card">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
        {label}
      </p>
      <p className={cn("text-xl font-bold tabular-nums", color)}>
        {formatPKR(value, false)}
      </p>
    </div>
  );
}

function LedgerTableRow({ entry }: { entry: LedgerEntry }) {
  const isInvoice = entry.type === "invoice";

  return (
    <TableRow>
      <TableCell className="text-sm whitespace-nowrap">
        {format(new Date(entry.date), "dd MMM yyyy")}
      </TableCell>
      <TableCell>
        {isInvoice ? (
          <Badge variant="default" className="text-[10px] gap-1">
            <FileText className="size-3" /> Invoice
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200">
            <Wallet className="size-3" /> Payment
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {isInvoice ? (
          <span className="flex items-center gap-1">
            <Package className="size-3 text-muted-foreground" />
            {entry.slipNumber || "—"}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="size-3 text-emerald-500" />
            {entry.reference || entry.method}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        <span className="flex items-center gap-1">
          <Store className="size-3 text-muted-foreground" />
          {entry.customerName || "—"}
        </span>
      </TableCell>
      <TableCell className="text-sm text-right tabular-nums">
        {isInvoice ? (
          <span className="text-rose-600 font-medium flex items-center justify-end gap-1">
            <ArrowUpRight className="size-3" />
            {formatPKR(entry.credit, false)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-right tabular-nums">
        {!isInvoice ? (
          <span className="text-emerald-600 font-medium flex items-center justify-end gap-1">
            <ArrowDownLeft className="size-3" />
            {formatPKR(entry.amount, false)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-right font-bold tabular-nums">
        {formatPKR(entry.runningBalance, false)}
      </TableCell>
    </TableRow>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-8 w-24" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-80" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

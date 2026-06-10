import { useState } from "react";
import { DataTable } from "@/components/custom/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useGetInvoices } from "@/hooks/sales/use-invoices";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, ReceiptText, Plus, X, SlidersHorizontal, Search,
} from "lucide-react";
import { DatePickerWithRange } from "@/components/custom/date-range-picker";
import { type DateRange } from "react-day-picker";
import { GenericEmpty } from "@/components/custom/empty";
import { cn } from "@/lib/utils";
import { SalesEmptyIllustration } from "@/components/illustrations/SalesEmptyIllustration";
import { InvoicesEmptyIllustration } from "../illustrations/InvoicesEmptyIllustration";

type Props = {
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
};

const PKR = (v: number) => `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

export const InvoicesTable = ({ onSheetOpenChange }: Props) => {
  const [page, setPage] = useState(1);
  const limit = 7;

  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Raw input value — does NOT trigger search on change
  const [searchInput, setSearchInput] = useState("");
  // Committed value — only updated when Search button is clicked
  const [committedSearch, setCommittedSearch] = useState("");

  const dateFrom = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const dateTo = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  const hasFilters = !!committedSearch;

  const { data } = useGetInvoices({
    page,
    limit,
    dateFrom,
    dateTo,
    search: committedSearch || undefined,
  });

  const invoices = data?.data || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  const handleSearch = () => {
    setCommittedSearch(searchInput.trim());
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearFilters = () => {
    setSearchInput("");
    setCommittedSearch("");
    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    setPage(1);
  };

  if (total === 0 && !hasFilters) {
    return (
      <GenericEmpty
        icon={InvoicesEmptyIllustration}
        title="No Invoices Found"
        description="You haven't generated any invoices yet. Start your first transaction."
        ctaText="Create Invoice"
        onAddChange={onSheetOpenChange}
      />
    );
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "slipNumber",
      header: "Invoice No.",
      cell: ({ row }) => (
        <span className="text-sm font-mono font-medium text-primary tabular-nums">
          {row.original.slipNumber || "—"}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {format(new Date(row.original.date), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {row.original.customer?.name || "Cash / Walk-in"}
          </span>
          {row.original.customer?.customerType && (
            <span className="text-[10px] text-muted-foreground capitalize">
              {row.original.customer.customerType}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "totalPrice",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums text-sm">
          {PKR(Number(row.original.totalPrice))}
        </span>
      ),
    },
    {
      accessorKey: "cash",
      header: "Cash Paid",
      cell: ({ row }) => {
        const val = Number(row.original.cash);
        return (
          <span className={cn("tabular-nums text-sm font-medium", val > 0 ? "text-green-600" : "text-muted-foreground")}>
            {PKR(val)}
          </span>
        );
      },
    },
    {
      accessorKey: "credit",
      header: "Credit",
      cell: ({ row }) => {
        const val = Number(row.original.credit);
        return val > 0 ? (
          <Badge variant="destructive" className="tabular-nums font-semibold text-xs">
            {PKR(val)}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
            Settled
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ReceiptText className="size-4" />
          <span>
            {total} invoice{total !== 1 ? "s" : ""}
            {hasFilters && " (filtered)"}
          </span>
        </div>
        <Button onClick={() => onSheetOpenChange?.(true)} size="sm" className="gap-2">
          <Plus className="size-4" />
          New Invoice
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-muted/20 p-4 rounded-xl border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground self-end mb-2">
          <SlidersHorizontal className="size-3.5" />
          Filters
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date Range</Label>
          <DatePickerWithRange
            date={dateRange}
            onDateChange={(d) => {
              setDateRange(d ?? { from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
              setPage(1);
            }}
            className="w-64"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoice-search" className="text-xs text-muted-foreground">Invoice No.</Label>
          <div className="flex items-center gap-2">
            <Input
              id="invoice-search"
              placeholder="e.g. INV-42"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-36 h-9 text-sm font-mono"
              aria-label="Search invoices by invoice number"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSearch}
              className="h-9 gap-1.5 px-3"
            >
              <Search className="size-3.5" aria-hidden="true" />
              Search
            </Button>
          </div>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground h-9 self-end">
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Empty state for filtered results */}
      {total === 0 && hasFilters ? (
        <GenericEmpty
          className="py-12"
          icon={SalesEmptyIllustration}
          title="No Results Found"
          description="No invoices matched your search for the selected period. Try a different invoice number or adjust the date range."
          ctaText="Clear Filters"
          onAddChange={clearFilters}
        />
      ) : (
        <>
          <DataTable columns={columns} data={invoices} showSearch={false} showPagination={false} />

          {/* Pagination */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground tabular-nums">
              Page <strong>{page}</strong> of <strong>{pageCount}</strong>
              {total > 0 && ` · ${total} total`}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 px-3" aria-label="Previous page">
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" aria-hidden="true" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="h-8 px-3" aria-label="Next page">
                Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

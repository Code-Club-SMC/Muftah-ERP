import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle } from "lucide-react";
import { formatPKR } from "@/lib/currency-format";
import { useMyCommission, orderBookerKeys } from "@/hooks/sales/use-order-booker-self-service";
import { getMyCommissionFn } from "@/server-functions/sales/order-booker-self-service-fn";
import { OrderBookerFilters, commissionStatusOptions } from "@/components/order-booker/order-booker-filters";
import { OrderStatusBadge } from "@/components/order-booker/order-status-badge";
import { CustomerPagination } from "@/components/sales/customer-pagination";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { GenericEmpty } from "@/components/custom/empty";
import { ensureOrderBookerPortalRouteAccess } from "@/lib/order-booker/guards";

export const Route = createFileRoute("/_protected/order-booker/commission/")({
  loader: async ({ context }) => {
    await ensureOrderBookerPortalRouteAccess();
    await context.queryClient.ensureQueryData({
      queryKey: orderBookerKeys.commission({ page: 1, limit: 25 }),
      queryFn: () => getMyCommissionFn({ data: { page: 1, limit: 25 } }),
      staleTime: 30_000,
    });
  },
  component: MyCommissionPage,
});

function MyCommissionPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const fromDate = dateRange?.from?.toISOString();
  const toDate = dateRange?.to?.toISOString();

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMyCommission({
    page,
    limit,
    status: status !== "all" ? status : undefined,
    fromDate,
    toDate,
  });

  const records = data?.data || [];
  const summary = data?.summary || { totalAccrued: 0, totalPaid: 0, totalReversed: 0 };
  const meta = data?.meta || { total: 0, page: 1, limit: 25, totalPages: 1 };

  const clearFilters = () => {
    setStatus("all");
    setDateRange(undefined);
    setPage(1);
  };

  if (error) {
    console.error("Commission query error:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Commission</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-xl border border-destructive/20">
          <AlertCircle className="size-8 text-destructive mb-3" />
          <p className="text-sm font-semibold text-destructive">Failed to load commission data</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Something went wrong while loading your commission. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Commission</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          className="size-9"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <ArrowUpRight className="size-3.5 text-amber-600" />
                Accrued
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums text-amber-700">
                {formatPKR(summary.totalAccrued)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Banknote className="size-3.5 text-emerald-600" />
                Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums text-emerald-700">
                {formatPKR(summary.totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <ArrowDownRight className="size-3.5 text-rose-600" />
                Reversed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums text-rose-700">
                {formatPKR(summary.totalReversed)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <OrderBookerFilters
        config={{
          showSearch: false,
          showStatus: true,
          statusOptions: commissionStatusOptions,
        }}
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1); }}
        dateRange={dateRange}
        onDateRangeChange={(v) => { setDateRange(v); setPage(1); }}
        onClear={clearFilters}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <GenericEmpty
          icon={Banknote}
          title="No Commission Records"
          description="Commission is calculated when your orders are confirmed and delivered."
        />
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Date</TableHead>
                <TableHead className="text-[11px]">Order</TableHead>
                <TableHead className="text-[11px]">Type</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px] text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record: any) => (
                <TableRow key={record.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {record.createdAt ? format(new Date(record.createdAt), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    #{record.order?.billNumber || "—"} &middot; {record.order?.shopkeeperName || "—"}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {(record.commissionType || "").replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell className="text-sm text-right font-semibold tabular-nums">
                    {formatPKR(Number(record.commissionAmount || 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t border-border/40 px-4">
            <CustomerPagination
              page={page}
              pageCount={meta.totalPages}
              total={meta.total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

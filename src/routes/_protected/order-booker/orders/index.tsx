import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ShoppingCart, RefreshCw, AlertCircle } from "lucide-react";
import { formatPKR } from "@/lib/currency-format";
import { useMyOrders, orderBookerKeys } from "@/hooks/sales/use-order-booker-self-service";
import { getMyOrdersFn } from "@/server-functions/sales/order-booker-self-service-fn";
import { CreateOrderDialog } from "@/components/order-booker/create-order-dialog";
import { OrderBookerFilters } from "@/components/order-booker/order-booker-filters";
import { OrderStatusBadge } from "@/components/order-booker/order-status-badge";
import { CustomerPagination } from "@/components/sales/customer-pagination";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { GenericEmpty } from "@/components/custom/empty";
import { ensureOrderBookerPortalRouteAccess } from "@/lib/order-booker/guards";

export const Route = createFileRoute("/_protected/order-booker/orders/")({
  loader: async ({ context }) => {
    await ensureOrderBookerPortalRouteAccess();
    await context.queryClient.ensureQueryData({
      queryKey: orderBookerKeys.orders({ page: 1, limit: 25 }),
      queryFn: () => getMyOrdersFn({ data: { page: 1, limit: 25 } }),
      staleTime: 30_000,
    });
  },
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const fromDate = dateRange?.from?.toISOString();
  const toDate = dateRange?.to?.toISOString();

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMyOrders({
    page,
    limit,
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    fromDate,
    toDate,
  });

  const orders = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 25, totalPages: 1 };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setDateRange(undefined);
    setPage(1);
  };

  if (error) {
    console.error("Orders query error:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Orders</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-xl border border-destructive/20">
          <AlertCircle className="size-8 text-destructive mb-3" />
          <p className="text-sm font-semibold text-destructive">Failed to load orders</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Something went wrong while loading your orders. Please try again.</p>
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
        <h1 className="text-2xl font-bold">My Orders</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="size-9"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Order
          </Button>
        </div>
      </div>

      <OrderBookerFilters
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1); }}
        dateRange={dateRange}
        onDateRangeChange={(v) => { setDateRange(v); setPage(1); }}
        onClear={clearFilters}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <GenericEmpty
          icon={ShoppingCart}
          title="No Orders Yet"
          description="Start creating orders to track your sales and commissions."
          ctaText="Create First Order"
          onAddChange={() => setCreateOpen(true)}
        />
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Bill #</TableHead>
                <TableHead className="text-[11px]">Date</TableHead>
                <TableHead className="text-[11px]">Shopkeeper</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px] text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: any) => {
                const totalAmount =
                  order.items?.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || 0;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm font-medium">#{order.billNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.createdAt ? format(new Date(order.createdAt), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{order.shopkeeperName}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-medium">
                      {formatPKR(totalAmount)}
                    </TableCell>
                  </TableRow>
                );
              })}
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

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

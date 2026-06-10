import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Truck, Banknote, AlertCircle } from "lucide-react";
import { formatPKR } from "@/lib/currency-format";
import {
  getMyOrdersFn,
  getMyTripsFn,
  getMyCommissionFn,
} from "@/server-functions/sales/order-booker-self-service-fn";
import { orderBookerKeys } from "@/hooks/sales/use-order-booker-self-service";
import { ensureOrderBookerPortalRouteAccess } from "@/lib/order-booker/guards";

export const Route = createFileRoute("/_protected/order-booker/")({
  loader: async ({ context }) => {
    await ensureOrderBookerPortalRouteAccess();
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: orderBookerKeys.orders({ page: 1, limit: 5 }),
        queryFn: () => getMyOrdersFn({ data: { page: 1, limit: 5 } }),
        staleTime: 30_000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: orderBookerKeys.commission({ page: 1, limit: 5 }),
        queryFn: () => getMyCommissionFn({ data: { page: 1, limit: 5 } }),
        staleTime: 30_000,
      }),
    ]);
  },
  component: OrderBookerDashboard,
});

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
          <Icon className={`size-3.5 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function OrderBookerDashboard() {
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: orderBookerKeys.orders({ page: 1, limit: 100 }),
    queryFn: () => getMyOrdersFn({ data: { page: 1, limit: 100 } }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: trips, isLoading: tripsLoading } = useQuery({
    queryKey: orderBookerKeys.trips({ page: 1, limit: 100 }),
    queryFn: () => getMyTripsFn({ data: { page: 1, limit: 100 } }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: orderBookerKeys.commission({ page: 1, limit: 100 }),
    queryFn: () => getMyCommissionFn({ data: { page: 1, limit: 100 } }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const pendingOrders = (orders?.data || []).filter((o: any) => o.status === "pending").length;
  const totalOrders = orders?.meta?.total || 0;
  const totalTrips = trips?.meta?.total || 0;
  const accruedCommission = commission?.summary?.totalAccrued || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Order Booker Portal</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Orders"
          value={totalOrders}
          icon={ShoppingCart}
          color="text-emerald-600"
          isLoading={ordersLoading}
        />
        <KpiCard
          title="Pending"
          value={pendingOrders}
          icon={AlertCircle}
          color="text-amber-600"
          isLoading={ordersLoading}
        />
        <KpiCard
          title="Trips Logged"
          value={totalTrips}
          icon={Truck}
          color="text-blue-600"
          isLoading={tripsLoading}
        />
        <KpiCard
          title="Accrued Commission"
          value={formatPKR(accruedCommission)}
          icon={Banknote}
          color="text-violet-600"
          isLoading={commissionLoading}
        />
      </div>

      {!ordersLoading && !tripsLoading && !totalOrders && !totalTrips && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/10 rounded-xl border border-dashed border-border/50">
          <ShoppingCart className="size-10 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold text-sm">Welcome to your portal</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Start by creating orders or logging trips from the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}

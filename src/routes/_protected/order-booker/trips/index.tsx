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
import { Plus, Truck, Bike, Car, RefreshCw, AlertCircle } from "lucide-react";
import { formatPKR } from "@/lib/currency-format";
import { useMyTrips, orderBookerKeys } from "@/hooks/sales/use-order-booker-self-service";
import { getMyTripsFn } from "@/server-functions/sales/order-booker-self-service-fn";
import { CreateTripDialog } from "@/components/order-booker/create-trip-dialog";
import { OrderBookerFilters, vehicleTypeOptions } from "@/components/order-booker/order-booker-filters";
import { CustomerPagination } from "@/components/sales/customer-pagination";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { GenericEmpty } from "@/components/custom/empty";
import { ensureOrderBookerPortalRouteAccess } from "@/lib/order-booker/guards";

export const Route = createFileRoute("/_protected/order-booker/trips/")({
  loader: async ({ context }) => {
    await ensureOrderBookerPortalRouteAccess();
    await context.queryClient.ensureQueryData({
      queryKey: orderBookerKeys.trips({ page: 1, limit: 25 }),
      queryFn: () => getMyTripsFn({ data: { page: 1, limit: 25 } }),
      staleTime: 30_000,
    });
  },
  component: MyTripsPage,
});

function VehicleBadge({ type }: { type: string }) {
  const normalized = type === "own_vehicle" ? "own" : type === "company_vehicle" ? "company" : type;
  return normalized === "own" ? (
    <span className="flex items-center gap-1 text-xs text-blue-600">
      <Bike className="size-3" /> Own
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <Car className="size-3" /> Company
    </span>
  );
}

function MyTripsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [vehicleType, setVehicleType] = useState("all");
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
  } = useMyTrips({
    page,
    limit,
    vehicleType: vehicleType !== "all" ? vehicleType : undefined,
    fromDate,
    toDate,
  });

  const trips = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 25, totalPages: 1 };

  const clearFilters = () => {
    setVehicleType("all");
    setDateRange(undefined);
    setPage(1);
  };

  if (error) {
    console.error("Trips query error:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Trips</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-xl border border-destructive/20">
          <AlertCircle className="size-8 text-destructive mb-3" />
          <p className="text-sm font-semibold text-destructive">Failed to load trips</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Something went wrong while loading your trips. Please try again.</p>
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
        <h1 className="text-2xl font-bold">My Trips</h1>
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
            Log Trip
          </Button>
        </div>
      </div>

      <OrderBookerFilters
        config={{
          showSearch: false,
          showStatus: false,
          showVehicleType: true,
          vehicleTypeOptions,
        }}
        vehicleType={vehicleType}
        onVehicleTypeChange={(v) => { setVehicleType(v); setPage(1); }}
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
      ) : trips.length === 0 ? (
        <GenericEmpty
          icon={Truck}
          title="No Trips Logged"
          description="Log your field visits to track TADA and fuel expenses."
          ctaText="Log First Trip"
          onAddChange={() => setCreateOpen(true)}
        />
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Date</TableHead>
                <TableHead className="text-[11px]">Area</TableHead>
                <TableHead className="text-[11px]">Distance</TableHead>
                <TableHead className="text-[11px]">Vehicle</TableHead>
                <TableHead className="text-[11px] text-right">TADA</TableHead>
                <TableHead className="text-[11px] text-right">Fuel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip: any) => (
                <TableRow key={trip.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {trip.tripDate ? format(new Date(trip.tripDate), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{trip.destination || trip.areaVisited || "—"}</TableCell>
                  <TableCell className="text-sm">{trip.distanceKm} km</TableCell>
                  <TableCell>
                    <VehicleBadge type={trip.vehicleType} />
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatPKR(Number(trip.tadaAmount || 0))}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatPKR(Number(trip.fuelCost || 0))}
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

      <CreateTripDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { GenericLoader } from "@/components/custom/generic-loader";
import { Separator } from "@/components/ui/separator";
import { DatePickerWithRange } from "@/components/custom/date-range-picker";
import { type DateRange } from "react-day-picker";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getSalesOverviewFn } from "@/server-functions/sales/sales-config-fn";
import { BarChart3, TrendingUp, Package } from "lucide-react";

const PKR = (v: number) =>
  `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

export const Route = createFileRoute("/_protected/sales/overview/")({
  component: SalesOverviewPage,
});

function SalesOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Overview</h1>
        <p className="text-muted-foreground mt-1">
          Product-wise sales performance and breakdown.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<GenericLoader title="Loading Overview" description="Fetching sales data..." />}>
        <SalesOverviewContent />
      </Suspense>
    </div>
  );
}

function SalesOverviewContent() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const dateFrom = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const dateTo = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["sales-overview", dateFrom, dateTo],
    queryFn: () => getSalesOverviewFn({ data: { dateFrom, dateTo } }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const products = data?.products || [];
  const totalRevenue = data?.totalRevenue || 0;
  const totalInvoices = data?.totalInvoices || 0;

  return (
    <div className="space-y-5">
      {/* Date Filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Period</p>
          <DatePickerWithRange
            date={dateRange}
            onDateChange={(d) => setDateRange(d ?? { from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
            className="w-64"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="size-3.5 text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">{PKR(totalRevenue)}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="size-3.5 text-blue-600" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Invoices</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-blue-700">{totalInvoices}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="size-3.5 text-violet-600" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Products Sold</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-violet-700">{products.length}</p>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Product</TableHead>
              <TableHead className="text-[11px] text-right">Cartons</TableHead>
              <TableHead className="text-[11px] text-right">Loose Units</TableHead>
              <TableHead className="text-[11px] text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10 text-sm">
                  No sales data for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="text-sm font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{p.totalCartons}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{p.totalUnits}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-semibold">{PKR(p.revenue)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { type DateRange } from "react-day-picker";
import { getProductProfitLossFn } from "@/server-functions/inventory/products/get-product-profit-loss-fn";
import { ProductProfitLossView } from "@/components/recipes/product-profit-loss-view";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute(
  "/_protected/manufacturing/products/$productId/",
)({
  validateSearch: (search: Record<string, unknown>) => {
    const today = new Date();
    return {
      from: String(search.from ?? format(startOfMonth(today), "yyyy-MM-dd")),
      to: String(search.to ?? format(endOfMonth(today), "yyyy-MM-dd")),
    };
  },
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: async ({
    context: { queryClient },
    params: { productId },
    deps: { from, to },
  }) => {
    return queryClient.ensureQueryData({
      queryKey: ["product-profit-loss", productId, from, to],
      queryFn: () =>
        getProductProfitLossFn({
          data: { productId, dateFrom: from, dateTo: to },
        }),
    });
  },
  component: ProductProfitLossPage,
  errorComponent: () => (
    <div className="p-8 text-center text-destructive">
      Failed to load product profit & loss data.
    </div>
  ),
  pendingComponent: () => (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  ),
});

function ProductProfitLossPage() {
  const data = Route.useLoaderData();
  const { from, to } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseISO(from),
    to: parseISO(to),
  });

  // Sync local picker state when URL dates change
  useEffect(() => {
    setDateRange({
      from: parseISO(from),
      to: parseISO(to),
    });
  }, [from, to]);

  const handleApply = () => {
    if (!dateRange?.from) return;
    const newFrom = format(dateRange.from, "yyyy-MM-dd");
    const newTo = format(dateRange.to ?? dateRange.from, "yyyy-MM-dd");
    navigate({ search: { from: newFrom, to: newTo } });
  };

  // @ts-ignore — router.state.status exists at runtime
  const isPending = router.state?.status === "loading";

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <ProductProfitLossView
          data={data}
          dateRange={dateRange}
          onDateChange={setDateRange}
          onApply={handleApply}
          isPending={isPending}
        />
      </div>
    </main>
  );
}

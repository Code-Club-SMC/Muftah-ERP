import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, AlertCircle, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCustomerProfileFn } from "@/server-functions/sales/sales-config-fn";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCustomerFn } from "@/server-functions/sales/customers-fn";
import { toast } from "sonner";

const PKR = (v: number) =>
  `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

export const Route = createFileRoute("/_protected/sales/people/shopkeepers/$customerId/")({
  component: ShopkeeperProfilePage,
});

function ShopkeeperProfilePage() {
  const { customerId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["shopkeeper-profile", customerId],
    queryFn: () => getCustomerProfileFn({ data: { id: customerId } }),
  });

  const updateMutation = useMutation({
    mutationFn: updateCustomerFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopkeeper-profile", customerId] });
      toast.success("Profile updated");
    },
  });

  const [editingMargin, setEditingMargin] = useState(false);
  const [marginValue, setMarginValue] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-sm font-medium text-destructive">Customer not found</p>
        <Button variant="outline" onClick={() => router.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => router.history.back()}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{customer.name}</h1>
            <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-950/20 text-xs capitalize">
              {customer.customerType}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {customer.city || "—"} {customer.mobileNumber && `| ${customer.mobileNumber}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            router.navigate({ to: "/sales/people/shopkeepers/$customerId/ledger", params: { customerId } })
          }
        >
          <BookOpen className="size-4 mr-1.5" />
          View Ledger
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Total Sales</p>
          <p className="text-xl font-bold tabular-nums text-emerald-700">{PKR(Number(customer.totalSale))}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Total Paid</p>
          <p className="text-xl font-bold tabular-nums text-blue-700">{PKR(Number(customer.payment))}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Outstanding</p>
          <p className={cn("text-xl font-bold tabular-nums", Number(customer.credit) > 0 ? "text-red-700" : "text-green-700")}>
            {PKR(Number(customer.credit))}
          </p>
        </div>
      </div>

      {/* Default Margin */}
      <div className="p-4 rounded-xl border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Default Margin</h3>
            <p className="text-xs text-muted-foreground">Applied to all products for this distributor.</p>
          </div>
          {editingMargin ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                className="w-24 h-8 text-sm"
                value={marginValue}
                onChange={(e) => setMarginValue(e.target.value)}
                placeholder={`${customer.defaultMargin || 0}`}
              />
              <Button
                size="sm"
                onClick={() => {
                  updateMutation.mutate({
                    data: { id: customerId, defaultMargin: marginValue },
                  });
                  setEditingMargin(false);
                }}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums">{Number(customer.defaultMargin) || 0}%</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditingMargin(true); setMarginValue(String(customer.defaultMargin || 0)); }}>
                <Settings className="size-4 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

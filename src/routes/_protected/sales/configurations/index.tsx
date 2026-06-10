import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { GenericLoader } from "@/components/custom/generic-loader";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetRecipePrices,
  useUpsertRecipePrice,
} from "@/hooks/sales/use-sales-config";
import {
  useCreateDiscountRule,
  useDeleteDiscountRule,
} from "@/hooks/sales/use-discount-rules";
import {
  getDiscountRulesFn,
} from "@/server-functions/sales/discount-rules-fn";
import {
  getCustomersByTypeFn,
  getRecipesFn,
} from "@/server-functions/sales/sales-config-fn";
import {
  useGetCommissionTiers,
  useCreateCommissionTier,
  useDeleteCommissionTier,
} from "@/hooks/sales/use-order-booker-commission";
import { useGetOrderBookers } from "@/hooks/sales/use-sales-people";
import {
  getActiveTadaRateFn,
  listTadaRatesFn,
  setTadaRateFn,
} from "@/server-functions/hr/rates/tada-rates-fn";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProductsFn } from "@/server-functions/sales/sales-config-fn";
import { format } from "date-fns";
import { Trash2, Plus, Settings, Car, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PKR = (v: number) =>
  `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

export const Route = createFileRoute("/_protected/sales/configurations/")({
  loader: async ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["active-tada-rate"],
      queryFn: () => getActiveTadaRateFn(),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["tada-rate-history"],
      queryFn: () => listTadaRatesFn(),
    });
  },
  component: SalesConfigurationsPage,
});

function SalesConfigurationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sales Configurations</h2>
        <p className="text-muted-foreground mt-1">
          Manage discount rules, item prices, TADA rates, and commission tiers.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<GenericLoader title="Loading Configurations" description="Fetching settings..." />}>
        <ConfigurationsContent />
      </Suspense>
    </div>
  );
}

function ConfigurationsContent() {
  return (
    <Tabs defaultValue="discount" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="discount">Discount</TabsTrigger>
        <TabsTrigger value="item-prices">Item Prices</TabsTrigger>
        <TabsTrigger value="tada">TADA Rate</TabsTrigger>
        <TabsTrigger value="commissions">Commission Tiers</TabsTrigger>
      </TabsList>

      <TabsContent value="discount">
        <DiscountTab />
      </TabsContent>

      <TabsContent value="item-prices">
        <ItemPricesTab />
      </TabsContent>

      <TabsContent value="tada">
        <TadaRateTab />
      </TabsContent>

      <TabsContent value="commissions">
        <CommissionTiersTab />
      </TabsContent>
    </Tabs>
  );
}

// ── Discount Tab ──
function DiscountTab() {
  const { data: rules } = useQuery({
    queryKey: ["discount-rules"],
    queryFn: () => getDiscountRulesFn({ data: {} }),
  });
  const deleteMutation = useDeleteDiscountRule();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Discount Rules</h3>
        <AddDiscountRuleDialog />
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Distributor</TableHead>
              <TableHead className="text-[11px]">Item / Recipe</TableHead>
              <TableHead className="text-[11px] text-right">Buy Qty</TableHead>
              <TableHead className="text-[11px] text-right">Free Units</TableHead>
              <TableHead className="text-[11px]">Effective</TableHead>
              <TableHead className="text-[11px] w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rules?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                  No discount rules configured.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.customer?.name}</TableCell>
                  <TableCell className="text-sm">{r.recipe?.name}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{r.quantityThreshold}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{r.freeUnits}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(r.effectiveFrom), "dd MMM yyyy")}
                    {r.effectiveTo && ` → ${format(new Date(r.effectiveTo), "dd MMM yyyy")}`}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => deleteMutation.mutate({ data: { id: r.id } })}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AddDiscountRuleDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateDiscountRule();
  const [form, setForm] = useState({
    customerId: "",
    recipeId: "",
    quantityThreshold: "",
    freeUnits: "",
  });

  const { data: distributors } = useQuery({
    queryKey: ["distributors-for-discount"],
    queryFn: () => getCustomersByTypeFn({ data: { customerType: "distributor", page: 1, limit: 200 } }),
  });

  const { data: recipesList } = useQuery({
    queryKey: ["all-recipes"],
    queryFn: () => getRecipesFn(),
  });

  const handleSubmit = () => {
    if (!form.customerId || !form.recipeId || !form.quantityThreshold || !form.freeUnits) {
      toast.error("All fields are required");
      return;
    }
    createMutation.mutate(
      {
        data: {
          customerId: form.customerId,
          recipeId: form.recipeId,
          quantityThreshold: Number(form.quantityThreshold),
          freeUnits: Number(form.freeUnits),
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success("Discount rule created");
          setForm({ customerId: "", recipeId: "", quantityThreshold: "", freeUnits: "" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1.5" />
          Add Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Discount Rule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Distributor</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select distributor" />
              </SelectTrigger>
              <SelectContent>
                {distributors?.data?.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Item / Recipe</Label>
            <Select value={form.recipeId} onValueChange={(v) => setForm((f) => ({ ...f, recipeId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {recipesList?.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Buy Qty (cartons)</Label>
              <Input type="number" value={form.quantityThreshold} onChange={(e) => setForm((f) => ({ ...f, quantityThreshold: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Free Units</Label>
              <Input type="number" value={form.freeUnits} onChange={(e) => setForm((f) => ({ ...f, freeUnits: e.target.value }))} />
            </div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending}>
            Create Rule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── TADA Rate Tab ──
function TadaRateTab() {
  const { data: activeRate } = useQuery({
    queryKey: ["active-tada-rate"],
    queryFn: () => getActiveTadaRateFn(),
  });

  const { data: history } = useQuery({
    queryKey: ["tada-rate-history"],
    queryFn: () => listTadaRatesFn(),
  });

  const [open, setOpen] = useState(false);
  const [ratePerKm, setRatePerKm] = useState("");
  const qc = useQueryClient();
  const setRateMutation = useMutation({
    mutationFn: setTadaRateFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-tada-rate"] });
      qc.invalidateQueries({ queryKey: ["tada-rate-history"] });
      setOpen(false);
      toast.success("TADA rate updated");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">TA/DA Rate Configuration</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Settings className="size-4 mr-1.5" />
              Set Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set New TA/DA Rate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Rate per KM (PKR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratePerKm}
                  onChange={(e) => setRatePerKm(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() =>
                  setRateMutation.mutate({
                    data: {
                      ratePerKm: Number(ratePerKm),
                      effectiveFrom: format(new Date(), "yyyy-MM-dd"),
                    },
                  })
                }
                disabled={setRateMutation.isPending}
              >
                Save Rate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-1.5 mb-2">
            <Car className="size-3.5 text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Current Active Rate</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">
            {activeRate ? PKR(Number(activeRate.ratePerKm)) : "Not Set"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Effective from {activeRate ? format(new Date(activeRate.effectiveFrom), "dd MMM yyyy") : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Rate</TableHead>
              <TableHead className="text-[11px]">Effective From</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Set By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!history?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10 text-sm">
                  No rate history.
                </TableCell>
              </TableRow>
            ) : (
              history.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium tabular-nums">{PKR(Number(r.ratePerKm))}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.effectiveFrom), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? "default" : "outline"} className="text-[10px]">
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.setter?.name || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Commission Tiers Tab ──
function CommissionTiersTab() {
  const { data: tiers } = useGetCommissionTiers();
  const { data: orderBookers } = useGetOrderBookers();
  const createTier = useCreateCommissionTier();
  const deleteTier = useDeleteCommissionTier();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ orderBookerId: "", minAmount: "", maxAmount: "", rate: "" });

  const handleSubmit = () => {
    createTier.mutate(
      {
        data: {
          orderBookerId: form.orderBookerId || undefined,
          minAmount: Number(form.minAmount) || 0,
          maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
          rate: Number(form.rate) || 0,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success("Commission tier created");
          setForm({ orderBookerId: "", minAmount: "", maxAmount: "", rate: "" });
        },
      },
    );
  };

  const bookerMap = new Map(orderBookers?.map((ob: any) => [ob.id, ob.name]) ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Commission Tiers</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4 mr-1.5" />Add Tier</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New Commission Tier</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Order Booker (optional — leave empty for global tier)</Label>
                <Select value={form.orderBookerId} onValueChange={(v) => setForm((f) => ({ ...f, orderBookerId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Global tier (applies to all)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(orderBookers || []).map((ob: any) => (
                      <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Min Amount (PKR)</Label>
                  <Input type="number" value={form.minAmount} onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Amount (PKR)</Label>
                  <Input type="number" value={form.maxAmount} onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))} placeholder="Unlimited" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Rate (%)</Label>
                <Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={createTier.isPending}>
                Create {form.orderBookerId ? "Custom" : "Global"} Tier
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Order Booker</TableHead>
              <TableHead className="text-[11px]">Min Amount</TableHead>
              <TableHead className="text-[11px]">Max Amount</TableHead>
              <TableHead className="text-[11px] text-right">Rate</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px] w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!tiers?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">No commission tiers found.</TableCell>
              </TableRow>
            ) : (
              tiers.map((tier: any) => (
                <TableRow key={tier.id}>
                  <TableCell className="text-sm">
                    {tier.orderBookerId ? (
                      <Badge variant="secondary" className="text-[10px]">{bookerMap.get(tier.orderBookerId) || "Custom"}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Global</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">PKR {tier.minAmount}</TableCell>
                  <TableCell className="text-sm">{tier.maxAmount ? `PKR ${tier.maxAmount}` : "Unlimited"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{tier.rate}%</TableCell>
                  <TableCell>
                    <Badge variant={tier.isActive ? "default" : "outline"} className="text-[10px]">{tier.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] text-rose-500" onClick={() => deleteTier.mutate({ data: { id: tier.id } })}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Item Prices Tab ──
function ItemPricesTab() {
  const { data: rows } = useGetRecipePrices();
  const upsert = useUpsertRecipePrice();
  const [edits, setEdits] = useState<Record<string, { invoice: string; retail: string }>>({});

  const handleChange = (recipeId: string, field: "invoice" | "retail", value: string) => {
    setEdits((prev) => ({
      ...prev,
      [recipeId]: { ...(prev[recipeId] || { invoice: "", retail: "" }), [field]: value },
    }));
  };

  const handleSave = (recipeId: string) => {
    const row = edits[recipeId];
    if (!row) return;
    const invoicePrice = Number(row.invoice);
    const retailPrice = Number(row.retail);
    if (Number.isNaN(invoicePrice) || Number.isNaN(retailPrice)) {
      toast.error("Please enter valid numbers");
      return;
    }
    upsert.mutate(
      { data: { recipeId, invoicePricePerPack: invoicePrice, retailPricePerPack: retailPrice } },
      {
        onSuccess: () => {
          toast.success("Price saved");
          setEdits((prev) => {
            const next = { ...prev };
            delete next[recipeId];
            return next;
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Item Prices</h3>
        <span className="text-xs text-muted-foreground">
          Set per-pack invoice and retail prices for every recipe
        </span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Recipe</TableHead>
              <TableHead className="text-[11px]">Product</TableHead>
              <TableHead className="text-[11px] text-right">Packs / Carton</TableHead>
              <TableHead className="text-[11px] text-right">Invoice Price / Pack</TableHead>
              <TableHead className="text-[11px] text-right">Retail Price / Pack</TableHead>
              <TableHead className="text-[11px] w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                  No recipes found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r: any) => {
                const invoiceVal = edits[r.recipeId]?.invoice ?? (r.invoicePricePerPack != null ? String(r.invoicePricePerPack) : "");
                const retailVal = edits[r.recipeId]?.retail ?? (r.retailPricePerPack != null ? String(r.retailPricePerPack) : "");
                const hasChanges = edits[r.recipeId] !== undefined;
                return (
                  <TableRow key={r.recipeId}>
                    <TableCell className="text-sm font-medium">{r.recipeName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.productName}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{r.containersPerCarton}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 text-xs text-right pr-2 pl-6"
                          value={invoiceVal}
                          onChange={(e) => handleChange(r.recipeId, "invoice", e.target.value)}
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-semibold pointer-events-none">
                          ₨
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 text-xs text-right pr-2 pl-6"
                          value={retailVal}
                          onChange={(e) => handleChange(r.recipeId, "retail", e.target.value)}
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-semibold pointer-events-none">
                          ₨
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled={!hasChanges || upsert.isPending}
                        onClick={() => handleSave(r.recipeId)}
                      >
                        {upsert.isPending ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

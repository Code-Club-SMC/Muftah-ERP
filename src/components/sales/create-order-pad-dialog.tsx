import { useState, useMemo, useCallback } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Store,
  User,
  Package,
  Layers,
  Calculator,
  RotateCcw,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { formatPKR } from "@/lib/currency-format";
import { getProductsFn } from "@/server-functions/sales/sales-config-fn";
import { getRecipesByProductFn } from "@/server-functions/inventory/recipes/get-recipes-by-product-fn";
import { getRecipeActualCostFn } from "@/server-functions/inventory/recipes/get-recipe-actual-cost-fn";
import { getOrderBookerCommissionTiersFn } from "@/server-functions/sales/order-booker-commission-fn";
import { useCreateOrder } from "@/hooks/sales/use-orders";

/* ────────────────────────────────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────────────────────────────────── */

const unitTypeOptions = [
  { value: "full_carton", label: "Full Carton", multiplier: 1 },
  { value: "half_carton", label: "Half Carton", multiplier: 0.5 },
  { value: "pack", label: "Pack", multiplier: 1 },
  { value: "shopper", label: "Shopper", multiplier: 1 },
] as const;

type UnitType = typeof unitTypeOptions[number]["value"];

/* ────────────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────────────── */

interface OrderBooker {
  id: string;
  name: string;
  commissionRate?: string | null;
}

interface Recipe {
  id: string;
  name: string;
  containersPerCarton: number | null;
  estimatedCostPerContainer: string | null;
}

interface CostData {
  costPerPack: number;
  costPerCarton: number;
  source: "wac" | "estimated";
}

interface CommissionTier {
  id: string;
  minAmount: string;
  maxAmount: string | null;
  rate: string;
}

interface OrderItemForm {
  productId: string;
  recipeId: string;
  unitType: UnitType;
  quantity: number;
  adminMargin: number;
  rate: number;
}

/* ────────────────────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────────────────────── */

function blankItem(): OrderItemForm {
  return { productId: "", recipeId: "", unitType: "full_carton", quantity: 1, adminMargin: 0, rate: 0 };
}

function getUnitMultiplier(unitType: UnitType): number {
  return unitTypeOptions.find((u) => u.value === unitType)?.multiplier ?? 1;
}

function packsPerUnit(unitType: UnitType, containersPerCarton: number): number {
  const mult = getUnitMultiplier(unitType);
  if (unitType === "pack" || unitType === "shopper") return 1;
  return (containersPerCarton || 1) * mult;
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/* ────────────────────────────────────────────────────────────────────────────
   COMMISSION TIER UTILS
   ──────────────────────────────────────────────────────────────────────────── */

function findApplicableTier(totalSale: number, tiers: CommissionTier[]): CommissionTier | null {
  for (const tier of tiers) {
    const min = Number(tier.minAmount);
    const max = tier.maxAmount ? Number(tier.maxAmount) : Infinity;
    if (totalSale >= min && totalSale <= max) {
      return tier;
    }
  }
  return null;
}

function computeObMarginRate(totalSale: number, tiers: CommissionTier[], flatRate: number): number {
  const tier = findApplicableTier(totalSale, tiers);
  if (tier) return Number(tier.rate);
  return flatRate;
}

/* ────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ──────────────────────────────────────────────────────────────────────────── */

function CommissionThresholdsPanel({
  tiers,
  flatRate,
  totalSale,
}: {
  tiers: CommissionTier[];
  flatRate: number;
  totalSale: number;
}) {
  if (tiers.length === 0 && flatRate === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="size-3" />
        No commission thresholds configured.
      </div>
    );
  }

  const applicable = findApplicableTier(totalSale, tiers);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="size-3" />
        Commission Thresholds
      </div>
      <div className="space-y-1">
        {tiers.map((tier) => {
          const min = Number(tier.minAmount);
          const max = tier.maxAmount ? Number(tier.maxAmount) : Infinity;
          const isActive = totalSale >= min && totalSale <= max;
          return (
            <div
              key={tier.id}
              className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                isActive ? "bg-emerald-500/10 border border-emerald-500/30" : ""
              }`}
            >
              <span className="font-mono text-muted-foreground">
                {formatPKR(min)} — {tier.maxAmount ? formatPKR(Number(tier.maxAmount)) : "∞"}
              </span>
              <span className={`font-bold font-mono ${isActive ? "text-emerald-400" : ""}`}>
                {formatRate(Number(tier.rate))}
                {isActive && <span className="ml-1 text-[10px]">← current</span>}
              </span>
            </div>
          );
        })}
        {tiers.length === 0 && flatRate > 0 && (
          <div className="text-xs text-muted-foreground">
            Flat rate: {formatRate(flatRate)}
          </div>
        )}
      </div>
    </div>
  );
}

function PricingChainCard({
  recipeName,
  unitType,
  quantity,
  containersPerCarton,
  costData,
  adminMargin,
  obMarginRate,
  finalRate,
  lineTotal,
  onAdminMarginChange,
  onFinalRateChange,
  isManualOverride,
  onResetRate,
}: {
  recipeName: string;
  unitType: UnitType;
  quantity: number;
  containersPerCarton: number;
  costData: CostData | null;
  adminMargin: number;
  obMarginRate: number;
  finalRate: number;
  lineTotal: number;
  onAdminMarginChange: (v: number) => void;
  onFinalRateChange: (v: number) => void;
  isManualOverride: boolean;
  onResetRate: () => void;
}) {
  const ppu = packsPerUnit(unitType, containersPerCarton);
  const costPerUnit = (costData?.costPerPack ?? 0) * ppu;
  const totalFactoryCost = costPerUnit * quantity;
  const totalAdminProfit = adminMargin * quantity;
  const subtotal = (costPerUnit + adminMargin) * quantity;
  const obMarginAmount = subtotal * (obMarginRate / 100);

  return (
    <div className="bg-muted/20 border rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">
          Pricing: {recipeName}
        </span>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
          {unitTypeOptions.find((u) => u.value === unitType)?.label} × {quantity}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
        <span className="text-muted-foreground">Factory Cost/Unit:</span>
        <span className="text-right">
          {formatPKR(costPerUnit)}
          {costData?.source === "estimated" && (
            <span className="text-amber-400 text-[10px] ml-1">(est.)</span>
          )}
        </span>

        <span className="text-muted-foreground">Total Factory Cost:</span>
        <span className="text-right">{formatPKR(totalFactoryCost)}</span>

        <span className="text-muted-foreground flex items-center gap-1">
          + Admin Margin/Unit:
        </span>
        <div className="flex justify-end">
          <Input
            type="number"
            min={0}
            className="h-6 w-24 text-xs text-right px-1"
            value={adminMargin}
            onChange={(e) => onAdminMarginChange(Number(e.target.value))}
          />
        </div>

        <span className="text-muted-foreground">Total Admin Profit:</span>
        <span className="text-right text-emerald-400">{formatPKR(totalAdminProfit)}</span>

        <span className="text-muted-foreground">+ OB Margin ({formatRate(obMarginRate)}):</span>
        <span className="text-right">{formatPKR(obMarginAmount)}</span>
      </div>

      <div className="border-t pt-2 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground">Final Rate/Unit</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className={`h-7 w-28 text-xs font-bold text-right px-1 ${
                isManualOverride ? "border-amber-500/50" : ""
              }`}
              value={finalRate}
              onChange={(e) => onFinalRateChange(Number(e.target.value))}
            />
            {isManualOverride && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] gap-1"
                onClick={onResetRate}
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground">Line Total</span>
          <div className="text-base font-black font-mono">{formatPKR(lineTotal)}</div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────────────────────────── */

interface CreateOrderPadDialogProps {
  orderBookers: OrderBooker[];
}

export function CreateOrderPadDialog({ orderBookers }: CreateOrderPadDialogProps) {
  const [open, setOpen] = useState(false);
  const [manualRateOverrides, setManualRateOverrides] = useState<Set<number>>(new Set());
  const create = useCreateOrder();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProductsFn(),
  });

  const form = useForm({
    defaultValues: {
      orderBookerId: "",
      shopkeeperName: "",
      shopkeeperMobile: "",
      shopkeeperAddress: "",
      notes: "",
      items: [blankItem()],
    },
    onSubmit: async ({ value }) => {
      if (!value.orderBookerId || !value.shopkeeperName) {
        toast.error("Order booker and shopkeeper name are required");
        return;
      }
      if (value.items.some((i) => !i.productId || !i.recipeId || i.quantity <= 0)) {
        toast.error("All items must have a product, recipe, and positive quantity");
        return;
      }

      create.mutate(
        {
          data: {
            orderBookerId: value.orderBookerId,
            shopkeeperName: value.shopkeeperName,
            shopkeeperMobile: value.shopkeeperMobile || undefined,
            shopkeeperAddress: value.shopkeeperAddress || undefined,
            items: value.items.map((i) => ({
              productId: i.productId,
              recipeId: i.recipeId,
              unitType: i.unitType,
              quantity: i.quantity,
              rate: i.rate,
            })),
            notes: value.notes || undefined,
          },
        },
        {
          onSuccess: () => {
            setOpen(false);
            toast.success("Order created");
            form.reset();
            setManualRateOverrides(new Set());
          },
        },
      );
    },
  });

  const items = useStore(form.store, (state) => state.values.items);
  const orderBookerId = useStore(form.store, (state) => state.values.orderBookerId);

  const selectedBooker = orderBookers.find((ob) => ob.id === orderBookerId);
  const flatCommissionRate = selectedBooker?.commissionRate
    ? Number(selectedBooker.commissionRate)
    : 0;

  // Fetch commission tiers for selected order booker
  const { data: commissionTiers } = useQuery({
    queryKey: ["commissionTiers", orderBookerId],
    queryFn: () => getOrderBookerCommissionTiersFn({ data: { orderBookerId } }),
    enabled: !!orderBookerId,
  });

  // Fetch recipes per product (caching)
  const productRecipeQueries = useMemo(() => {
    const uniqueProductIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    return uniqueProductIds;
  }, [items]);

  const recipesByProduct = useMemo(() => {
    const map = new Map<string, Recipe[]>();
    // We'll populate this on-demand via queries
    return map;
  }, []);

  // Fetch cost data per recipe
  const recipeIds = useMemo(() => [...new Set(items.map((i) => i.recipeId).filter(Boolean))], [items]);

  // Use a single query for all recipe costs (simplified — in practice, we'd batch)
  const { data: recipeCostsMap } = useQuery({
    queryKey: ["recipeCosts", recipeIds.join(",")],
    queryFn: async () => {
      const results = new Map<string, CostData>();
      await Promise.all(
        recipeIds.map(async (recipeId) => {
          const data = await getRecipeActualCostFn({ data: { recipeId } });
          results.set(recipeId, data);
        }),
      );
      return results;
    },
    enabled: recipeIds.length > 0,
  });

  // Global order totals
  const {
    totalFactoryCost,
    totalAdminProfit,
    totalPreOb,
    obMarginRate,
    obMarginAmount,
    finalTotal,
  } = useMemo(() => {
    let factory = 0;
    let admin = 0;
    let preOb = 0;

    items.forEach((item) => {
      const cost = recipeCostsMap?.get(item.recipeId);
      const recipe = products?.find((p: any) => p.id === item.productId)?.recipes?.find((r: any) => r.id === item.recipeId);
      const containersPerCarton = recipe?.containersPerCarton ?? 12;
      const ppu = packsPerUnit(item.unitType, containersPerCarton);
      const costPerUnit = (cost?.costPerPack ?? 0) * ppu;

      factory += costPerUnit * item.quantity;
      admin += item.adminMargin * item.quantity;
      preOb += (costPerUnit + item.adminMargin) * item.quantity;
    });

    const obRate = computeObMarginRate(preOb, commissionTiers ?? [], flatCommissionRate);
    const obAmount = preOb * (obRate / 100);
    const final = preOb + obAmount;

    return {
      totalFactoryCost: factory,
      totalAdminProfit: admin,
      totalPreOb: preOb,
      obMarginRate: obRate,
      obMarginAmount: obAmount,
      finalTotal: final,
    };
  }, [items, recipeCostsMap, products, commissionTiers, flatCommissionRate]);

  // Auto-compute rates (unless manually overridden)
  useMemo(() => {
    items.forEach((item, idx) => {
      if (manualRateOverrides.has(idx)) return;

      const cost = recipeCostsMap?.get(item.recipeId);
      const recipe = products?.find((p: any) => p.id === item.productId)?.recipes?.find((r: any) => r.id === item.recipeId);
      const containersPerCarton = recipe?.containersPerCarton ?? 12;
      const ppu = packsPerUnit(item.unitType, containersPerCarton);
      const costPerUnit = (cost?.costPerPack ?? 0) * ppu;

      const subtotalPerUnit = costPerUnit + item.adminMargin;
      const computedRate = subtotalPerUnit * (1 + obMarginRate / 100);

      if (computedRate !== item.rate && computedRate > 0) {
        form.setFieldValue(`items[${idx}].rate`, Math.round(computedRate * 100) / 100);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, recipeCostsMap, products, obMarginRate]);

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      form.setFieldValue(`items[${index}].productId`, productId);
      form.setFieldValue(`items[${index}].recipeId`, "");
      setManualRateOverrides((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    },
    [form],
  );

  const handleRateManualChange = useCallback(
    (index: number, value: number) => {
      form.setFieldValue(`items[${index}].rate`, value);
      setManualRateOverrides((prev) => new Set(prev).add(index));
    },
    [form],
  );

  const resetRate = useCallback(
    (index: number) => {
      setManualRateOverrides((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      // Re-computation will happen via useMemo effect
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1.5" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="size-5 text-primary" />
            Create Order
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5 pt-2"
        >
          {/* ── Header: Order Booker + Shopkeeper ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field
              name="orderBookerId"
              validators={{ onChange: z.string().min(1, "Select order booker") }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <User className="size-3" />
                    Order Booker
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select order booker" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderBookers.map((ob) => (
                        <SelectItem key={ob.id} value={ob.id}>
                          {ob.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field
              name="shopkeeperName"
              validators={{ onChange: z.string().min(1, "Shopkeeper name is required") }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Store className="size-3" />
                    Shopkeeper Name
                  </Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter shopkeeper name"
                    className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="shopkeeperMobile">
              {(field) => (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="03XX-XXXXXXX"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="shopkeeperAddress">
              {(field) => (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Shop address"
                  />
                </div>
              )}
            </form.Field>
          </div>

          {/* ── Commission Thresholds (visible when OB selected) ── */}
          {orderBookerId && (
            <div className="border rounded-lg p-3 bg-muted/10">
              <CommissionThresholdsPanel
                tiers={commissionTiers ?? []}
                flatRate={flatCommissionRate}
                totalSale={totalPreOb}
              />
            </div>
          )}

          {/* ── Line Items ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Order Items
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {items.length} line{items.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <OrderLineItem
                  key={index}
                  index={index}
                  item={item}
                  products={products ?? []}
                  form={form}
                  recipeCostsMap={recipeCostsMap}
                  obMarginRate={obMarginRate}
                  isManualOverride={manualRateOverrides.has(index)}
                  onProductChange={handleProductChange}
                  onRateManualChange={handleRateManualChange}
                  onResetRate={resetRate}
                  onRemove={() => {
                    const current = form.getFieldValue("items");
                    if (current.length > 1) {
                      form.setFieldValue("items", current.filter((_, i) => i !== index));
                      setManualRateOverrides((prev) => {
                        const next = new Set<number>();
                        prev.forEach((idx) => {
                          if (idx < index) next.add(idx);
                          if (idx > index) next.add(idx - 1);
                        });
                        return next;
                      });
                    }
                  }}
                  canRemove={items.length > 1}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const current = form.getFieldValue("items");
                form.setFieldValue("items", [...current, blankItem()]);
              }}
              className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground hover:border-primary h-9"
            >
              <Plus className="size-4" /> Add Product Line
            </Button>
          </div>

          {/* ── Order Summary ── */}
          <div className="border rounded-lg p-4 bg-muted/10 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Calculator className="size-3" />
              Order Summary
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <SummaryRow label="Total Factory Cost" value={totalFactoryCost} />
              <SummaryRow label="Total Admin Profit" value={totalAdminProfit} color="emerald" />
              <SummaryRow label="Total (pre-OB)" value={totalPreOb} />
              <SummaryRow label="OB Margin Rate" valueText={formatRate(obMarginRate)} />
              <SummaryRow label="OB Margin Amount" value={obMarginAmount} />
              <div className="col-span-2 md:col-span-1">
                <div className="text-[10px] text-muted-foreground">Final Total</div>
                <div className="text-lg font-black font-mono">{formatPKR(finalTotal)}</div>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <form.Field name="notes">
            {(field) => (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Any special instructions..."
                />
              </div>
            )}
          </form.Field>

          {/* ── Submit ── */}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Creating…" : `Create Order · ${formatPKR(finalTotal)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ORDER LINE ITEM (extracted for cleanliness)
   ──────────────────────────────────────────────────────────────────────────── */

function OrderLineItem({
  index,
  item,
  products,
  form,
  recipeCostsMap,
  obMarginRate,
  isManualOverride,
  onProductChange,
  onRateManualChange,
  onResetRate,
  onRemove,
  canRemove,
}: {
  index: number;
  item: OrderItemForm;
  products: any[];
  form: any;
  recipeCostsMap: Map<string, CostData> | undefined;
  obMarginRate: number;
  isManualOverride: boolean;
  onProductChange: (idx: number, productId: string) => void;
  onRateManualChange: (idx: number, value: number) => void;
  onResetRate: (idx: number) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { data: recipeList } = useQuery({
    queryKey: ["recipesByProduct", item.productId],
    queryFn: () => getRecipesByProductFn({ data: { productId: item.productId } }),
    enabled: !!item.productId,
  });

  const selectedRecipe = recipeList?.find((r) => r.id === item.recipeId);
  const containersPerCarton = selectedRecipe?.containersPerCarton ?? 12;
  const costData = item.recipeId ? recipeCostsMap?.get(item.recipeId) : null;
  const ppu = packsPerUnit(item.unitType, containersPerCarton);
  const costPerUnit = (costData?.costPerPack ?? 0) * ppu;

  // Auto-compute for preview (actual form value may be manually overridden)
  const computedRate = (costPerUnit + item.adminMargin) * (1 + obMarginRate / 100);
  const displayRate = isManualOverride ? item.rate : computedRate;
  const lineTotal = displayRate * item.quantity;

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Desktop Row */}
      <div className="hidden md:grid items-start gap-2 p-3" style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 0.7fr 1fr 32px" }}>
        {/* Product */}
        <form.Field name={`items[${index}].productId`} validators={{ onChange: z.string().min(1) }}>
          {(sf) => (
            <Select value={sf.state.value} onValueChange={(v) => onProductChange(index, v)}>
              <SelectTrigger className={`h-9 text-xs ${sf.state.meta.errors.length > 0 ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>

        {/* Recipe */}
        <form.Field name={`items[${index}].recipeId`} validators={{ onChange: z.string().min(1) }}>
          {(sf) => (
            <Select value={sf.state.value} onValueChange={(v) => sf.handleChange(v)} disabled={!item.productId}>
              <SelectTrigger className={`h-9 text-xs ${sf.state.meta.errors.length > 0 ? "border-destructive" : ""}`}>
                <SelectValue placeholder={item.productId ? "Select recipe…" : "Select product first"} />
              </SelectTrigger>
              <SelectContent>
                {(recipeList || []).map((r: Recipe) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>

        {/* Unit Type */}
        <form.Field name={`items[${index}].unitType`}>
          {(sf) => (
            <Select value={sf.state.value} onValueChange={(v: any) => sf.handleChange(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitTypeOptions.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    <span className="flex items-center gap-1.5 text-xs">{u.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>

        {/* Quantity */}
        <form.Field name={`items[${index}].quantity`} validators={{ onChange: z.number().min(1) }}>
          {(sf) => (
            <Input
              type="number"
              min={1}
              className={`h-9 text-xs ${sf.state.meta.errors.length > 0 ? "border-destructive" : ""}`}
              value={sf.state.value}
              onChange={(e) => sf.handleChange(Number(e.target.value))}
            />
          )}
        </form.Field>

        {/* Rate */}
        <form.Field name={`items[${index}].rate`}>
          {(sf) => (
            <div className="relative">
              <Input
                type="number"
                min={0}
                className={`h-9 text-xs pl-6 ${isManualOverride ? "border-amber-500/50" : ""}`}
                value={sf.state.value}
                onChange={(e) => onRateManualChange(index, Number(e.target.value))}
                aria-label="Rate per carton"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold pointer-events-none">₨</span>
            </div>
          )}
        </form.Field>

        {/* Remove */}
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove} className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-0.5" aria-label="Remove line item">
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Mobile */}
      <div className="md:hidden p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">Line #{index + 1}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove} className="h-7 text-destructive hover:bg-destructive/10" aria-label="Remove line item">
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <form.Field name={`items[${index}].productId`}>
            {(sf) => (
              <Select value={sf.state.value} onValueChange={(v) => onProductChange(index, v)}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Product…" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </form.Field>
          <form.Field name={`items[${index}].recipeId`}>
            {(sf) => (
              <Select value={sf.state.value} onValueChange={(v) => sf.handleChange(v)} disabled={!item.productId}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Recipe…" /></SelectTrigger>
                <SelectContent>
                  {(recipeList || []).map((r: Recipe) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </form.Field>
          <form.Field name={`items[${index}].unitType`}>
            {(sf) => (
              <Select value={sf.state.value} onValueChange={(v: any) => sf.handleChange(v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unitTypeOptions.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </form.Field>
          <form.Field name={`items[${index}].quantity`}>
            {(sf) => (
              <Input type="number" min={1} className="text-xs" value={sf.state.value} onChange={(e) => sf.handleChange(Number(e.target.value))} />
            )}
          </form.Field>
        </div>
      </div>

      {/* Pricing Chain (shown when recipe selected) */}
      {item.recipeId && selectedRecipe && (
        <div className="border-t px-3 py-3">
          <PricingChainCard
            recipeName={selectedRecipe.name}
            unitType={item.unitType}
            quantity={item.quantity}
            containersPerCarton={containersPerCarton}
            costData={costData ?? null}
            adminMargin={item.adminMargin}
            obMarginRate={obMarginRate}
            finalRate={displayRate}
            lineTotal={lineTotal}
            onAdminMarginChange={(v) => form.setFieldValue(`items[${index}].adminMargin`, v)}
            onFinalRateChange={(v) => onRateManualChange(index, v)}
            isManualOverride={isManualOverride}
            onResetRate={() => onResetRate(index)}
          />
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueText,
  color,
}: {
  label: string;
  value?: number;
  valueText?: string;
  color?: "emerald";
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-bold font-mono ${color === "emerald" ? "text-emerald-400" : ""}`}>
        {valueText ?? formatPKR(value ?? 0)}
      </div>
    </div>
  );
}

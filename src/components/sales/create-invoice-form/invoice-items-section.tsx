// -nocheck
import { useState, useEffect } from "react";
import { z } from "zod";
import {
    Loader2, Plus, Trash2, Package, AlertCircle, CheckCircle2, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ItemFormValue, StockItem } from "./utils";
import {
    PKR, safeEffectiveCPP, lineAmount,
    findStock, Section, CartonCompositionBadge, blankItem,
} from "./utils";

type InvoiceItemsSectionProps = {
    form: any;
    items: ItemFormValue[];
    availableStock: StockItem[];
    activeWarehouse: string;
    totalAmount: number;
    getCartonInfo: (recipeId: string) => any;
    handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
    recipePriceMap?: Map<string, { invoicePricePerPack: number; retailPricePerPack: number }>;
    discountRuleMap?: Map<string, any>;
    isDistributor?: boolean;
};

export const InvoiceItemsSection = ({
    form,
    items,
    availableStock,
    activeWarehouse,
    totalAmount,
    getCartonInfo,
    handleFocus,
    recipePriceMap,
    discountRuleMap = new Map(),
    isDistributor = false,
}: InvoiceItemsSectionProps) => {
    // ── Auto-apply free cartons for distributors ──
    useEffect(() => {
        if (!isDistributor) return;
        items.forEach((item, index) => {
            if (item.unitType !== "carton") return;
            const discountRule = discountRuleMap.get(item.recipeId);
            if (!discountRule) return;
            const autoFreeCartons = item.numberOfCartons >= discountRule.quantityThreshold
                ? Math.floor(item.numberOfCartons / discountRule.quantityThreshold) * discountRule.freeUnits
                : 0;
            const current = form.getFieldValue(`items[${index}].discountCartons`) || 0;
            if (current !== autoFreeCartons) {
                form.setFieldValue(`items[${index}].discountCartons`, autoFreeCartons);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDistributor, items, discountRuleMap, form]);

    return (
    <form.Field name="items">
        {(field: any) => (
            <div className="space-y-3">

                {/* Desktop column headers */}
                <div
                    className="hidden md:grid items-center gap-2 px-3 pb-1 border-b"
                    style={{ gridTemplateColumns: "2.2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 1fr 0.8fr 32px" }}
                >
                    {["Product", "Unit Type", "HSN", "Packs/Ctn", "Qty", "Unit Cost", "Retail MRP", "Amount", ""].map((h) => (
                        <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {h}
                        </div>
                    ))}
                </div>

                <div className="divide-y divide-border/40 rounded-xl border bg-muted/10 overflow-hidden">
                    {items.map((item, index) => {
                        // ── Per-item derived values
                        const stock = findStock(availableStock, item.recipeId);
                        const recipeDefault = stock?.recipe?.containersPerCarton || 1;
                        const eCPP = safeEffectiveCPP(recipeDefault);

                        const stockC = stock?.quantityCartons ?? 0;
                        const stockU = stock?.quantityContainers ?? 0;
                        const totalStockU = stockC * recipeDefault + stockU;

                        const requestedU = item.unitType === "carton"
                            ? ((item.numberOfCartons || 0) + (item.discountCartons || 0)) * eCPP
                            : (item.numberOfUnits || 0);

                        const amount = lineAmount(item, recipeDefault);

                        const perUnitCost = (item.perCartonPrice || 0) / eCPP;
                        const perUnitRetail = item.retailPrice || 0;
                        const unitMargin = perUnitRetail > 0 && perUnitCost > 0
                            ? perUnitRetail - perUnitCost
                            : null;

                        const stockExceeded = stock !== null && requestedU > totalStockU && totalStockU > 0;

                        // ── Auto-apply discount for distributors ──
                        const discountRule = isDistributor && item.unitType === "carton"
                            ? discountRuleMap.get(item.recipeId)
                            : null;
                        const autoFreeCartons = discountRule && item.numberOfCartons >= discountRule.quantityThreshold
                            ? Math.floor(item.numberOfCartons / discountRule.quantityThreshold) * discountRule.freeUnits
                            : 0;

                        return (
                            <div
                                key={index}
                                className={cn(
                                    "px-3 py-3 transition-colors",
                                    stockExceeded && "bg-destructive/5",
                                    !stockExceeded && index % 2 === 1 && "bg-muted/20",
                                )}
                            >
                                {/* ── Desktop layout ── */}
                                <div
                                    className="hidden md:grid items-start gap-2"
                                    style={{ gridTemplateColumns: "2.2fr 1fr 0.7fr 0.7fr 1.2fr 1fr 1fr 0.8fr 32px" }}
                                >
                                    {/* Product */}
                                    <form.Field
                                        name={`items[${index}].recipeId`}
                                        validators={{
                                            onChange: z.string().min(1, "Select product"),
                                            onSubmit: z.string().min(1, "Select product"),
                                        }}
                                    >
                                        {(sf: any) => (
                                            <div className="space-y-1">
                                                <Select
                                                    value={sf.state.value}
                                                    onValueChange={(val) => {
                                                        const s = findStock(availableStock, val);
                                                        sf.handleChange(val);
                                                        form.setFieldValue(`items[${index}].pack`, s?.recipe?.name || "");
                                                        if (s?.recipe?.hsnCode) {
                                                            form.setFieldValue(`items[${index}].hsnCode`, s.recipe.hsnCode);
                                                        }

                                                        const rp = recipePriceMap?.get(val);
                                                        if (rp) {
                                                            const cpp = s?.recipe?.containersPerCarton || 1;
                                                            form.setFieldValue(`items[${index}].perCartonPrice`, Math.round(rp.invoicePricePerPack * cpp));
                                                            form.setFieldValue(`items[${index}].retailPrice`, rp.retailPricePerPack);
                                                        } else if (s?.recipe?.estimatedCostPerContainer) {
                                                            const cpp = s.recipe.containersPerCarton || 1;
                                                            const perCartonCost = Number(s.recipe.estimatedCostPerContainer) * cpp;
                                                            if (perCartonCost > 0) {
                                                                form.setFieldValue(`items[${index}].perCartonPrice`, Math.round(perCartonCost));
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger
                                                        className={cn(
                                                            "h-9 text-xs",
                                                            stockExceeded && "border-destructive",
                                                            !sf.state.value && sf.state.meta.isTouched && "border-destructive",
                                                        )}
                                                    >
                                                        <SelectValue placeholder="Select product…" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableStock
                                                            .filter((s) => {
                                                                const cInfo = getCartonInfo(s.recipeId);
                                                                return cInfo.completeCartons > 0;
                                                            })
                                                            .map((s) => {
                                                                const cInfo = getCartonInfo(s.recipeId);
                                                                return (
                                                                    <SelectItem key={s.id} value={s.recipeId}>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-sm">{s.recipe?.name}</span>
                                                                            <Badge variant="secondary" className="text-[9px] px-1 h-4">
                                                                                {cInfo.completeCartons}C avail
                                                                            </Badge>
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                    </SelectContent>
                                                </Select>

                                                {/* Stock status indicator */}
                                                <div className="flex items-center gap-1 text-[10px]">
                                                    {stockExceeded ? (
                                                        <span className="text-destructive font-semibold flex items-center gap-0.5">
                                                            <AlertCircle className="size-3" aria-hidden="true" /> Exceeds stock
                                                        </span>
                                                    ) : stock ? (() => {
                                                        const cInfo = getCartonInfo(item.recipeId);
                                                        const hasComplete = cInfo.completeCartons > 0;
                                                        return (
                                                            <span className={cn("flex items-center gap-0.5", hasComplete ? "text-emerald-600" : "text-amber-600")}>
                                                                {hasComplete ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <AlertCircle className="size-3" aria-hidden="true" />}
                                                                {hasComplete
                                                                    ? `${cInfo.completeCartons} complete carton${cInfo.completeCartons !== 1 ? "s" : ""} available`
                                                                    : "No complete cartons available"}
                                                                {(item.discountCartons || 0) > 0 && (
                                                                    <span className="ml-1 text-purple-600 font-medium">+ {item.discountCartons} free</span>
                                                                )}
                                                                {discountRule && autoFreeCartons > 0 && (
                                                                    <span className="ml-1 text-purple-500 text-[9px]">(buy {discountRule.quantityThreshold} get {discountRule.freeUnits})</span>
                                                                )}
                                                            </span>
                                                        );
                                                    })() : (
                                                        <span className="text-muted-foreground">No stock info</span>
                                                    )}
                                                </div>

                                                {/* Free cartons — carton mode only */}
                                                {item.unitType === "carton" && (
                                                    <form.Field name={`items[${index}].discountCartons`}>
                                                        {(sf: any) => (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">Free ctns</span>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    className="h-6 w-14 text-[10px] pr-1 pl-1.5"
                                                                    value={sf.state.value}
                                                                    onFocus={handleFocus}
                                                                    onChange={(e) => sf.handleChange(Number(e.target.value))}
                                                                    title="Free cartons — deducted from stock, not billed"
                                                                    aria-label="Free cartons"
                                                                />
                                                            </div>
                                                        )}
                                                    </form.Field>
                                                )}

                                                <FieldError errors={sf.state.meta.errors} />

                                                {item.unitType === "carton" && stock && (
                                                    <CartonCompositionBadge recipeDefault={recipeDefault} effectiveValue={eCPP} />
                                                )}
                                            </div>
                                        )}
                                    </form.Field>

                                    {/* Unit type */}
                                    <form.Field name={`items[${index}].unitType`}>
                                        {(sf: any) => (
                                            <Select
                                                value={sf.state.value}
                                                onValueChange={(v: any) => {
                                                    sf.handleChange(v);
                                                    if (v === "carton") {
                                                        form.setFieldValue(`items[${index}].numberOfUnits`, 0);
                                                    } else {
                                                        form.setFieldValue(`items[${index}].numberOfCartons`, 0);
                                                        form.setFieldValue(`items[${index}].discountCartons`, 0);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-9 text-xs" aria-label="Select unit type"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="carton">
                                                        <span className="flex items-center gap-1.5 text-xs">
                                                            <Package className="size-3 text-primary" aria-hidden="true" /> Carton
                                                        </span>
                                                    </SelectItem>
                                                    <SelectItem value="units">
                                                        <span className="flex items-center gap-1.5 text-xs">
                                                            <Layers className="size-3 text-blue-500" aria-hidden="true" /> Loose
                                                        </span>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </form.Field>

                                    {/* HSN */}
                                    <form.Field name={`items[${index}].hsnCode`}>
                                        {(sf: any) => (
                                            <Input
                                                className={cn("h-9 text-xs", sf.state.meta.errors.length > 0 && "border-destructive")}
                                                placeholder="HSN"
                                                value={sf.state.value}
                                                onChange={(e) => sf.handleChange(e.target.value)}
                                                aria-label="HSN code"
                                            />
                                        )}
                                    </form.Field>

                                    {/* Packs/Ctn — read-only recipe default */}
                                    <div className="flex items-center justify-center h-9 text-xs tabular-nums text-muted-foreground bg-muted/30 rounded-md px-2">
                                        {item.unitType === "carton" ? `${eCPP} pk/ctn` : "—"}
                                    </div>

                                    {/* Qty */}
                                    <div>
                                        {item.unitType === "carton" ? (
                                            <form.Field name={`items[${index}].numberOfCartons`}>
                                                {(sf: any) => {
                                                    const cInfo = getCartonInfo(item.recipeId);
                                                    const maxCartons = cInfo.completeCartons || 0;
                                                    return (
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                max={maxCartons > 0 ? maxCartons : undefined}
                                                                className={cn("h-9 text-xs pr-10", stockExceeded && "border-destructive")}
                                                                value={sf.state.value}
                                                                onFocus={handleFocus}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    const clamped = maxCartons > 0 ? Math.min(val, maxCartons) : val;
                                                                    sf.handleChange(clamped);
                                                                }}
                                                                aria-label="Number of cartons"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-medium pointer-events-none">
                                                                ctn
                                                            </span>
                                                        </div>
                                                    );
                                                }}
                                            </form.Field>
                                        ) : (
                                            <form.Field name={`items[${index}].numberOfUnits`}>
                                                {(sf: any) => (
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className={cn("h-9 text-xs pr-8", stockExceeded && "border-destructive")}
                                                            value={sf.state.value}
                                                            onFocus={handleFocus}
                                                            onChange={(e) => sf.handleChange(Number(e.target.value))}
                                                            aria-label="Number of units"
                                                        />
                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-medium pointer-events-none">
                                                            u
                                                        </span>
                                                    </div>
                                                )}
                                            </form.Field>
                                        )}
                                    </div>

                                    {/* Unit cost (per carton) */}
                                    <form.Field name={`items[${index}].perCartonPrice`}>
                                        {(sf: any) => (
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="h-9 text-xs pl-7"
                                                    value={sf.state.value}
                                                    onFocus={handleFocus}
                                                    onChange={(e) => sf.handleChange(Number(e.target.value))}
                                                    aria-label="Price per carton"
                                                />
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-semibold pointer-events-none">
                                                    ₨
                                                </span>
                                                <span className="block text-[9px] text-center text-muted-foreground mt-0.5">
                                                    {stock && item.unitType === "carton"
                                                        ? `= ${eCPP} pks × ₨${((item.perCartonPrice || 0) / eCPP).toFixed(1)}`
                                                        : "/carton"}
                                                </span>
                                            </div>
                                        )}
                                    </form.Field>

                                    {/* Retail MRP */}
                                    <form.Field name={`items[${index}].retailPrice`}>
                                        {(sf: any) => (
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="h-9 text-xs pl-7"
                                                    value={sf.state.value}
                                                    onFocus={handleFocus}
                                                    onChange={(e) => sf.handleChange(Number(e.target.value))}
                                                    aria-label="Retail price per unit"
                                                />
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-semibold pointer-events-none">
                                                    ₨
                                                </span>
                                                <span className="block text-[9px] text-center text-muted-foreground mt-0.5">/unit MRP</span>
                                            </div>
                                        )}
                                    </form.Field>

                                    {/* Amount + margin */}
                                    <div className="pt-0.5 space-y-1">
                                        <div className="font-bold text-sm text-right tabular-nums text-foreground">
                                            {PKR(amount)}
                                        </div>
                                        {unitMargin !== null && (
                                            <div className={cn(
                                                "text-[10px] font-semibold text-right tabular-nums",
                                                unitMargin < 0 ? "text-destructive" : "text-emerald-600",
                                            )}>
                                                {unitMargin >= 0 ? "+" : ""}{PKR(unitMargin)}/u
                                            </div>
                                        )}
                                    </div>

                                    {/* Remove */}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => field.removeValue(index)}
                                        disabled={field.state.value.length === 1}
                                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-0.5"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>

                                {/* ── Mobile card ── */}
                                <div className="md:hidden space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            Line #{index + 1}
                                        </Badge>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => field.removeValue(index)}
                                            disabled={field.state.value.length === 1}
                                            className="h-7 text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>

                                    {stockExceeded && (
                                        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                                            <AlertCircle className="size-3.5 shrink-0" />
                                            Exceeds available stock: {stockC}C / {stockU}U
                                        </div>
                                    )}

                                    <div className="space-y-3 text-sm">
                                        <form.Field name={`items[${index}].recipeId`}>
                                            {(sf: any) => (
                                                <div>
                                                    <label className="text-xs font-semibold">Product</label>
                                                    <Select value={sf.state.value} onValueChange={(val) => {
                                                        const s = findStock(availableStock, val);
                                                        sf.handleChange(val);
                                                        form.setFieldValue(`items[${index}].pack`, s?.recipe?.name || "");
                                                        if (s?.recipe?.hsnCode) {
                                                            form.setFieldValue(`items[${index}].hsnCode`, s.recipe.hsnCode);
                                                        }

                                                        const rp = recipePriceMap?.get(val);
                                                        if (rp) {
                                                            const cpp = s?.recipe?.containersPerCarton || 1;
                                                            form.setFieldValue(`items[${index}].perCartonPrice`, Math.round(rp.invoicePricePerPack * cpp));
                                                            form.setFieldValue(`items[${index}].retailPrice`, rp.retailPricePerPack);
                                                        } else if (s?.recipe?.estimatedCostPerContainer) {
                                                            const cpp = s.recipe.containersPerCarton || 1;
                                                            const perCartonCost = Number(s.recipe.estimatedCostPerContainer) * cpp;
                                                            if (perCartonCost > 0) {
                                                                form.setFieldValue(`items[${index}].perCartonPrice`, Math.round(perCartonCost));
                                                            }
                                                        }
                                                    }}>
                                                        <SelectTrigger className="text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                                                        <SelectContent>
                                                            {availableStock
                                                                .filter((s) => {
                                                                    const cInfo = getCartonInfo(s.recipeId);
                                                                    return cInfo.completeCartons > 0;
                                                                })
                                                                .map((s) => (
                                                                    <SelectItem key={s.id} value={s.recipeId}>{s.recipe?.name}</SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </form.Field>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-semibold">Type</label>
                                                <form.Field name={`items[${index}].unitType`}>
                                                    {(sf: any) => (
                                                        <Select value={sf.state.value} onValueChange={(v: any) => sf.handleChange(v)}>
                                                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="carton">Carton</SelectItem>
                                                                <SelectItem value="units">Loose</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </form.Field>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold">Qty</label>
                                                {item.unitType === "carton" ? (
                                                    <form.Field name={`items[${index}].numberOfCartons`}>
                                                        {(sf: any) => {
                                                            const cInfo = getCartonInfo(item.recipeId);
                                                            const maxCartons = cInfo.completeCartons || 0;
                                                            return (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max={maxCartons > 0 ? maxCartons : undefined}
                                                                    className="text-xs"
                                                                    value={sf.state.value}
                                                                    onFocus={handleFocus}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value);
                                                                        const clamped = maxCartons > 0 ? Math.min(val, maxCartons) : val;
                                                                        sf.handleChange(clamped);
                                                                    }}
                                                                />
                                                            );
                                                        }}
                                                    </form.Field>
                                                ) : (
                                                    <form.Field name={`items[${index}].numberOfUnits`}>
                                                        {(sf: any) => <Input type="number" min="0" className="text-xs" value={sf.state.value} onFocus={handleFocus} onChange={(e) => sf.handleChange(Number(e.target.value))} />}
                                                    </form.Field>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-semibold">Price/Ctn</label>
                                                <form.Field name={`items[${index}].perCartonPrice`}>
                                                    {(sf: any) => <Input type="number" min="0" className="text-xs" value={sf.state.value} onFocus={handleFocus} onChange={(e) => sf.handleChange(Number(e.target.value))} />}
                                                </form.Field>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold">MRP/U</label>
                                                <form.Field name={`items[${index}].retailPrice`}>
                                                    {(sf: any) => <Input type="number" min="0" className="text-xs" value={sf.state.value} onFocus={handleFocus} onChange={(e) => sf.handleChange(Number(e.target.value))} />}
                                                </form.Field>
                                            </div>
                                        </div>

                                        <div className="flex justify-between border-t pt-2">
                                            <span className="text-xs text-muted-foreground">Total</span>
                                            <span className="font-bold">{PKR(amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add line button */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue(blankItem())}
                    disabled={!activeWarehouse}
                    className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground hover:border-primary mt-1 h-9"
                >
                    <Plus className="size-4" /> Add Product Line
                </Button>

                {/* Running subtotal */}
                {totalAmount > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-primary/5 rounded-lg border border-primary/20 mt-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                            {items.length} item{items.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-sm font-extrabold text-primary tabular-nums">
                            {PKR(totalAmount)}
                        </span>
                    </div>
                )}
            </div>
        )}
    </form.Field>
);
};

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  Package,
  Boxes,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Banknote,
  Scale,
  Percent,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/custom/date-range-picker";
import { formatPKR, formatNumber } from "@/lib/currency-format";
import { format, parseISO } from "date-fns";
import { type DateRange } from "react-day-picker";
import { type ProductProfitLossResult } from "@/server-functions/inventory/products/get-product-profit-loss-fn";

/* ────────────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────────────── */

interface ProductProfitLossViewProps {
  data: ProductProfitLossResult;
  dateRange: DateRange | undefined;
  onDateChange: (range: DateRange | undefined) => void;
  onApply: () => void;
  isPending?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
   UTILITIES
   ──────────────────────────────────────────────────────────────────────────── */

function marginColorClass(margin: number): string {
  if (margin > 15) return "text-emerald-400";
  if (margin > 5) return "text-emerald-300";
  if (margin > 0) return "text-amber-400";
  if (margin === 0) return "text-slate-400";
  return "text-rose-400";
}

function marginBgClass(margin: number): string {
  if (margin > 15) return "bg-emerald-500";
  if (margin > 5) return "bg-emerald-400";
  if (margin > 0) return "bg-amber-400";
  if (margin === 0) return "bg-slate-500";
  return "bg-rose-500";
}

function profitIcon(profit: number) {
  if (profit > 0) return <TrendingUp className="size-4 text-emerald-400" />;
  if (profit < 0) return <TrendingDown className="size-4 text-rose-400" />;
  return <Minus className="size-4 text-slate-400" />;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "paid") return "default";
  if (status === "partially_paid") return "secondary";
  return "outline";
}

function statusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "partially_paid") return "Partial";
  return status;
}

/* ────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────────────────────────── */

export function ProductProfitLossView({
  data,
  dateRange,
  onDateChange,
  onApply,
  isPending,
}: ProductProfitLossViewProps) {
  const { product, recipes, globalSummary } = data;

  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(() => {
    // Expand first recipe by default if exists
    if (recipes.length > 0) return new Set([recipes[0].id]);
    return new Set();
  });

  const toggleRecipe = (id: string) => {
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasData = recipes.length > 0 && globalSummary.totalRevenue > 0;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO HEADER
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden border bg-card">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(16,185,129,0.03),transparent,rgba(244,63,94,0.03))]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <Link to="/manufacturing/recipes">
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 mt-0.5"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                    {product.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className="capitalize text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 h-5"
                  >
                    {product.category || "Uncategorized"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">
                  {product.description || "No description provided"}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-mono">
                    <FlaskConical className="size-3.5" />
                    {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono">
                    <Receipt className="size-3.5" />
                    {globalSummary.totalInvoices} invoice
                    {globalSummary.totalInvoices !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Date Filter Bar */}
            <div className="flex flex-col gap-2 min-w-[280px] max-w-[320px]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Reporting Period
              </label>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={onDateChange}
                className="w-full"
              />
              <Button
                onClick={onApply}
                disabled={isPending || !dateRange?.from}
                size="sm"
                className="w-full"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-3.5" />
                    Apply Filter
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          GLOBAL SUMMARY CARDS
         ═══════════════════════════════════════════════════════════════════════ */}
      {hasData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={<Banknote className="size-4" />}
            label="Total Revenue"
            value={formatPKR(globalSummary.totalRevenue, false)}
            color="slate"
          />
          <SummaryCard
            icon={<Scale className="size-4" />}
            label="Total COGS"
            value={formatPKR(globalSummary.totalCogs, false)}
            color="slate"
          />
          <SummaryCard
            icon={profitIcon(globalSummary.netProfit)}
            label="Net Profit"
            value={formatPKR(globalSummary.netProfit, false)}
            color={globalSummary.netProfit >= 0 ? "emerald" : "rose"}
            highlight
          />
          <SummaryCard
            icon={<Percent className="size-4" />}
            label="Overall Margin"
            value={`${globalSummary.overallMargin.toFixed(1)}%`}
            color={globalSummary.overallMargin >= 0 ? "emerald" : "rose"}
          />
        </div>
      ) : (
        <EmptyStateCard
          icon={<FileText className="size-5" />}
          title="No Financial Data"
          description="No paid or partial invoices found for the selected period."
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          RECIPE BREAKDOWN
         ═══════════════════════════════════════════════════════════════════════ */}
      {recipes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Recipe Breakdown
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {format(parseISO(data.dateFrom), "dd MMM yyyy")} —{" "}
              {format(parseISO(data.dateTo), "dd MMM yyyy")}
            </span>
          </div>

          <div className="space-y-3">
            {recipes.map((recipe) => (
              <RecipeProfitCard
                key={recipe.id}
                recipe={recipe}
                isExpanded={expandedRecipes.has(recipe.id)}
                onToggle={() => toggleRecipe(recipe.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ──────────────────────────────────────────────────────────────────────────── */

function SummaryCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "slate" | "emerald" | "rose";
  highlight?: boolean;
}) {
  const colorClasses = {
    slate: "border-slate-500/20 text-slate-300",
    emerald: "border-emerald-500/20 text-emerald-400",
    rose: "border-rose-500/20 text-rose-400",
  };

  return (
    <div
      className={`border ${colorClasses[color]} ${
        highlight ? "bg-emerald-500/5" : "bg-card"
      } p-4 space-y-2`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className="text-xl md:text-2xl font-black font-mono tracking-tight">
        {value}
      </div>
    </div>
  );
}

function RecipeProfitCard({
  recipe,
  isExpanded,
  onToggle,
}: {
  recipe: ProductProfitLossResult["recipes"][number];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const margin = recipe.marginPercent;
  const hasInvoices = recipe.invoices.length > 0;

  return (
    <div className="border bg-card overflow-hidden">
      {/* Recipe Header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 md:p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {isExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="size-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">{recipe.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Boxes className="size-3" />
                  {formatNumber(recipe.cartonsSold)} cartons
                </span>
                <span className="flex items-center gap-1">
                  <Package className="size-3" />
                  {formatNumber(recipe.unitsSold)} units
                </span>
                <span className="flex items-center gap-1">
                  <Receipt className="size-3" />
                  {recipe.invoiceCount} invoice
                  {recipe.invoiceCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Margin Bar */}
            <div className="hidden md:block w-32">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>Margin</span>
                <span className={marginColorClass(margin)}>
                  {margin.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-muted overflow-hidden">
                <div
                  className={`h-full ${marginBgClass(margin)} transition-all duration-500`}
                  style={{
                    width: `${Math.min(Math.abs(margin), 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="text-right">
              <div className="text-sm font-black font-mono">
                {formatPKR(recipe.profit, false)}
              </div>
              <div
                className={`text-[10px] font-mono ${marginColorClass(margin)}`}
              >
                {margin.toFixed(1)}% margin
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Invoice Table */}
      {isExpanded && (
        <div className="border-t">
          {hasInvoices ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Invoice
                    </th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Customer
                    </th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Revenue
                    </th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      COGS
                    </th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.invoices.map((inv) => (
                    <tr
                      key={inv.invoiceId}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {format(parseISO(inv.date), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {inv.slipNumber || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{inv.customerName}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={statusBadgeVariant(inv.status)}
                          className="text-[10px] h-5 px-1.5"
                        >
                          {statusLabel(inv.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {formatPKR(inv.revenue, false)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                        {formatPKR(inv.cogs, false)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${marginColorClass(
                          inv.revenue > 0
                            ? ((inv.profit / inv.revenue) * 100)
                            : 0,
                        )}`}
                      >
                        {formatPKR(inv.profit, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-border">
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Recipe Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                      {formatPKR(recipe.revenue, false)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-muted-foreground">
                      {formatPKR(recipe.cogs, false)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-sm font-bold ${marginColorClass(
                        recipe.marginPercent,
                      )}`}
                    >
                      {formatPKR(recipe.profit, false)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No invoices found for this recipe in the selected period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyStateCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed bg-card/50 p-8 text-center space-y-3">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted">
        {icon}
      </div>
      <h3 className="font-bold text-sm">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

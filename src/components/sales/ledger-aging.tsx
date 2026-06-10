/**
 * Aging Analysis Component for Ledger
 * Displays overdue amounts in buckets: Current, 1-30, 31-60, 61-90, 90+ days
 */

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, Check } from "lucide-react";
import { formatPKR } from "@/lib/currency-format";
import type { AgingAnalysis } from "@/lib/ledger-types";

interface LedgerAgingProps {
  aging: AgingAnalysis;
  className?: string;
}

export function LedgerAging({ aging, className }: LedgerAgingProps) {
  if (aging.totalOutstanding === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-green-500" />
            Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-green-500" />
            No outstanding amount. All invoices are current.
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxAmount = Math.max(...aging.buckets.map((b) => b.amount), 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="size-4 text-blue-500" />
          Aging Analysis
          {aging.totalOutstanding > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              Total Outstanding: {formatPKR(aging.totalOutstanding, false)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {aging.buckets.map((bucket) => {
          const percentage = maxAmount > 0 ? (bucket.amount / maxAmount) * 100 : 0;
          return (
            <div key={bucket.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{bucket.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{bucket.count} invoice{bucket.count !== 1 ? "s" : ""}</span>
                  <span className="font-semibold tabular-nums" style={{ color: bucket.color }}>
                    {formatPKR(bucket.amount, false)}
                  </span>
                </div>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(percentage, 0.5)}%`,
                    backgroundColor: bucket.color,
                    opacity: bucket.amount > 0 ? 1 : 0.3,
                  }}
                />
              </div>
            </div>
          );
        })}
        {aging.oldestInvoiceDate && (
          <div className="flex items-center gap-2 pt-2 border-t text-xs text-amber-600">
            <AlertTriangle className="size-3" />
            <span>Oldest unpaid invoice from {format(new Date(aging.oldestInvoiceDate), "dd MMM yyyy")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

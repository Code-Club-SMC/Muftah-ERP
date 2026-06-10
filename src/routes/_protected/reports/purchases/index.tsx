import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import {
  SectionTitle,
  SummaryCard,
  ReportTable,
  ReportTableRow,
  ReportCell,
} from "@/components/reports/report-primitives";
import { getPurchasesReportFn } from "@/server-functions/reports/purchases-report-fn";
import { formatNumber, formatPKR, formatQuantity } from "@/lib/currency-format";
import { Badge } from "@/components/ui/badge";

const ACCENT = "amber";

export const Route = createFileRoute("/_protected/reports/purchases/")({
  component: PurchasesReportPage,
});

function PurchasesReportPage() {
  const [params, setParams] = useState<{ dateFrom?: string; dateTo?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "purchases", params?.dateFrom, params?.dateTo],
    queryFn: () => getPurchasesReportFn({ data: params ?? {} }),
    enabled: !!params,
  });

  const handleGenerate = (range: DateRange | undefined) => {
    setParams({
      dateFrom: range?.from?.toISOString(),
      dateTo: range?.to?.toISOString(),
    });
  };

  const isEmpty = !data || data.purchases.length === 0;

  return (
    <ReportPageShell
      title="Purchases Report"
      subtitle="Supplier purchases with material details, quantities, costs, and payment status."
      onGenerate={handleGenerate}
      isLoading={isLoading}
      isEmpty={isEmpty}
      accentColor={ACCENT}
    >
      {data && (
        <div className="space-y-8">
          <section>
            <SectionTitle accentColor={ACCENT}>Period Summary</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
              <SummaryCard label="Purchases" value={formatNumber(data.summary.count)} accentColor={ACCENT} />
              <SummaryCard label="Total Cost" value={formatPKR(data.summary.totalCost, false)} accentColor={ACCENT} />
              <SummaryCard label="Total Paid" value={formatPKR(data.summary.totalPaid, false)} accentColor={ACCENT} />
              <SummaryCard label="Outstanding" value={formatPKR(data.summary.totalOutstanding, false)} accentColor={ACCENT} />
            </div>
          </section>

          <section>
            <SectionTitle accentColor={ACCENT}>Purchase Records</SectionTitle>
            <ReportTable
              headers={["Date", "Invoice #", "Supplier", "Warehouse", "Material", "Type", "Quantity", "Unit Cost", "Total", "Paid", "Method", "Status"]}
            >
              {data.purchases.map((p) => {
                const isFullyPaid = p.paidAmount >= p.cost;
                const isPartial = p.paidAmount > 0 && p.paidAmount < p.cost;
                return (
                  <ReportTableRow key={p.purchaseId} accentColor={ACCENT}>
                    <ReportCell muted>
                      {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </ReportCell>
                    <ReportCell mono muted>{p.invoiceNumber || "—"}</ReportCell>
                    <ReportCell bold>{p.supplierName}</ReportCell>
                    <ReportCell>{p.warehouseName}</ReportCell>
                    <ReportCell>{p.materialName}</ReportCell>
                    <ReportCell muted className="capitalize">{p.materialType}</ReportCell>
                    <ReportCell align="right" mono bold>{formatQuantity(p.quantity, p.unit)}</ReportCell>
                    <ReportCell align="right" mono>{formatPKR(p.unitCost, false)}</ReportCell>
                    <ReportCell align="right" mono bold>{formatPKR(p.cost, false)}</ReportCell>
                    <ReportCell align="right" mono>{formatPKR(p.paidAmount, false)}</ReportCell>
                    <ReportCell muted className="capitalize">{p.paymentMethod || "—"}</ReportCell>
                    <ReportCell>
                      {isFullyPaid ? (
                        <Badge variant="default" className="text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Paid</Badge>
                      ) : isPartial ? (
                        <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Partial</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-400/30">Unpaid</Badge>
                      )}
                    </ReportCell>
                  </ReportTableRow>
                );
              })}
            </ReportTable>
          </section>
        </div>
      )}
    </ReportPageShell>
  );
}

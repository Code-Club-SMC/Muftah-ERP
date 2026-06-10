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
  EmptySection,
} from "@/components/reports/report-primitives";
import { getExpensesReportFn } from "@/server-functions/reports/expenses-report-fn";
import { formatNumber, formatPKR } from "@/lib/currency-format";
import { Badge } from "@/components/ui/badge";

const ACCENT = "violet";

export const Route = createFileRoute("/_protected/reports/expenses/")({
  component: ExpensesReportPage,
});

function ExpensesReportPage() {
  const [params, setParams] = useState<{ dateFrom?: string; dateTo?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "expenses", params?.dateFrom, params?.dateTo],
    queryFn: () => getExpensesReportFn({ data: params ?? {} }),
    enabled: !!params,
  });

  const handleGenerate = (range: DateRange | undefined) => {
    setParams({
      dateFrom: range?.from?.toISOString(),
      dateTo: range?.to?.toISOString(),
    });
  };

  const isEmpty = !data || (data.financeExpenses.length === 0 && data.productionCosts.length === 0);

  return (
    <ReportPageShell
      title="Expenses Report"
      subtitle="Finance expenses and production costs for the selected period."
      onGenerate={handleGenerate}
      isLoading={isLoading}
      isEmpty={isEmpty}
      accentColor={ACCENT}
    >
      {data && (
        <div className="space-y-8">
          <section>
            <SectionTitle accentColor={ACCENT}>Period Summary</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3">
              <SummaryCard label="Finance Expenses" value={formatPKR(data.summary.totalFinanceExpenses, false)} accentColor={ACCENT} />
              <SummaryCard label="Production Costs" value={formatPKR(data.summary.totalProductionCosts, false)} accentColor={ACCENT} />
              <SummaryCard label="Grand Total" value={formatPKR(data.summary.grandTotal, false)} accentColor={ACCENT} />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-5 rounded bg-violet-500" />
              <h2 className="text-base font-semibold tracking-tight">General Expenses</h2>
              <Badge variant="secondary" className="text-[10px]">Finance</Badge>
            </div>
            {data.financeExpenses.length === 0 ? (
              <EmptySection message="No finance expenses recorded for this period." />
            ) : (
              <ReportTable
                headers={["Date", "Category", "Description", "Wallet", "Slip #", "Amount"]}
              >
                {data.financeExpenses.map((e) => (
                  <ReportTableRow key={e.expenseId} accentColor={ACCENT}>
                    <ReportCell muted>
                      {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </ReportCell>
                    <ReportCell bold>{e.categoryName || "Uncategorized"}</ReportCell>
                    <ReportCell>{e.description || "—"}</ReportCell>
                    <ReportCell muted>{e.walletName || "—"}</ReportCell>
                    <ReportCell mono muted>{e.slipNumber || "—"}</ReportCell>
                    <ReportCell align="right" mono bold>{formatPKR(e.amount, false)}</ReportCell>
                  </ReportTableRow>
                ))}
              </ReportTable>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-5 rounded bg-amber-500" />
              <h2 className="text-base font-semibold tracking-tight">Manufacturing Costs</h2>
              <Badge variant="secondary" className="text-[10px]">Production</Badge>
            </div>
            {data.productionCosts.length === 0 ? (
              <EmptySection message="No production costs recorded for this period." />
            ) : (
              <ReportTable
                headers={["Batch ID", "Completed", "Product", "Recipe", "Warehouse", "Containers", "Chemical Cost", "Packaging Cost", "Total Cost", "Actual/Pack", "Budget/Pack"]}
              >
                {data.productionCosts.map((p) => (
                  <ReportTableRow key={p.runId} accentColor={ACCENT}>
                    <ReportCell mono bold>{p.batchId}</ReportCell>
                    <ReportCell muted>
                      {p.actualCompletionDate ? new Date(p.actualCompletionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </ReportCell>
                    <ReportCell>{p.productName}</ReportCell>
                    <ReportCell>{p.recipeName}</ReportCell>
                    <ReportCell muted>{p.warehouseName}</ReportCell>
                    <ReportCell align="right" mono>{formatNumber(p.containersProduced)}</ReportCell>
                    <ReportCell align="right" mono>{formatPKR(p.totalChemicalCost, false)}</ReportCell>
                    <ReportCell align="right" mono>{formatPKR(p.totalPackagingCost, false)}</ReportCell>
                    <ReportCell align="right" mono bold>{formatPKR(p.totalProductionCost, false)}</ReportCell>
                    <ReportCell align="right" mono>{p.actualCostPerPack > 0 ? formatPKR(p.actualCostPerPack, false) : "—"}</ReportCell>
                    <ReportCell align="right" mono muted>{formatPKR(p.costPerContainer, false)}</ReportCell>
                  </ReportTableRow>
                ))}
              </ReportTable>
            )}
          </section>
        </div>
      )}
    </ReportPageShell>
  );
}

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
import { getSalesReportFn } from "@/server-functions/reports/sales-report-fn";
import { formatNumber, formatPKR } from "@/lib/currency-format";

const ACCENT = "emerald";

export const Route = createFileRoute("/_protected/reports/sales/")({
  component: SalesReportPage,
});

function SalesReportPage() {
  const [params, setParams] = useState<{ dateFrom?: string; dateTo?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "sales", params?.dateFrom, params?.dateTo],
    queryFn: () => getSalesReportFn({ data: params ?? {} }),
    enabled: !!params,
  });

  const handleGenerate = (range: DateRange | undefined) => {
    setParams({
      dateFrom: range?.from?.toISOString(),
      dateTo: range?.to?.toISOString(),
    });
  };

  const isEmpty = !data || data.invoices.length === 0;

  return (
    <ReportPageShell
      title="Sales Report"
      subtitle="Finalized sales invoices and line items for the selected period."
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
              <SummaryCard label="Invoices" value={formatNumber(data.summary.count)} accentColor={ACCENT} />
              <SummaryCard label="Total Cash" value={formatPKR(data.summary.totalCash, false)} accentColor={ACCENT} />
              <SummaryCard label="Total Credit" value={formatPKR(data.summary.totalCredit, false)} accentColor={ACCENT} />
              <SummaryCard label="Total Revenue" value={formatPKR(data.summary.totalRevenue, false)} accentColor={ACCENT} />
            </div>
          </section>

          <section>
            <SectionTitle accentColor={ACCENT}>Invoice Summary</SectionTitle>
            <ReportTable
              headers={["Date", "Invoice #", "Customer", "Type", "Items", "Cash", "Credit", "Total"]}
            >
              {data.invoices.map((inv) => (
                <ReportTableRow key={inv.invoiceId} accentColor={ACCENT}>
                  <ReportCell muted>
                    {inv.date ? new Date(inv.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </ReportCell>
                  <ReportCell mono>{inv.sNo}</ReportCell>
                  <ReportCell bold>{inv.customerName}</ReportCell>
                  <ReportCell muted className="capitalize">{inv.customerType}</ReportCell>
                  <ReportCell>{formatNumber(inv.items.length)} items</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(inv.cash, false)}</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(inv.credit, false)}</ReportCell>
                  <ReportCell align="right" mono bold>{formatPKR(inv.totalPrice, false)}</ReportCell>
                </ReportTableRow>
              ))}
            </ReportTable>
          </section>

          <section>
            <SectionTitle accentColor={ACCENT}>Line Item Detail</SectionTitle>
            <ReportTable
              headers={["Invoice #", "Product", "HSN Code", "Cartons", "Units", "Price/Carton", "Amount"]}
            >
              {data.invoices.flatMap((inv) =>
                inv.items.map((item, idx) => (
                  <ReportTableRow key={`${inv.invoiceId}-${idx}`} accentColor={ACCENT}>
                    <ReportCell mono muted>{inv.sNo}</ReportCell>
                    <ReportCell>{item.pack}</ReportCell>
                    <ReportCell mono muted>{item.hsnCode}</ReportCell>
                    <ReportCell align="right" mono>{formatNumber(item.cartons)}</ReportCell>
                    <ReportCell align="right" mono>{formatNumber(item.units)}</ReportCell>
                    <ReportCell align="right" mono>{formatPKR(item.perCartonPrice, false)}</ReportCell>
                    <ReportCell align="right" mono bold>{formatPKR(item.amount, false)}</ReportCell>
                  </ReportTableRow>
                )),
              )}
            </ReportTable>
          </section>
        </div>
      )}
    </ReportPageShell>
  );
}

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
import { getCreditsReportFn } from "@/server-functions/reports/credits-report-fn";
import { formatNumber, formatPKR } from "@/lib/currency-format";
import { Badge } from "@/components/ui/badge";

const ACCENT = "rose";

export const Route = createFileRoute("/_protected/reports/credits/")({
  component: CreditsReportPage,
});

function CreditsReportPage() {
  const [params, setParams] = useState<{ dateFrom?: string; dateTo?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "credits", params?.dateFrom, params?.dateTo],
    queryFn: () => getCreditsReportFn({ data: params ?? {} }),
    enabled: !!params,
  });

  const handleGenerate = (range: DateRange | undefined) => {
    setParams({
      dateFrom: range?.from?.toISOString(),
      dateTo: range?.to?.toISOString(),
    });
  };

  const isEmpty = !data || data.slips.length === 0;

  return (
    <ReportPageShell
      title="Credits Report"
      subtitle="Credit slips, recovery status, and outstanding balances for the selected period."
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
              <SummaryCard label="Total Slips" value={formatNumber(data.summary.count)} accentColor={ACCENT} />
              <SummaryCard label="Total Due" value={formatPKR(data.summary.totalDue, false)} accentColor={ACCENT} />
              <SummaryCard label="Total Recovered" value={formatPKR(data.summary.totalRecovered, false)} accentColor={ACCENT} />
              <SummaryCard label="Outstanding" value={formatPKR(data.summary.outstanding, false)} accentColor={ACCENT} />
            </div>
          </section>

          <section>
            <SectionTitle accentColor={ACCENT}>Credit Slips</SectionTitle>
            <ReportTable
              headers={["Slip #", "Issued", "Customer", "Type", "Salesman", "Status", "Recovery", "Due", "Recovered", "Balance"]}
            >
              {data.slips.map((slip) => (
                <ReportTableRow key={slip.slipId} accentColor={ACCENT}>
                  <ReportCell mono>{slip.slipNumber}</ReportCell>
                  <ReportCell muted>
                    {slip.issuedAt ? new Date(slip.issuedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </ReportCell>
                  <ReportCell bold>{slip.customerName}</ReportCell>
                  <ReportCell muted className="capitalize">{slip.customerType}</ReportCell>
                  <ReportCell>{slip.salesmanName || "—"}</ReportCell>
                  <ReportCell>
                    <Badge variant={slip.status === "closed" ? "default" : "secondary"} className="text-[10px]">
                      {slip.status}
                    </Badge>
                  </ReportCell>
                  <ReportCell>
                    <Badge variant={slip.recoveryStatus === "resolved" ? "default" : "outline"} className="text-[10px]">
                      {slip.recoveryStatus || "pending"}
                    </Badge>
                  </ReportCell>
                  <ReportCell align="right" mono>{formatPKR(slip.amountDue, false)}</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(slip.amountRecovered, false)}</ReportCell>
                  <ReportCell align="right" mono bold className={slip.amountDue - slip.amountRecovered > 0 ? "text-rose-500" : ""}>
                    {formatPKR(slip.amountDue - slip.amountRecovered, false)}
                  </ReportCell>
                </ReportTableRow>
              ))}
            </ReportTable>
          </section>
        </div>
      )}
    </ReportPageShell>
  );
}

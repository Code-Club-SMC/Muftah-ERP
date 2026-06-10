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
import { getSalariesReportFn } from "@/server-functions/reports/salaries-report-fn";
import { formatNumber, formatPKR } from "@/lib/currency-format";

const ACCENT = "blue";

export const Route = createFileRoute("/_protected/reports/salaries/")({
  component: SalariesReportPage,
});

function SalariesReportPage() {
  const [params, setParams] = useState<{ dateFrom?: string; dateTo?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "salaries", params?.dateFrom, params?.dateTo],
    queryFn: () => getSalariesReportFn({ data: params ?? {} }),
    enabled: !!params,
  });

  const handleGenerate = (range: DateRange | undefined) => {
    setParams({
      dateFrom: range?.from?.toISOString(),
      dateTo: range?.to?.toISOString(),
    });
  };

  const isEmpty = !data || data.payslips.length === 0;

  return (
    <ReportPageShell
      title="Salaries Report"
      subtitle="Payslip data with earnings, deductions, and net pay for the selected period."
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
              <SummaryCard label="Payslips" value={formatNumber(data.summary.count)} accentColor={ACCENT} />
              <SummaryCard label="Total Gross" value={formatPKR(data.summary.totalGross, false)} accentColor={ACCENT} />
              <SummaryCard label="Total Deductions" value={formatPKR(data.summary.totalDeductions, false)} accentColor={ACCENT} />
              <SummaryCard label="Total Net" value={formatPKR(data.summary.totalNet, false)} accentColor={ACCENT} />
            </div>
          </section>

          <section>
            <SectionTitle accentColor={ACCENT}>Payslip Detail</SectionTitle>
            <ReportTable
              headers={["Employee", "Code", "Designation", "Month", "Present", "Absent", "Basic", "Incentive", "OT", "Bonus", "Gross", "Deductions", "Net"]}
            >
              {data.payslips.map((p) => (
                <ReportTableRow key={p.payslipId} accentColor={ACCENT}>
                  <ReportCell bold>{p.employeeName}</ReportCell>
                  <ReportCell mono muted>{p.employeeCode}</ReportCell>
                  <ReportCell>{p.designation}</ReportCell>
                  <ReportCell muted>
                    {p.payrollMonth ? new Date(p.payrollMonth).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}
                  </ReportCell>
                  <ReportCell align="right" mono>{p.daysPresent}</ReportCell>
                  <ReportCell align="right" mono>{p.daysAbsent}</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(p.basicSalary, false)}</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(p.incentiveAmount, false)}</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(p.overtimeAmount, false)}</ReportCell>
                  <ReportCell align="right" mono>{formatPKR(p.bonusAmount, false)}</ReportCell>
                  <ReportCell align="right" mono bold>{formatPKR(p.grossSalary, false)}</ReportCell>
                  <ReportCell align="right" mono className="text-rose-500">{formatPKR(p.totalDeductions, false)}</ReportCell>
                  <ReportCell align="right" mono bold className="text-blue-500">{formatPKR(p.netSalary, false)}</ReportCell>
                </ReportTableRow>
              ))}
            </ReportTable>
          </section>
        </div>
      )}
    </ReportPageShell>
  );
}

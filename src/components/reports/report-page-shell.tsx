import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Printer, FileText, Loader2, ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/custom/date-range-picker";
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

type AccentColor = "emerald" | "rose" | "blue" | "amber" | "violet";

const accentMap: Record<
  AccentColor,
  {
    text: string;
    bg: string;
    buttonBg: string;
    buttonBgHover: string;
  }
> = {
  emerald: {
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    buttonBg: "bg-emerald-600",
    buttonBgHover: "hover:bg-emerald-500",
  },
  rose: {
    text: "text-rose-500",
    bg: "bg-rose-500/10",
    buttonBg: "bg-rose-600",
    buttonBgHover: "hover:bg-rose-500",
  },
  blue: {
    text: "text-blue-500",
    bg: "bg-blue-500/10",
    buttonBg: "bg-blue-600",
    buttonBgHover: "hover:bg-blue-500",
  },
  amber: {
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    buttonBg: "bg-amber-600",
    buttonBgHover: "hover:bg-amber-500",
  },
  violet: {
    text: "text-violet-500",
    bg: "bg-violet-500/10",
    buttonBg: "bg-violet-600",
    buttonBgHover: "hover:bg-violet-500",
  },
};

interface ReportPageShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onGenerate: (range: DateRange | undefined) => void;
  isLoading: boolean;
  isEmpty: boolean;
  accentColor?: AccentColor;
  emptyMessage?: string;
}

export function ReportPageShell({
  title,
  subtitle,
  children,
  onGenerate,
  isLoading,
  isEmpty,
  accentColor = "emerald",
  emptyMessage = "Select a date range and click Generate to view the report.",
}: ReportPageShellProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [hasGenerated, setHasGenerated] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const a = accentMap[accentColor];

  const handleGenerate = () => {
    setHasGenerated(true);
    onGenerate(dateRange);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="flex flex-col min-h-full">
        {/* Controls - hidden in print */}
        <div className="print:hidden">
          {/* Breadcrumb + Header */}
          <div className="border-b pb-6">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="size-3.5" />
              Back to Reports
            </Link>

            <div className="flex items-end justify-between gap-6">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                  {subtitle}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasGenerated && !isEmpty && (
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    className="gap-2 h-9 px-3 text-xs"
                  >
                    <Printer className="size-3.5" />
                    Print
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 py-4">
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <CalendarRange className={`size-4 ${a.text}`} />
              <DatePickerWithRange
                date={dateRange}
                onDateChange={(d) => {
                  setDateRange(d ?? { from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
                  setHasGenerated(false);
                }}
                className="w-64"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !dateRange?.from}
              className={`gap-2 h-9 px-4 text-xs font-medium ${a.buttonBg} ${a.buttonBgHover} text-white`}
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )}
              Generate Report
            </Button>
          </div>
        </div>

        {/* Report Content */}
        <div ref={reportRef} className="report-content pb-8">
          {/* Print-only header */}
          <div className="hidden print:block mb-6 pb-3 border-b-2 border-black">
            <h1 className="text-xl font-bold uppercase">{title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {subtitle}
              {dateRange?.from && dateRange?.to && (
                <span className="ml-2">
                  ({dateRange.from.toLocaleDateString()} —{" "}
                  {dateRange.to.toLocaleDateString()})
                </span>
              )}
            </p>
          </div>

          {!hasGenerated ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg print:hidden">
              <FileText className={`size-8 ${a.text} mb-3 opacity-60`} />
              <h3 className="font-medium text-sm">Ready to Generate</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {emptyMessage}
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 print:hidden">
              <Loader2 className={`size-5 ${a.text} animate-spin mb-3`} />
              <p className="text-sm text-muted-foreground">
                Generating report…
              </p>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg print:hidden">
              <FileText className="size-8 text-muted-foreground mb-3 opacity-40" />
              <h3 className="font-medium text-sm">No Records Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No data was found for the selected date range.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 1.2cm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .report-content {
            padding: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5pt;
          }
          th {
            background: #f0f0f0 !important;
            color: #333 !important;
            border: 1px solid #ccc;
            padding: 7px 10px;
            text-align: left;
            font-weight: 700;
            font-size: 8.5pt;
          }
          td {
            border: 1px solid #ddd;
            padding: 6px 10px;
            text-align: left;
            color: #222;
          }
          tr:nth-child(even) {
            background: #fafafa;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}

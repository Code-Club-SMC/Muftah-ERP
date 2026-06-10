import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AccentColor = "emerald" | "rose" | "blue" | "amber" | "violet";

const accentMap: Record<
  AccentColor,
  {
    bar: string;
    text: string;
    rowHover: string;
  }
> = {
  emerald: {
    bar: "bg-emerald-500",
    text: "text-emerald-500",
    rowHover: "hover:bg-emerald-500/5",
  },
  rose: {
    bar: "bg-rose-500",
    text: "text-rose-500",
    rowHover: "hover:bg-rose-500/5",
  },
  blue: {
    bar: "bg-blue-500",
    text: "text-blue-500",
    rowHover: "hover:bg-blue-500/5",
  },
  amber: {
    bar: "bg-amber-500",
    text: "text-amber-500",
    rowHover: "hover:bg-amber-500/5",
  },
  violet: {
    bar: "bg-violet-500",
    text: "text-violet-500",
    rowHover: "hover:bg-violet-500/5",
  },
};

export function SectionTitle({
  children,
  accentColor = "emerald",
}: {
  children: React.ReactNode;
  accentColor?: AccentColor;
}) {
  const a = accentMap[accentColor];
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-0.5 h-5 rounded ${a.bar}`} />
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
    </div>
  );
}

export function SummaryCard({
  label,
  value,
  accentColor = "emerald",
}: {
  label: string;
  value: string;
  accentColor?: AccentColor;
}) {
  const a = accentMap[accentColor];
  return (
    <Card>
      <CardContent className="pt-4 px-4">
        <div className={`text-[11px] font-medium uppercase tracking-wide ${a.text} mb-1`}>
          {label}
        </div>
        <div className="text-lg font-semibold font-mono tabular-nums">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportTable({
  headers,
  children,
}: {
  headers: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {headers.map((h, i) => (
              <TableHead
                key={i}
                className={`text-xs font-medium uppercase text-muted-foreground h-9 ${i === headers.length - 1 ? "text-right" : ""}`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function ReportTableRow({
  children,
  accentColor = "emerald",
}: {
  children: React.ReactNode;
  accentColor?: AccentColor;
}) {
  const a = accentMap[accentColor];
  return (
    <TableRow className={`transition-colors ${a.rowHover}`}>
      {children}
    </TableRow>
  );
}

export function ReportCell({
  children,
  align = "left",
  mono = false,
  bold = false,
  muted = false,
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  bold?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  const monoClass = mono ? "font-mono tabular-nums" : "";
  const boldClass = bold ? "font-medium" : "";
  const mutedClass = muted ? "text-muted-foreground" : "";

  return (
    <TableCell
      className={`text-sm py-2.5 ${alignClass} ${monoClass} ${boldClass} ${mutedClass} ${className}`}
    >
      {children}
    </TableCell>
  );
}

export function EmptySection({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex items-center justify-center py-8 text-center border border-dashed rounded-md print:hidden">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useGetDueTodaySlips,
  useGetRecoveryQueue,
  useGetRecoverySummary,
  useGetRecoveryAttempts,
  useAssignRecoveryPerson,
  useUpdateRecoveryStatus,
  useCreateRecoveryAttempt,
  useEscalateRecovery,
} from "@/hooks/sales/use-credit-recovery";
import { useGetSalesmen } from "@/hooks/sales/use-sales-people";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  Clock,
  Phone,
  UserCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  ChevronUp,
} from "lucide-react";

const PKR = (v: number) =>
  `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending: { variant: "outline", color: "text-yellow-600 border-yellow-300 bg-yellow-50" },
  in_progress: { variant: "secondary", color: "text-blue-600 border-blue-300 bg-blue-50" },
  partially_paid: { variant: "secondary", color: "text-orange-600 border-orange-300 bg-orange-50" },
  overdue: { variant: "destructive", color: "" },
  defaulted: { variant: "destructive", color: "dark:bg-red-950/30" },
};

const OUTCOME_LABELS: Record<string, string> = {
  no_answer: "No Answer",
  promised: "Promised",
  partial_payment: "Partial Payment",
  refused: "Refused",
  unreachable: "Unreachable",
  resolved: "Resolved",
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="size-3.5" />,
  visit: <UserCheck className="size-3.5" />,
  whatsapp: <Phone className="size-3.5" />,
  letter: <ArrowRight className="size-3.5" />,
  other: <ArrowRight className="size-3.5" />,
};

export const Route = createFileRoute("/_protected/sales/recovery/")({
  component: RecoveryPage,
});

function RecoveryPage() {
  const [activeTab, setActiveTab] = useState("due-today");
  const { data: summary, isLoading: summaryLoading } = useGetRecoverySummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Recovery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track overdue credit, assign recovery staff, and monitor follow-ups.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Due Today"
            value={summary?.dueToday ?? 0}
            icon={<Clock className="size-5 text-amber-500" />}
            alert={!!summary?.dueToday}
          />
          <SummaryCard
            title="Pending"
            value={summary?.statusCounts?.pending ?? 0}
            icon={<AlertCircle className="size-5 text-yellow-500" />}
          />
          <SummaryCard
            title="In Progress"
            value={summary?.statusCounts?.["in_progress"] ?? 0}
            icon={<TrendingUp className="size-5 text-blue-500" />}
          />
          <SummaryCard
            title="Overdue"
            value={summary?.statusCounts?.overdue ?? 0}
            icon={<AlertTriangle className="size-5 text-red-500" />}
            alert={!!summary?.statusCounts?.overdue}
          />
          <SummaryCard
            title="Defaulted"
            value={summary?.statusCounts?.defaulted ?? 0}
            icon={<ShieldAlert className="size-5 text-red-700" />}
          />
          <SummaryCard
            title="Partially Paid"
            value={summary?.statusCounts?.["partially_paid"] ?? 0}
            icon={<CheckCircle2 className="size-5 text-orange-500" />}
          />
          <SummaryCard
            title="Total Outstanding"
            value={PKR(summary?.totalOutstanding ?? 0)}
            icon={<TrendingUp className="size-5 text-emerald-500" />}
            isCurrency
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="due-today" className="gap-2">
            <Clock className="size-3.5" />
            Due Today
            {summary?.dueToday ? (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                {summary.dueToday}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="recovery-queue" className="gap-2">
            <AlertTriangle className="size-3.5" />
            Recovery Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="due-today" className="mt-6">
          <DueTodaySection />
        </TabsContent>

        <TabsContent value="recovery-queue" className="mt-6">
          <RecoveryQueueSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  alert,
  isCurrency,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  alert?: boolean;
  isCurrency?: boolean;
}) {
  return (
    <Card className={cn(alert && "border-amber-300 dark:border-amber-700")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-xl font-bold", isCurrency ? "tabular-nums" : "")}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DUE TODAY SECTION
// ═══════════════════════════════════════════════════════════════════════════

function DueTodaySection() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetDueTodaySlips(page, 50);
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Slip</TableHead>
              <TableHead className="text-[11px]">Customer</TableHead>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">Due Date</TableHead>
              <TableHead className="text-[11px] text-right">Amount Due</TableHead>
              <TableHead className="text-[11px]">Original Salesman</TableHead>
              <TableHead className="text-[11px]">Assigned To</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(9)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data?.slips?.length ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">
                  No slips due today. All caught up!
                </TableCell>
              </TableRow>
            ) : (
              data.slips.map((s: any) => (
                <TableRow key={s.id} className={cn(Number(s.amountDue) === 0 && "bg-green-50/50 dark:bg-green-950/10")}>
                  <TableCell className="font-mono text-xs">{s.slipNumber}</TableCell>
                  <TableCell className="text-sm">{s.customer?.name}</TableCell>
                  <TableCell className="text-xs capitalize">{s.customer?.customerType}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {s.invoice?.creditReturnDate
                      ? format(new Date(s.invoice.creditReturnDate), "dd MMM yy")
                      : "—"}
                  </TableCell>
                  <TableCell className={cn(
                    "text-sm tabular-nums text-right font-semibold",
                    Number(s.amountDue) === 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {PKR(Number(s.amountDue))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.salesman?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.recoveryAssignedTo?.name ?? "—"}</TableCell>
                  <TableCell>
                    {Number(s.amountDue) === 0 ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        Ready to Close
                      </Badge>
                    ) : (
                      <RecoveryStatusBadge status={s.recoveryStatus} />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedSlip(s)}>
                        Manage
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link to="/sales/reconciliation" search={{ slip: s.slipNumber }}>
                          Reconcile
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pageCount} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <RecoveryDetailSheet slip={selectedSlip} onClose={() => setSelectedSlip(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECOVERY QUEUE SECTION
// ═══════════════════════════════════════════════════════════════════════════

function RecoveryQueueSection() {
  const [filters, setFilters] = useState({
    recoveryStatus: "" as string,
    assignedToId: "" as string,
    escalationLevel: undefined as number | undefined,
    page: 1,
    limit: 50,
  });
  const { data, isLoading } = useGetRecoveryQueue(filters);
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.recoveryStatus || undefined}
          onValueChange={(v) => setFilters(f => ({ ...f, recoveryStatus: v === "all" ? "" : v, page: 1 }))}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="defaulted">Defaulted</SelectItem>
          </SelectContent>
        </Select>

        <EscalationFilter
          value={filters.escalationLevel}
          onChange={(v) => setFilters(f => ({ ...f, escalationLevel: v, page: 1 }))}
        />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Slip</TableHead>
              <TableHead className="text-[11px]">Customer</TableHead>
              <TableHead className="text-[11px]">Amount Due</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px]">Assigned To</TableHead>
              <TableHead className="text-[11px]">Next Follow-up</TableHead>
              <TableHead className="text-[11px]">Escalation</TableHead>
              <TableHead className="text-[11px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data?.slips?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                  No slips in recovery queue.
                </TableCell>
              </TableRow>
            ) : (
              data.slips.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.slipNumber}</TableCell>
                  <TableCell className="text-sm">{s.customer?.name}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right font-semibold text-red-600">
                    {PKR(Number(s.amountDue))}
                  </TableCell>
                  <TableCell><RecoveryStatusBadge status={s.recoveryStatus} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.recoveryAssignedTo?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {s.nextFollowUpDate
                      ? format(new Date(s.nextFollowUpDate), "dd MMM yy")
                      : "—"}
                  </TableCell>
                  <TableCell><EscalationBadge level={s.escalationLevel ?? 0} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedSlip(s)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {filters.page} of {data.pageCount}</span>
          <Button variant="outline" size="sm" disabled={filters.page >= data.pageCount} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>
            Next
          </Button>
        </div>
      )}

      <RecoveryDetailSheet slip={selectedSlip} onClose={() => setSelectedSlip(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECOVERY DETAIL SHEET
// ═══════════════════════════════════════════════════════════════════════════

function RecoveryDetailSheet({ slip, onClose }: { slip: any; onClose: () => void }) {
  const open = !!slip;
  const { data: attempts } = useGetRecoveryAttempts(slip?.id ?? "");
  const { data: salesmen } = useGetSalesmen();
  const { mutate: assignPerson } = useAssignRecoveryPerson();
  const { mutate: updateStatus } = useUpdateRecoveryStatus();
  const { mutate: createAttempt } = useCreateRecoveryAttempt();
  const { mutate: escalate } = useEscalateRecovery();

  const [newAttempt, setNewAttempt] = useState({
    attemptMethod: "call" as string,
    attemptOutcome: "no_answer" as string,
    amountPromised: "" as string,
    promisedDate: "" as string,
    notes: "" as string,
  });

  if (!slip) return null;

  const handleAssign = (salesmanId: string) => {
    assignPerson({ slipId: slip.id, recoveryAssignedToId: salesmanId });
  };

  const handleStatusChange = (status: string) => {
    updateStatus({ slipId: slip.id, recoveryStatus: status });
  };

  const handleEscalate = () => {
    escalate(slip.id);
  };

  const handleLogAttempt = () => {
    createAttempt({
      slipId: slip.id,
      attemptMethod: newAttempt.attemptMethod,
      attemptOutcome: newAttempt.attemptOutcome,
      amountPromised: newAttempt.amountPromised ? Number(newAttempt.amountPromised) : undefined,
      promisedDate: newAttempt.promisedDate ? new Date(newAttempt.promisedDate) : undefined,
      notes: newAttempt.notes || undefined,
    });
    setNewAttempt({ attemptMethod: "call", attemptOutcome: "no_answer", amountPromised: "", promisedDate: "", notes: "" });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-mono">{slip.slipNumber}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Slip Info */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{slip.customer?.name}</p>
            <p className="text-xs text-muted-foreground">{slip.customer?.city} — {slip.customer?.mobileNumber}</p>
            <div className="flex items-center gap-3 pt-1">
              <p className="text-lg font-bold text-red-600">{PKR(Number(slip.amountDue))}</p>
              <RecoveryStatusBadge status={slip.recoveryStatus} />
            </div>
          </div>

          {/* Status & Assignment */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Recovery Status</label>
              <Select value={slip.recoveryStatus || undefined} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
              <Select
                value={slip.recoveryAssignedToId || undefined}
                onValueChange={handleAssign}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {salesmen?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Escalation Level</p>
                <EscalationBadge level={slip.escalationLevel ?? 0} />
              </div>
              <Button size="sm" variant="outline" onClick={handleEscalate}>
                <ChevronUp className="mr-1 size-3.5" />
                Escalate
              </Button>
            </div>
          </div>

          {/* Attempt Timeline */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Attempt History</p>
            {!attempts?.length ? (
              <p className="text-sm text-muted-foreground">No attempts recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {attempts.map((a: any) => (
                  <div key={a.id} className="rounded-lg border p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {METHOD_ICONS[a.attemptMethod]}
                        <span className="text-xs font-medium capitalize">{a.attemptMethod}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {OUTCOME_LABELS[a.attemptOutcome] ?? a.attemptOutcome}
                      </Badge>
                    </div>
                    {a.amountPromised && (
                      <p className="text-xs text-muted-foreground">
                        Promised: {PKR(Number(a.amountPromised))}
                        {a.promisedDate && ` by ${format(new Date(a.promisedDate), "dd MMM yy")}`}
                      </p>
                    )}
                    {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {a.assignedTo?.name} — {format(new Date(a.attemptedAt), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log New Attempt */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium">Log New Attempt</p>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={newAttempt.attemptMethod}
                onValueChange={(v) => setNewAttempt(n => ({ ...n, attemptMethod: v }))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="visit">Visit</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={newAttempt.attemptOutcome}
                onValueChange={(v) => setNewAttempt(n => ({ ...n, attemptOutcome: v }))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="promised">Promised</SelectItem>
                  <SelectItem value="partial_payment">Partial Payment</SelectItem>
                  <SelectItem value="refused">Refused</SelectItem>
                  <SelectItem value="unreachable">Unreachable</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newAttempt.attemptOutcome === "promised" && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Amount Promised"
                  className="h-8 text-xs"
                  value={newAttempt.amountPromised}
                  onChange={(e) => setNewAttempt(n => ({ ...n, amountPromised: e.target.value }))}
                />
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={newAttempt.promisedDate}
                  onChange={(e) => setNewAttempt(n => ({ ...n, promisedDate: e.target.value }))}
                />
              </div>
            )}
            <Textarea
              placeholder="Notes..."
              className="text-xs min-h-[60px]"
              value={newAttempt.notes}
              onChange={(e) => setNewAttempt(n => ({ ...n, notes: e.target.value }))}
            />
            <Button size="sm" className="w-full" onClick={handleLogAttempt}>
              Log Attempt
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function RecoveryStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-[10px]">—</Badge>;
  const style = STATUS_STYLES[status] ?? { variant: "outline", color: "" };
  return (
    <Badge variant={style.variant} className={cn("text-[10px] capitalize", style.color)}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function EscalationBadge({ level }: { level: number }) {
  const colors = [
    "bg-gray-200 text-gray-700",
    "bg-yellow-200 text-yellow-700",
    "bg-orange-200 text-orange-700",
    "bg-red-200 text-red-700",
  ];
  const color = colors[Math.min(level, colors.length - 1)];
  return (
    <Badge variant="outline" className={cn("text-[10px]", color)}>
      L{level}
    </Badge>
  );
}

function EscalationFilter({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  return (
    <Select value={value === undefined ? undefined : String(value)} onValueChange={(v) => onChange(v === "all" ? undefined : Number(v))}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue placeholder="All Levels" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Levels</SelectItem>
        <SelectItem value="0">Level 0</SelectItem>
        <SelectItem value="1">Level 1</SelectItem>
        <SelectItem value="2">Level 2</SelectItem>
        <SelectItem value="3">Level 3</SelectItem>
      </SelectContent>
    </Select>
  );
}

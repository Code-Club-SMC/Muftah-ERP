import { useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useNavigate, useParams, Link } from "@tanstack/react-router";
import { getEmployeeFn } from "@/server-functions/hr/employees/get-employee-fn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft,
  Edit,
  Trash2,
  User,
  Building2,
  MapPin,
  Phone,
  CreditCard,
  Banknote,
  Briefcase,
  CalendarClock,
  LayoutDashboard,
  Receipt,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Wallet,
  MinusCircle,
} from "lucide-react";
import { EditEmployeeDialog } from "./edit-employee-dialog";
import { useDeleteEmployee } from "@/hooks/hr/use-delete-employee";
import { EmployeeAttendanceLog } from "@/components/hr/attendance/employee-attendance-log";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getEmployeePayrollHistoryFn } from "@/server-functions/hr/payroll/dashboard-fn";
import { PayslipDialog } from "@/components/hr/payroll/payslip-dialog";
import type { PayslipData } from "@/components/hr/payroll/payslip-view";
import { cn } from "@/lib/utils";

const statusStyles = {
  active: {
    label: "Active",
    class: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  on_leave: {
    label: "On Leave",
    class: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
    dot: "bg-indigo-500",
  },
  terminated: {
    label: "Terminated",
    class: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    dot: "bg-rose-500",
  },
  resigned: {
    label: "Resigned",
    class: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    dot: "bg-amber-500",
  },
};

const employmentTypeLabels: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  intern: "Intern",
};

const allowanceLabels: Record<string, string> = {
  houseRent: "House Rent",
  utilities: "Utilities",
  conveyance: "Conveyance",
  fuel: "Fuel",
  mobile: "Mobile",
  bikeMaintenance: "Bike Maint.",
  technical: "Technical",
  special: "Special",
  nightShift: "Night Shift",
};

export const EmployeeDetailView = () => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);
  const deleteMutate = useDeleteEmployee();
  const { employeeId } = useParams({
    from: "/_protected/hr/employees/$employeeId",
  });

  const { data: employee } = useSuspenseQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => getEmployeeFn({ data: { id: employeeId } }),
    staleTime: 0,
    gcTime: 0,
  });

  const { data: { history: payrollHistory } } = useSuspenseQuery({
    queryKey: ["employee-payroll-history", employeeId, "last12", undefined],
    queryFn: () => getEmployeePayrollHistoryFn({ data: { employeeId, filterMode: "last12" } }),
    staleTime: 0,
    gcTime: 0,
  });

  // ── Salary calculations ──────────────────────────────────────────────────
  const allowanceConfig = (employee.allowanceConfig as any[]) || [];
  const basicSalary = parseFloat(employee.basicSalary || "0") || 0;
  const totalAllowances = allowanceConfig.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  const grossSalary = basicSalary + totalAllowances;

  // ── Payroll stats ───────────────────────────────────────────────────────
  const totalNetPaid = payrollHistory.reduce(
    (acc, p) => acc + parseFloat(p.netSalary || "0"),
    0,
  );
  const lastPayslip = payrollHistory[0] ?? null;

  const handleDelete = () => {
    deleteMutate.mutate(
      { data: { id: employee.id } },
      { onSuccess: () => navigate({ to: "/hr/employees" }) },
    );
  };

  const statusConfig = statusStyles[employee.status as keyof typeof statusStyles] || {
    label: employee.status,
    class: "",
    dot: "bg-gray-400",
  };

  const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : null;
  const tenure = joiningDate
    ? formatDistanceToNow(joiningDate, { addSuffix: false })
    : "—";

  return (
    <div className="space-y-6 pb-10 container mx-auto max-w-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/hr/employees" })}
            className="rounded-full"
          >
            <ChevronLeft className="size-5" />
          </Button>

          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-border ">
              <AvatarFallback className="text-lg font-black bg-primary/10 text-primary">
                {employee.firstName[0]}
                {employee.lastName[0]}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {employee.firstName} {employee.lastName}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2.5 py-0.5 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5",
                    statusConfig.class,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", statusConfig.dot)} />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 mt-0.5 text-sm">
                <Briefcase className="size-3.5" />
                {employee.designation}
                <span className="opacity-30">•</span>
                <span>{employee.department}</span>
                <span className="opacity-30">•</span>
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                  {employee.employeeCode}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="size-4 mr-2" />
            Edit Profile
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all records for{" "}
                  <strong>{employee.firstName} {employee.lastName}</strong>, including payslips,
                  attendance logs, and salary advances. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Top KPI Strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIStrip
          label="Basic Salary"
          value={`PKR ${basicSalary.toLocaleString()}`}
          icon={Banknote}
          color="blue"
        />
        <KPIStrip
          label="Total Allowances"
          value={`PKR ${totalAllowances.toLocaleString()}`}
          icon={TrendingUp}
          color="indigo"
        />
        <KPIStrip
          label="Gross Monthly (Est.)"
          value={`PKR ${grossSalary.toLocaleString()}`}
          icon={Wallet}
          color="emerald"
        />
        <KPIStrip
          label="Total Net Paid (All Time)"
          value={`PKR ${Math.round(totalNetPaid).toLocaleString()}`}
          icon={CheckCircle2}
          color="violet"
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-[500px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <Receipt className="size-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Attendance
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ OVERVIEW TAB ═══════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 text-muted-foreground" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoRow label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
                    <InfoRow label="Employee Code" value={employee.employeeCode} mono />
                    <InfoRow label="CNIC / National ID" value={employee.cnic || "—"} mono />
                    <InfoRow
                      label="Phone"
                      icon={<Phone className="size-3.5 text-muted-foreground" />}
                      value={employee.phone || "—"}
                    />
                    <div className="md:col-span-2">
                      <InfoRow
                        label="Address"
                        icon={<MapPin className="size-3.5 text-muted-foreground" />}
                        value={employee.address || "—"}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Banking Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="size-4 text-muted-foreground" />
                    Banking & Payment Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoRow label="Bank Name" value={employee.bankName || "—"} />
                    <InfoRow
                      label="Account Number"
                      value={employee.bankAccountNumber || "—"}
                      mono
                    />
                  </div>

                  {!employee.bankName && !employee.bankAccountNumber && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                      <AlertCircle className="size-4 shrink-0" />
                      No banking details on record. Add bank info to enable direct salary transfers.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compensation Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Banknote className="size-4 text-muted-foreground" />
                    Compensation & Deduction Rules
                  </CardTitle>
                  <CardDescription>
                    Salary components and the attendance events that trigger deductions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Basic salary row */}
                  <div className="flex items-center justify-between py-2.5 px-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-primary">Basic Salary</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Deducted on: absent · late arrival · early leaving
                      </span>
                    </div>
                    <span className="font-black text-primary tabular-nums">
                      PKR {basicSalary.toLocaleString()}
                    </span>
                  </div>

                  {/* Allowances with deduction rules */}
                  {allowanceConfig.filter((a: any) => a.id !== "basicSalary" && parseFloat(a.amount || "0") > 0).length > 0 ? (
                    <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden">
                      {allowanceConfig
                        .filter((a: any) => a.id !== "basicSalary" && parseFloat(a.amount || "0") > 0)
                        .map((allowance: any) => {
                          const rules = allowance.deductions || {};
                          const activeRules: string[] = [];
                          if (rules.absent) activeRules.push("Absent");
                          if (rules.leave) activeRules.push("Leave");
                          if (rules.specialLeave) activeRules.push("Special Leave");
                          if (rules.lateArrival) activeRules.push("Late Arrival");
                          if (rules.earlyLeaving) activeRules.push("Early Leaving");
                          return (
                            <div
                              key={allowance.id}
                              className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <span className="text-sm font-semibold leading-tight">
                                  {allowanceLabels[allowance.id] || allowance.name}
                                </span>
                                {activeRules.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {activeRules.map((rule) => (
                                      <span
                                        key={rule}
                                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/30"
                                      >
                                        <MinusCircle className="size-2.5" />
                                        {rule}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 font-bold uppercase tracking-wider">
                                    <CheckCircle2 className="size-2.5" /> No deductions
                                  </span>
                                )}
                              </div>
                              <span className="font-black text-sm tabular-nums ml-4 shrink-0">
                                PKR {parseFloat(allowance.amount || "0").toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No allowances configured with non-zero amounts.
                    </p>
                  )}

                  {/* Gross total */}
                  <Separator />
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">
                        Estimated Gross Monthly
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Basic + all non-zero allowances
                      </span>
                    </div>
                    <span className="text-lg font-black text-emerald-700 tabular-nums">
                      PKR {grossSalary.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right — Sidebar */}
            <div className="space-y-6">
              {/* Employment Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    Employment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <SidebarRow
                    label="Status"
                    value={
                      <Badge
                        variant="outline"
                        className={cn("font-medium capitalize text-xs", statusConfig.class)}
                      >
                        {statusConfig.label}
                      </Badge>
                    }
                  />
                  <SidebarRow
                    label="Type"
                    value={
                      <Badge variant="secondary" className="font-medium capitalize text-xs">
                        {employmentTypeLabels[employee.employmentType] || employee.employmentType}
                      </Badge>
                    }
                  />
                  <SidebarRow
                    label="Department"
                    value={<span className="font-medium text-sm">{employee.department || "—"}</span>}
                  />
                  <SidebarRow
                    label="Designation"
                    value={<span className="font-medium text-sm">{employee.designation}</span>}
                  />
                  <SidebarRow
                    label="Duty Hours / Day"
                    value={
                      <span className="font-mono font-bold text-sm">
                        {employee.standardDutyHours}h
                      </span>
                    }
                  />
                  <SidebarRow
                    label="Joined On"
                    value={
                      <span className="font-medium text-sm">
                        {joiningDate ? format(joiningDate, "dd MMM yyyy") : "—"}
                      </span>
                    }
                  />
                  <SidebarRow
                    label="Tenure"
                    value={
                      <span className="font-medium text-sm text-muted-foreground">{tenure}</span>
                    }
                  />
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-muted/20 border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    asChild
                  >
                    <Link to="/hr/payroll/employee/$employeeId" params={{ employeeId: employee.id }}>
                      <span className="flex items-center gap-2">
                        <Receipt className="size-4" />
                        View Payroll History
                      </span>
                      <ArrowUpRight className="size-4 opacity-50" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    asChild
                  >
                    <Link to="/hr/attendance/$employeeId" params={{ employeeId: employee.id }}>
                      <span className="flex items-center gap-2">
                        <Activity className="size-4" />
                        View Attendance Log
                      </span>
                      <ArrowUpRight className="size-4 opacity-50" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════ PAYROLL TAB ═════════════════════════════════ */}
        <TabsContent value="payroll" className="mt-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase  text-muted-foreground mb-1">
                  Total Payslips
                </p>
                <p className="text-3xl font-black">{payrollHistory.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Processed months</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase  text-muted-foreground mb-1">
                  Lifetime Net Paid
                </p>
                <p className="text-3xl font-black text-emerald-600">
                  PKR {Math.round(totalNetPaid).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Across all payrolls</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase  text-muted-foreground mb-1">
                  Last Payslip
                </p>
                <p className="text-3xl font-black">
                  {lastPayslip
                    ? format(parseISO(lastPayslip.payroll?.month ?? new Date().toISOString()), "MMM yyyy")
                    : "—"}
                </p>
                {lastPayslip && (
                  <p className="text-xs text-emerald-600 font-bold mt-1">
                    PKR {Math.round(parseFloat(lastPayslip.netSalary)).toLocaleString()} net
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Full history link cta */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link to="/hr/payroll/employee/$employeeId" params={{ employeeId: employee.id }}>
                <ArrowUpRight className="size-4 mr-2" />
                Full Payroll History & Report
              </Link>
            </Button>
          </div>

          {/* Payslip list */}
          {payrollHistory.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="size-10 mb-3 opacity-20" />
                <p className="font-semibold">No payslips generated yet</p>
                <p className="text-xs mt-1">Payslips will appear here once payroll is processed.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="divide-y divide-border/60">
                {payrollHistory.slice(0, 6).map((payslip) => (
                  <div
                    key={payslip.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPayslip(payslip as any);
                      setIsPayslipOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/5 rounded-lg">
                        <Receipt className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">
                          {payslip.payroll
                            ? format(parseISO(payslip.payroll.month), "MMMM yyyy")
                            : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {payslip.payroll
                            ? `${format(parseISO(payslip.payroll.startDate), "dd MMM")} – ${format(parseISO(payslip.payroll.endDate), "dd MMM")}`
                            : "—"}
                          {" • "}
                          {payslip.daysPresent ?? 0}d present
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Gross</p>
                        <p className="text-xs font-bold">
                          PKR {Math.round(parseFloat(payslip.grossSalary)).toLocaleString()}
                        </p>
                      </div>
                      {parseFloat(payslip.totalDeductions) > 0 && (
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Deductions</p>
                          <p className="text-xs font-bold text-rose-600">
                            -{Math.round(parseFloat(payslip.totalDeductions)).toLocaleString()}
                          </p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Net</p>
                        <p className="text-sm font-black text-emerald-600">
                          PKR {Math.round(parseFloat(payslip.netSalary)).toLocaleString()}
                        </p>
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground/40" />
                    </div>
                  </div>
                ))}
              </div>
              {payrollHistory.length > 6 && (
                <div className="px-5 py-3 bg-muted/20 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                    <Link to="/hr/payroll/employee/$employeeId" params={{ employeeId: employee.id }}>
                      View all {payrollHistory.length} payslips
                      <ArrowUpRight className="size-3.5 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════ ATTENDANCE TAB ═══════════════════════════════ */}
        <TabsContent value="attendance" className="mt-6">
          <EmployeeAttendanceLog employeeId={employee.id} showHeader={false} />
        </TabsContent>
      </Tabs>

      <EditEmployeeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={employee as any}
      />

      <PayslipDialog
        open={isPayslipOpen}
        onOpenChange={setIsPayslipOpen}
        payslip={selectedPayslip}
      />
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────

function KPIStrip({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: "blue" | "emerald" | "indigo" | "violet";
}) {
  const colors = {
    blue: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600", icon: "text-blue-500" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700", icon: "text-emerald-600" },
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700", icon: "text-indigo-600" },
    violet: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700", icon: "text-violet-600" },
  };
  const c = colors[color];
  return (
    <Card className={cn("border-0", c.bg)}>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={cn("size-7 shrink-0", c.icon)} />
        <div>
          <p className="text-[10px] font-bold uppercase  text-muted-foreground mb-0.5">
            {label}
          </p>
          <p className={cn("text-lg font-black leading-tight", c.text)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-bold text-muted-foreground uppercase  mb-1">
        {label}
      </h4>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className={cn("text-sm font-semibold", mono && "font-mono")}>{value}</p>
      </div>
    </div>
  );
}

function SidebarRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      {value}
    </div>
  );
}

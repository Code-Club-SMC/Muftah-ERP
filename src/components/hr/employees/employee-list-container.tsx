import { useSuspenseQuery } from "@tanstack/react-query";
import { getEmployeesFn } from "@/server-functions/hr/employees/get-employees-fn";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  TrendingUp,
  Wallet,
  UserCheck,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { motion, Variants } from "framer-motion";
import { EmployeesTable } from "./employees-table";
import { AddEmployeeSheet } from "./add-employee-sheet";
import { cn } from "@/lib/utils";

// ── Animation Variants ─────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
};

// ── Container ──────────────────────────────────────────────────────────────

export const EmployeeListContainer = () => {
  const [openAddSheet, setOpenAddSheet] = useState(false);

  const { data: employees } = useSuspenseQuery({
    queryKey: ["employees"],
    queryFn: getEmployeesFn,
  });

  const activeCount = employees.filter((e) => e.status === "active").length;
  const inactiveCount = employees.length - activeCount;

  const newHires = employees.filter(
    (e) =>
      new Date(e.joiningDate).getMonth() === new Date().getMonth() &&
      new Date(e.joiningDate).getFullYear() === new Date().getFullYear()
  ).length;

  const totalPayroll = employees
    .filter((e) => e.status === "active")
    .reduce((acc, curr) => acc + parseFloat(curr.basicSalary || "0"), 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 font-sans antialiased">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-none border border-border bg-card px-6 py-5 shadow-none">
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20">
              <Users className="size-4 text-primary" />
            </div>
            Employee Directory
          </h1>
          <p className="text-[10px] font-bold uppercase  text-muted-foreground flex items-center gap-2">
            <span>{employees.length} total</span>
            <span>&middot;</span>
            <span className="text-emerald-600 dark:text-emerald-500">{activeCount} active</span>
            {inactiveCount > 0 && (
              <>
                <span>&middot;</span>
                <span className="text-rose-500 dark:text-rose-400">
                  {inactiveCount} inactive
                </span>
              </>
            )}
          </p>
        </div>

        <Button
          onClick={() => setOpenAddSheet(true)}
          className="sm:w-auto gap-2 h-10 px-5 rounded-none shadow-none font-bold text-[13px]"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Add Employee
        </Button>
      </motion.div>

      {/* ── Sharp KPI Cards ─────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SharpKPICard
          icon={UserCheck}
          theme="blue"
          label="Total Employees"
          value={employees.length}
          subtext={`${activeCount} active · ${inactiveCount} inactive`}
        />
        <SharpKPICard
          icon={UserPlus}
          theme="emerald"
          label="New Hires This Month"
          value={newHires}
          subtext={newHires === 0 ? "No new hires yet" : "Recently onboarded"}
        />
        <SharpKPICard
          icon={Wallet}
          theme="violet"
          label="Est. Monthly Payroll"
          value={
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-muted-foreground">PKR</span>
              <span>{totalPayroll.toLocaleString()}</span>
            </div>
          }
          subtext="Active employees only"
        />
      </motion.div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="rounded-none border border-border bg-card shadow-none">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-transparent">
          <div>
            <p className="font-bold uppercase text-foreground">All Employees</p>
            <p className="text-[10px] font-semibold text-muted-foreground mt-1">
              Manage roles, compensation, and team details.
            </p>
          </div>
          <div className="p-2 border border-border bg-muted/10">
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
        </div>
        <div className="p-0 sm:p-4">
          <EmployeesTable data={employees} />
        </div>
      </motion.div>

      <AddEmployeeSheet open={openAddSheet} onOpenChange={setOpenAddSheet} />
    </motion.div>
  );
};

// ── Sharp Pixel-Perfect KPI Component ───────────────────────────────────────

type KPITheme = "blue" | "rose" | "emerald" | "violet" | "amber";

const sharpThemeStyles = {
  blue: { border: "border-t-blue-500", iconBg: "bg-blue-500/10", iconText: "text-blue-500" },
  rose: { border: "border-t-rose-500", iconBg: "bg-rose-500/10", iconText: "text-rose-500" },
  emerald: { border: "border-t-emerald-500", iconBg: "bg-emerald-500/10", iconText: "text-emerald-500" },
  violet: { border: "border-t-violet-500", iconBg: "bg-violet-500/10", iconText: "text-violet-500" },
  amber: { border: "border-t-amber-500", iconBg: "bg-amber-500/10", iconText: "text-amber-500" },
};

function SharpKPICard({
  label,
  value,
  subtext,
  icon: Icon,
  theme
}: {
  label: string;
  value: React.ReactNode;
  subtext: string;
  icon: any;
  theme: KPITheme
}) {
  const styles = sharpThemeStyles[theme];

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "relative flex flex-col justify-between p-5 bg-card border border-border rounded-none shadow-none",
        "border-t-2",
        styles.border
      )}
    >
      {/* Technical Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`, backgroundSize: "8px 8px" }}
      />

      <div className="relative z-10 flex items-start justify-between mb-8">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <div className={cn("p-1.5 rounded-none", styles.iconBg)}>
          <Icon className={cn("size-4", styles.iconText)} />
        </div>
      </div>

      <div className="relative z-10 space-y-1">
        <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
        <p className="text-xs font-medium text-muted-foreground/70">{subtext}</p>
      </div>
    </motion.div>
  );
}
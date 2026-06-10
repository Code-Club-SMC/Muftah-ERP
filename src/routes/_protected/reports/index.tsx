import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TrendingUp,
  CreditCard,
  Users,
  ShoppingCart,
  Banknote,
} from "lucide-react";

const reportTypes = [
  {
    title: "Sales",
    description: "Invoices, cash, credit, and revenue breakdowns.",
    href: "/reports/sales",
    icon: TrendingUp,
  },
  {
    title: "Credits",
    description: "Credit slips, recovery status, and outstanding balances.",
    href: "/reports/credits",
    icon: CreditCard,
  },
  {
    title: "Salaries",
    description: "Payslip data with earnings, deductions, and net pay.",
    href: "/reports/salaries",
    icon: Users,
  },
  {
    title: "Purchases",
    description: "Supplier purchases with material details and payment status.",
    href: "/reports/purchases",
    icon: ShoppingCart,
  },
  {
    title: "Expenses",
    description: "Finance expenses and manufacturing costs.",
    href: "/reports/expenses",
    icon: Banknote,
  },
];

export const Route = createFileRoute("/_protected/reports/")({
  component: ReportsLandingPage,
});

function ReportsLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate operational reports for any date range.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <Link
              key={report.href}
              to={report.href}
              className="group rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-2">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm">{report.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {report.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

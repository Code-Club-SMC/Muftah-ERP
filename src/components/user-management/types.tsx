import { adminGetUsersFn } from "@/server-functions/user-management/super-admin-get-users-fn";
import { Landmark } from "lucide-react";

export type OverviewData = Awaited<ReturnType<typeof adminGetUsersFn>>;
export type ManagedUser = OverviewData["users"][number];
export type ManagedRole = OverviewData["roles"][number];
export type PermissionDefinition = OverviewData["permissions"][number];
export type OnboardingOrderBooker = OverviewData["onboardingOrderBookers"][number];

export type UserDialogState =
  | {
      mode: "create";
      seedOrderBooker?: OnboardingOrderBooker;
      user?: undefined;
    }
  | {
      mode: "edit";
      user: ManagedUser;
    };

export type RoleDialogState =
  | {
      mode: "create";
      role?: undefined;
    }
  | {
      mode: "edit";
      role: ManagedRole;
    };

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  manufacturing: "Manufacturing",
  inventory: "Inventory",
  suppliers: "Suppliers",
  sales: "Sales",
  "order-booker": "Order Booker",
  finance: "Finance",
  hr: "HR & Payroll",
  operator: "Operator",
  "user-management": "User Management",
  rbac: "Role Governance",
};

export const LandingPathPill = ({ path }: { path: string }) => (
  <span className="inline-flex items-center gap-2 rounded-none border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-semibold text-foreground/80">
    <Landmark className="size-3.5 text-primary" />
    {path}
  </span>
);
